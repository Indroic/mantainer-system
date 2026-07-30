from uuid import UUID

from hexcore.domain.services import BaseDomainService
from src.features.alerts.domain.entities import (
    Alert,
    AlertType,
    MaintenancePlan,
    MaintenancePlanBasis,
)
from src.features.notifications.domain.entities import (
    NotificationSeverity,
    NotificationType,
)

#: Tipos de alerta que cada rol NUNCA debe ver. El Mecánico no recibe alertas de
#: bajo stock (spec 3.2); el inventario es asunto del Planificador y de Almacén.
from src.features.user.domain.entities import UserRole

ROLE_EXCLUDED_ALERT_TYPES: dict[UserRole, list[AlertType]] = {
    UserRole.MECANICO: [AlertType.LOW_STOCK],
    # Almacén solo se ocupa de inventario y despacho, no del taller.
    UserRole.ALMACEN: [AlertType.MAINTENANCE_DUE, AlertType.COMPONENT_SERVICE_DUE],
}


def excluded_alert_types_for_role(role: UserRole | None) -> list[AlertType]:
    """Tipos de alerta filtrados en el servidor para el rol dado."""
    if role is None:
        return []
    return ROLE_EXCLUDED_ALERT_TYPES.get(role, [])


class AlertDomainService(BaseDomainService):
    def __init__(
        self,
        alert_repo,
        machine_repo,
        spare_part_repo,
        maintenance_repo,
        maintenance_plan_repo=None,
        notification_service=None,
    ) -> None:
        self._repo = alert_repo
        self._machine_repo = machine_repo
        self._spare_part_repo = spare_part_repo
        self._maintenance_repo = maintenance_repo
        self._plan_repo = maintenance_plan_repo
        #: Servicio de notificaciones (opcional): cuando está presente, cada
        #: alerta generada se enruta además a la bandeja de los roles pertinentes.
        self._notifications = notification_service
        super().__init__()

    async def get_by_id(self, alert_id) -> Alert:
        return await self._repo.get_by_id(alert_id)

    async def resolve_alert(self, alert_id) -> Alert:
        """Marca una alerta manualmente como resuelta."""
        alert = await self.get_by_id(alert_id)
        alert.resolve()
        await self._repo.save(alert)
        return alert

    async def list_for_role(
        self, role: UserRole | None, *, only_unresolved: bool = True
    ) -> list[Alert]:
        """Alertas visibles para el rol indicado."""
        return await self._repo.list_visible(
            excluded_types=excluded_alert_types_for_role(role),
            only_unresolved=only_unresolved,
        )

    # ------------------------------------------------------------------
    # Planes de mantenimiento preventivo (spec 5.2)
    # ------------------------------------------------------------------
    async def create_plan(
        self,
        *,
        machine_id: UUID,
        component_name: str,
        interval_value: float,
        basis: MaintenancePlanBasis = MaintenancePlanBasis.USO,
        spare_part_id: UUID | None = None,
        last_service_value: float | None = None,
        warning_threshold: float = 50.0,
        notes: str | None = None,
    ) -> MaintenancePlan:
        """Configura una alerta programada por componente para una máquina.

        Si no se indica ``last_service_value`` se toma el horómetro actual de la
        máquina: el primer vencimiento cae un intervalo completo más adelante.
        """
        machine = await self._machine_repo.get_by_id(machine_id)

        plan = MaintenancePlan(
            machine_id=machine.id,
            spare_part_id=spare_part_id,
            component_name=component_name,
            basis=basis,
            interval_value=interval_value,
            last_service_value=(
                last_service_value
                if last_service_value is not None
                else float(machine.current_horometer or 0.0)
            ),
            warning_threshold=warning_threshold,
            notes=notes,
        )
        plan._validate()
        await self._plan_repo.save(plan)
        return plan

    async def update_plan(self, plan_id: UUID, **changes) -> MaintenancePlan:
        """Actualiza la configuración de un plan preventivo."""
        plan = await self._plan_repo.get_by_id(plan_id)
        plan.update_plan(**changes)
        await self._plan_repo.save(plan)
        return plan

    async def register_plan_service(self, plan_id: UUID) -> MaintenancePlan:
        """Reinicia el contador del plan al horómetro actual y resuelve su alerta."""
        plan = await self._plan_repo.get_by_id(plan_id)
        machine = await self._machine_repo.get_by_id(plan.machine_id)
        plan.register_service(float(machine.current_horometer or 0.0))
        await self._plan_repo.save(plan)

        active_alert = await self._repo.get_active_alert_by_plan(plan.id)
        if active_alert:
            active_alert.resolve()
            await self._repo.save(active_alert)

        return plan

    async def delete_plan(self, plan_id: UUID) -> MaintenancePlan:
        """Baja lógica del plan preventivo."""
        plan = await self._plan_repo.get_by_id(plan_id)
        plan.is_active = False
        await self._plan_repo.save(plan)
        return plan

    async def list_plans(self, machine_id: UUID | None = None) -> list[MaintenancePlan]:
        if self._plan_repo is None:
            return []
        return await self._plan_repo.list_active(machine_id)

    # ------------------------------------------------------------------
    # Barrido automático
    # ------------------------------------------------------------------
    async def check_and_generate_alerts(self) -> list[Alert]:
        """Barrido de inventario, maquinaria y planes preventivos.

        Autogenera o autorresuelve alertas y, cuando hay servicio de
        notificaciones inyectado, enruta cada alerta nueva a la bandeja de los
        roles correspondientes (nunca al Mecánico en el caso de bajo stock).
        """
        generated_or_resolved: list[Alert] = []

        await self._sweep_spare_parts(generated_or_resolved)
        await self._sweep_machines(generated_or_resolved)
        await self._sweep_maintenance_plans(generated_or_resolved)

        return generated_or_resolved

    async def _sweep_spare_parts(self, collected: list[Alert]) -> None:
        """1. Barrido de repuestos por debajo del stock mínimo."""
        # El método del repositorio de HexCore es `list_all()`: con `list()` el
        # barrido lanzaba AttributeError y el endpoint devolvía 500, por lo que
        # las alertas automáticas nunca llegaban a generarse.
        spare_parts = await self._spare_part_repo.list_all()
        for sp in spare_parts:
            active_alert = await self._repo.get_active_alert_by_spare_part(sp.id)

            if sp.stock_current < sp.stock_minimum:
                if active_alert:
                    continue

                alert = Alert(
                    type=AlertType.LOW_STOCK,
                    message=(
                        f"Stock crítico para repuesto '{sp.name}' ({sp.code}): "
                        f"actual {sp.stock_current} unidades, mínimo {sp.stock_minimum} unidades."
                    ),
                    spare_part_id=sp.id,
                )
                await self._repo.save(alert)
                collected.append(alert)

                # spec 3.2: el aviso de bajo stock va al Planificador y a Almacén.
                await self._notify(
                    NotificationType.BAJO_STOCK,
                    title=f"Bajo stock · {sp.name}",
                    message=alert.message,
                    severity=NotificationSeverity.CRITICAL,
                    link="/repuestos",
                    related_entity_id=sp.id,
                )
            elif active_alert:
                # El stock volvió a nivel: la alerta se autorresuelve.
                active_alert.resolve()
                await self._repo.save(active_alert)
                collected.append(active_alert)

    async def _sweep_machines(self, collected: list[Alert]) -> None:
        """2. Barrido de maquinaria con mantenimiento global próximo (<= 50 h)."""
        machines = await self._machine_repo.list_all()
        for m in machines:
            active_alert = await self._repo.get_active_alert_by_machine(m.id)
            next_service = await self._repo.get_next_service_horometer(m.id)

            # Sin historial liquidado, el primer servicio se considera a las 250 h.
            target_horometer = next_service if next_service is not None else 250.0
            difference = target_horometer - m.current_horometer

            if difference <= 50.0:
                if active_alert:
                    continue

                alert = Alert(
                    type=AlertType.MAINTENANCE_DUE,
                    message=(
                        f"Mantenimiento preventivo próximo para máquina '{m.code}': "
                        f"faltan {difference:.1f} horas para el servicio "
                        f"(Horómetro: {m.current_horometer}h, Próximo Mantenimiento: {target_horometer}h)."
                    ),
                    machine_id=m.id,
                )
                await self._repo.save(alert)
                collected.append(alert)

                await self._notify(
                    NotificationType.MANTENIMIENTO_PROXIMO,
                    title=f"Mantenimiento próximo · {m.code}",
                    message=alert.message,
                    severity=NotificationSeverity.WARNING,
                    link=f"/maquinaria/{m.id}",
                    related_entity_id=m.id,
                )
            elif active_alert:
                active_alert.resolve()
                await self._repo.save(active_alert)
                collected.append(active_alert)

    async def _sweep_maintenance_plans(self, collected: list[Alert]) -> None:
        """3. Barrido de alertas programadas por componente/uso (spec 5.2)."""
        if self._plan_repo is None:
            return

        plans = await self._plan_repo.list_active()
        for plan in plans:
            try:
                machine = await self._machine_repo.get_by_id(plan.machine_id)
            except Exception:
                # Máquina eliminada: el plan queda huérfano y se ignora.
                continue

            current_value = float(machine.current_horometer or 0.0)
            active_alert = await self._repo.get_active_alert_by_plan(plan.id)

            if plan.is_due(current_value):
                if active_alert:
                    continue

                remaining = plan.remaining(current_value)
                unit = getattr(machine, "horometer_unit", "Horas")
                unit_label = unit.value if hasattr(unit, "value") else str(unit)

                if plan.is_overdue(current_value):
                    detail = f"VENCIDO por {abs(remaining):,.1f} {unit_label}"
                else:
                    detail = f"faltan {remaining:,.1f} {unit_label}"

                alert = Alert(
                    type=AlertType.COMPONENT_SERVICE_DUE,
                    message=(
                        f"Servicio programado de '{plan.component_name}' en la máquina "
                        f"'{machine.code}': {detail}. Meta: {plan.target_value:,.1f} {unit_label} "
                        f"(cada {plan.interval_value:,.1f} {unit_label})."
                    ),
                    machine_id=machine.id,
                    spare_part_id=plan.spare_part_id,
                    maintenance_plan_id=plan.id,
                )
                await self._repo.save(alert)
                collected.append(alert)

                await self._notify(
                    NotificationType.SERVICIO_COMPONENTE,
                    title=f"Servicio de componente · {plan.component_name}",
                    message=alert.message,
                    severity=(
                        NotificationSeverity.CRITICAL
                        if plan.is_overdue(current_value)
                        else NotificationSeverity.WARNING
                    ),
                    link=f"/maquinaria/{machine.id}",
                    related_entity_id=plan.id,
                )
            elif active_alert:
                # El contador se reinició (servicio registrado): autorresolución.
                active_alert.resolve()
                await self._repo.save(active_alert)
                collected.append(active_alert)

    async def _notify(
        self,
        notification_type: NotificationType,
        *,
        title: str,
        message: str,
        severity: NotificationSeverity,
        link: str | None,
        related_entity_id: UUID | None,
    ) -> None:
        """Enruta la alerta a la bandeja de notificaciones si el servicio existe.

        Se deduplica por (destinatario, tipo, entidad) para que barridos repetidos
        no inunden la campana con el mismo aviso.
        """
        if self._notifications is None:
            return

        await self._notifications.notify_event(
            notification_type,
            title=title,
            message=message,
            severity=severity,
            link=link,
            related_entity_id=related_entity_id,
            deduplicate=True,
        )
