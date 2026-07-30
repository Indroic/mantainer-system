"""Estado de la flota expresado en porcentajes (spec 4.3).

El dashboard muestra en tiempo real qué proporción de la flota está Activa, En
Mantenimiento o Fuera de Servicio. El cálculo vive en el backend para que la
misma cifra alimente la tarjeta del dashboard y las exportaciones.
"""

from sqlalchemy import func, select
from hexcore.application.use_cases.base import UseCase
from hexcore.infrastructure.uow import SqlAlchemyUnitOfWork
from src.features.machine.domain.entities import MachineStatus
from src.features.machine.infrastructure.models import MachineModel
from src.features.reports.application.dtos import (
    FleetStatusResponse,
    FleetStatusSlice,
)

#: Estados que componen el gráfico, en el orden en que se muestran.
FLEET_STATUS_LABELS: list[tuple[MachineStatus, str]] = [
    (MachineStatus.ACTIVA, "Activas"),
    (MachineStatus.EN_MANTENIMIENTO, "En Mantenimiento"),
    (MachineStatus.FUERA_DE_SERVICIO, "Fuera de Servicio"),
]


class GetFleetStatusUseCase(UseCase[None, FleetStatusResponse]):
    def __init__(self, uow: SqlAlchemyUnitOfWork) -> None:
        self.uow = uow

    async def execute(self, command: None = None) -> FleetStatusResponse:
        async with self.uow:
            # Las máquinas dadas de baja no forman parte de la flota operativa,
            # así que no entran en el denominador de los porcentajes.
            stmt = (
                select(MachineModel.status, func.count())
                .where(
                    MachineModel.is_active == True,  # noqa: E712
                    MachineModel.status != MachineStatus.DADA_DE_BAJA.value,
                )
                .group_by(MachineModel.status)
            )
            result = await self.uow.session.execute(stmt)
            counts = {row[0]: int(row[1] or 0) for row in result.all()}

        total = sum(counts.values())
        slices = [
            FleetStatusSlice(
                status=status.value,
                label=label,
                count=counts.get(status.value, 0),
                percentage=(
                    round((counts.get(status.value, 0) / total) * 100, 1) if total else 0.0
                ),
            )
            for status, label in FLEET_STATUS_LABELS
        ]

        return FleetStatusResponse(total_machines=total, slices=slices)
