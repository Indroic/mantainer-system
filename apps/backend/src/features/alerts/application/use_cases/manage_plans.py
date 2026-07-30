"""Casos de uso de los planes de mantenimiento preventivo por componente (spec 5.2)."""

from uuid import UUID

from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.alerts.application.dtos import (
    CreateMaintenancePlanCommand,
    MaintenancePlanResponse,
    UpdateMaintenancePlanCommand,
)
from src.features.alerts.domain.entities import MaintenancePlan
from src.features.alerts.domain.services import AlertDomainService


async def to_plan_response(
    plan: MaintenancePlan, uow: SqlAlchemyUnitOfWork
) -> MaintenancePlanResponse:
    """Hidrata el plan con el estado actual de la máquina y los valores derivados."""
    from src.features.inventory.infrastructure.repositories import SparePartRepository
    from src.features.machine.infrastructure.repositories import MachineRepository

    machine_code: str | None = None
    current_value = 0.0
    horometer_unit: str | None = None
    try:
        machine = await MachineRepository(uow).get_by_id(plan.machine_id)
        machine_code = machine.code
        current_value = float(machine.current_horometer or 0.0)
        unit = getattr(machine, "horometer_unit", None)
        horometer_unit = unit.value if hasattr(unit, "value") else (unit and str(unit))
    except Exception:
        pass

    spare_part_name: str | None = None
    if plan.spare_part_id:
        try:
            part = await SparePartRepository(uow).get_by_id(plan.spare_part_id)
            spare_part_name = f"{part.name} ({part.code})"
        except Exception:
            spare_part_name = None

    return MaintenancePlanResponse(
        id=plan.id,
        machine_id=plan.machine_id,
        machine_code=machine_code,
        spare_part_id=plan.spare_part_id,
        spare_part_name=spare_part_name,
        component_name=plan.component_name,
        basis=plan.basis,
        interval_value=plan.interval_value,
        last_service_value=plan.last_service_value,
        warning_threshold=plan.warning_threshold,
        notes=plan.notes,
        target_value=plan.target_value,
        current_value=current_value,
        remaining=plan.remaining(current_value),
        is_due=plan.is_due(current_value),
        is_overdue=plan.is_overdue(current_value),
        horometer_unit=horometer_unit,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
        is_active=plan.is_active,
    )


class CreateMaintenancePlanUseCase:
    def __init__(self, service: AlertDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(
        self, command: CreateMaintenancePlanCommand
    ) -> MaintenancePlanResponse:
        async with self.uow:
            plan = await self.service.create_plan(
                machine_id=command.machine_id,
                component_name=command.component_name,
                interval_value=command.interval_value,
                basis=command.basis,
                spare_part_id=command.spare_part_id,
                last_service_value=command.last_service_value,
                warning_threshold=command.warning_threshold,
                notes=command.notes,
            )

            await self._audit(
                plan_id=plan.id,
                action="CREATE_MAINTENANCE_PLAN",
                payload={
                    "machine_id": str(plan.machine_id),
                    "component_name": plan.component_name,
                    "basis": plan.basis.value,
                    "interval_value": plan.interval_value,
                    "last_service_value": plan.last_service_value,
                },
                performed_by=command.performed_by,
            )
            await self.uow.commit()

        return await to_plan_response(plan, self.uow)

    async def _audit(self, *, plan_id, action, payload, performed_by) -> None:
        from src.features.audit.domain.entities import AuditLog
        from src.features.audit.infrastructure.repositories import AuditLogRepository

        await AuditLogRepository(self.uow).save(
            AuditLog(
                entity_name="MaintenancePlan",
                entity_id=plan_id,
                action=action,
                payload=payload,
                performed_by=performed_by or "system",
            )
        )


class UpdateMaintenancePlanUseCase:
    def __init__(self, service: AlertDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(
        self, plan_id: UUID, command: UpdateMaintenancePlanCommand
    ) -> MaintenancePlanResponse:
        # Solo enviamos al dominio los campos realmente presentes en la petición.
        changes = {
            key: value
            for key, value in command.model_dump(exclude={"performed_by"}).items()
            if value is not None
        }

        async with self.uow:
            plan = await self.service.update_plan(plan_id, **changes)
            await self.uow.commit()

        return await to_plan_response(plan, self.uow)


class RegisterPlanServiceUseCase:
    """Registra que el servicio del componente se ejecutó y reinicia el contador."""

    def __init__(self, service: AlertDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(
        self, plan_id: UUID, performed_by: str | None = None
    ) -> MaintenancePlanResponse:
        async with self.uow:
            plan = await self.service.register_plan_service(plan_id)

            from src.features.audit.domain.entities import AuditLog
            from src.features.audit.infrastructure.repositories import (
                AuditLogRepository,
            )

            await AuditLogRepository(self.uow).save(
                AuditLog(
                    entity_name="MaintenancePlan",
                    entity_id=plan.id,
                    action="REGISTER_COMPONENT_SERVICE",
                    payload={
                        "component_name": plan.component_name,
                        "last_service_value": plan.last_service_value,
                        "next_target": plan.target_value,
                    },
                    performed_by=performed_by or "system",
                )
            )
            await self.uow.commit()

        return await to_plan_response(plan, self.uow)


class DeleteMaintenancePlanUseCase:
    def __init__(self, service: AlertDomainService, uow: SqlAlchemyUnitOfWork) -> None:
        self.service = service
        self.uow = uow

    async def execute(
        self, plan_id: UUID, performed_by: str | None = None
    ) -> MaintenancePlanResponse:
        async with self.uow:
            plan = await self.service.delete_plan(plan_id)
            await self.uow.commit()
        return await to_plan_response(plan, self.uow)
