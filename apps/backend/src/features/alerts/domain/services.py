from sqlalchemy import select
from hexcore.domain.services import BaseDomainService
from src.features.alerts.domain.entities import Alert, AlertType
from src.features.maintenance.domain.entities import MaintenanceStatus


class AlertDomainService(BaseDomainService):
    def __init__(
        self,
        alert_repo,
        machine_repo,
        spare_part_repo,
        maintenance_repo,
    ) -> None:
        self._repo = alert_repo
        self._machine_repo = machine_repo
        self._spare_part_repo = spare_part_repo
        self._maintenance_repo = maintenance_repo
        super().__init__()

    async def get_by_id(self, alert_id) -> Alert:
        return await self._repo.get_by_id(alert_id)

    async def resolve_alert(self, alert_id) -> Alert:
        """Marca una alerta manualmente como resuelta."""
        alert = await self.get_by_id(alert_id)
        alert.resolve()
        await self._repo.save(alert)
        return alert

    async def check_and_generate_alerts(self) -> list[Alert]:
        """Realiza el barrido de la maquinaria y el inventario para autogenerar o resolver alertas."""
        generated_or_resolved = []

        # ----------------------------------------------------
        # 1. Barrido de Repuestos (Bajo Stock)
        # ----------------------------------------------------
        # Obtenemos todos los repuestos activos.
        # En HexCore, query() o list() recupera las entidades
        spare_parts = await self._spare_part_repo.list()
        for sp in spare_parts:
            # Buscamos si existe alguna alerta activa (no resuelta) para este repuesto
            active_alert = await self._repo.get_active_alert_by_spare_part(sp.id)

            if sp.stock_current < sp.stock_minimum:
                if not active_alert:
                    # Crear nueva alerta
                    alert = Alert(
                        type=AlertType.LOW_STOCK,
                        message=f"Stock crítico para repuesto '{sp.name}' ({sp.code}): actual {sp.stock_current} unidades, mínimo {sp.stock_minimum} unidades.",
                        spare_part_id=sp.id,
                    )
                    await self._repo.save(alert)
                    generated_or_resolved.append(alert)
            else:
                # Si el stock ya es suficiente pero había alerta activa, se auto-resuelve
                if active_alert:
                    active_alert.resolve()
                    await self._repo.save(active_alert)
                    generated_or_resolved.append(active_alert)

        # ----------------------------------------------------
        # 2. Barrido de Maquinaria (Próximo Mantenimiento <= 50h)
        # ----------------------------------------------------
        machines = await self._machine_repo.list()
        for m in machines:
            # Buscamos si existe alguna alerta activa para esta máquina
            active_alert = await self._repo.get_active_alert_by_machine(m.id)

            # Consultamos la última orden de trabajo LIQUIDADA para esta máquina
            # para saber el valor de next_service_horometer.
            # En HexCore podemos usar consultas directas en el repositorio
            next_service = await self._repo.get_next_service_horometer(m.id)

            # Si no hay ningún mantenimiento programado/liquidado con horómetro futuro,
            # el primer mantenimiento se considera a las 250 horas
            target_horometer = next_service if next_service is not None else 250.0
            difference = target_horometer - m.current_horometer

            if difference <= 50.0:
                if not active_alert:
                    # Crear nueva alerta
                    alert = Alert(
                        type=AlertType.MAINTENANCE_DUE,
                        message=f"Mantenimiento preventivo próximo para máquina '{m.code}': faltan {difference:.1f} horas para el servicio (Horómetro: {m.current_horometer}h, Próximo Mantenimiento: {target_horometer}h).",
                        machine_id=m.id,
                    )
                    await self._repo.save(alert)
                    generated_or_resolved.append(alert)
            else:
                # Si ya no está en rango de alerta pero tenía alerta activa (ej. se liquidó el mantenimiento), se auto-resuelve
                if active_alert:
                    active_alert.resolve()
                    await self._repo.save(active_alert)
                    generated_or_resolved.append(active_alert)

        return generated_or_resolved
