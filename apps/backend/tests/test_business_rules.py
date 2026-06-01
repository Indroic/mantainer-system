import pytest
from src.features.inventory.domain.entities import SparePart
from src.features.inventory.domain.exceptions import SparePartNegativeStockException
from src.features.inventory.infrastructure.repositories import SparePartRepository
from src.features.machine.domain.entities import Machine, MachineStatus
from src.features.machine.domain.exceptions import (
    MachineInvalidHorometerException,
    MachineIsReadOnlyException,
)
from src.features.machine.infrastructure.repositories import MachineRepository
from src.features.maintenance.domain.services import MaintenanceDomainService
from src.features.maintenance.infrastructure.repositories import (
    MaintenanceOrderRepository,
)
from src.features.user.domain.entities import UserMetadata, UserRole
from src.features.user.infrastructure.repositories import UserRepository


@pytest.mark.asyncio
async def test_machine_horometer_incremental():
    """Valida que el horómetro de una máquina solo se pueda incrementar."""
    machine = Machine(
        code="CAT-320",
        motor_serial="SERIAL-123",
        brand="Caterpillar",
        model="320D",
        manufacture_year=2020,
        current_horometer=100.0,
    )

    # Permitido incrementar
    machine.update_horometer(105.5)
    assert machine.current_horometer == 105.5

    # Prohibido disminuir
    with pytest.raises(MachineInvalidHorometerException):
        machine.update_horometer(90.0)


@pytest.mark.asyncio
async def test_machine_dada_de_baja_is_read_only():
    """Valida que si una máquina está DADA_DE_BAJA, sea de solo lectura."""
    machine = Machine(
        code="CAT-320",
        motor_serial="SERIAL-123",
        brand="Caterpillar",
        model="320D",
        manufacture_year=2020,
        current_horometer=100.0,
        status=MachineStatus.DADA_DE_BAJA,
    )

    # Prohibido modificar horómetro
    with pytest.raises(MachineIsReadOnlyException):
        machine.update_horometer(120.0)

    # Prohibido cambiar de estado
    with pytest.raises(MachineIsReadOnlyException):
        machine.change_status(MachineStatus.ACTIVA)


@pytest.mark.asyncio
async def test_spare_part_negative_stock():
    """Valida que el stock físico de un repuesto no pueda ser negativo."""
    # Intentar instanciar con stock negativo debe fallar
    with pytest.raises(SparePartNegativeStockException):
        SparePart(
            code="FIL-001",
            name="Filtro de Aceite",
            stock_minimum=5,
            unit_cost=25.0,
            stock_current=-2,
        )

    part = SparePart(
        code="FIL-001",
        name="Filtro de Aceite",
        stock_minimum=5,
        unit_cost=25.0,
        stock_current=10,
    )

    # Disminución permitida
    part.decrease_stock(4)
    assert part.stock_current == 6

    # Disminución prohibida (excede stock)
    with pytest.raises(SparePartNegativeStockException):
        part.decrease_stock(10)


@pytest.mark.asyncio
async def test_maintenance_order_liquidate_acid_transaction(test_uow):
    """Prueba de integración: Valida la liquidación exitosa de una orden de trabajo.

    Verifica el almacenamiento del costo histórico de repuestos, cálculo de próximo 
    servicio y retorno de la máquina a estado ACTIVA.
    """
    async with test_uow:
        # 1. Configuramos los datos de prueba
        machine_repo = MachineRepository(test_uow)
        user_repo = UserRepository(test_uow)
        part_repo = SparePartRepository(test_uow)
        order_repo = MaintenanceOrderRepository(test_uow)

        # Crear y guardar máquina
        machine = Machine(
            code="CAT-320",
            motor_serial="SERIAL-123",
            brand="Caterpillar",
            model="320D",
            manufacture_year=2020,
            current_horometer=100.0,
        )
        await machine_repo.save(machine)

        # Crear y guardar técnico
        mechanic = UserMetadata(
            better_auth_user_id="auth-tech-1",
            role=UserRole.MECANICO,
            hourly_rate=50.0,
        )
        await user_repo.save(mechanic)

        # Crear y guardar repuestos
        part1 = SparePart(
            code="FIL-001",
            name="Filtro de Aceite",
            stock_minimum=2,
            unit_cost=30.0,
            stock_current=10,
        )
        part2 = SparePart(
            code="FIL-002",
            name="Filtro de Aire",
            stock_minimum=2,
            unit_cost=40.0,
            stock_current=5,
        )
        await part_repo.save(part1)
        await part_repo.save(part2)

        # 2. Inicializamos el servicio de mantenimiento
        service = MaintenanceDomainService(
            maintenance_repo=order_repo,
            machine_repo=machine_repo,
            spare_part_repo=part_repo,
            user_metadata_repo=user_repo,
        )

        # Programamos orden de trabajo
        order = await service.create_order(
            machine_id=machine.id,
            description="Mantenimiento de 100 horas",
            assigned_mechanic_id=mechanic.id,
        )

        # Iniciamos la orden (máquina pasa a EN_MANTENIMIENTO)
        await service.start_execution(order.id)

        # Asociamos repuestos
        await service.add_spare_part(order.id, part1.id, 2)  # Requiere 2 Filtros de Aceite
        await service.add_spare_part(order.id, part2.id, 1)  # Requiere 1 Filtro de Aire

        await test_uow.commit()

    # 3. Liquidamos la orden
    async with test_uow:
        # Recargamos repositorios en nueva transacción
        machine_repo = MachineRepository(test_uow)
        user_repo = UserRepository(test_uow)
        part_repo = SparePartRepository(test_uow)
        order_repo = MaintenanceOrderRepository(test_uow)

        service = MaintenanceDomainService(
            maintenance_repo=order_repo,
            machine_repo=machine_repo,
            spare_part_repo=part_repo,
            user_metadata_repo=user_repo,
        )

        # Ejecutamos liquidación (sin horas hombre)
        order_liquidated = await service.liquidate_order(order.id)
        await test_uow.commit()

    # 4. Verificaciones
    async with test_uow:
        assert order_liquidated.status == "LIQUIDADO"
        # Próximo servicio: 100h (horómetro máquina) + 250h = 350h
        assert order_liquidated.next_service_horometer == 350.0

        # Validar reducción física de stock en inventario
        sp1 = await part_repo.get_by_id(part1.id)
        sp2 = await part_repo.get_by_id(part2.id)
        assert sp1.stock_current == 8  # 10 - 2 = 8
        assert sp2.stock_current == 4  # 5 - 1 = 4

        # Validar que los costos unitarios históricos se guardaron en la orden
        assert order_liquidated.spare_parts[0].unit_cost_at_time == 30.0
        assert order_liquidated.spare_parts[1].unit_cost_at_time == 40.0

        # Validar que la máquina volvió a estado ACTIVA
        m = await machine_repo.get_by_id(machine.id)
        assert m.status == MachineStatus.ACTIVA


@pytest.mark.asyncio
async def test_maintenance_order_liquidate_insufficient_stock_rollback(test_uow):
    """Prueba de integración: Valida la transacción ACID al fallar por stock insuficiente.

    Si un repuesto no tiene suficiente stock al liquidar la OT, debe fallar
    completo y ningún repuesto debe descontarse (rollback).
    """
    async with test_uow:
        machine_repo = MachineRepository(test_uow)
        user_repo = UserRepository(test_uow)
        part_repo = SparePartRepository(test_uow)
        order_repo = MaintenanceOrderRepository(test_uow)

        machine = Machine(
            code="CAT-320",
            motor_serial="SERIAL-123",
            brand="Caterpillar",
            model="320D",
            manufacture_year=2020,
            current_horometer=100.0,
        )
        await machine_repo.save(machine)

        mechanic = UserMetadata(
            better_auth_user_id="auth-tech-1",
            role=UserRole.MECANICO,
            hourly_rate=50.0,
        )
        await user_repo.save(mechanic)

        # Repuesto con stock suficiente
        part_ok = SparePart(
            code="FIL-001",
            name="Filtro de Aceite",
            stock_minimum=2,
            unit_cost=30.0,
            stock_current=10,
        )
        # Repuesto con stock INSUFICIENTE (requiere 5 pero hay 2)
        part_fail = SparePart(
            code="FIL-002",
            name="Filtro de Aire",
            stock_minimum=2,
            unit_cost=40.0,
            stock_current=2,
        )
        await part_repo.save(part_ok)
        await part_repo.save(part_fail)

        service = MaintenanceDomainService(
            maintenance_repo=order_repo,
            machine_repo=machine_repo,
            spare_part_repo=part_repo,
            user_metadata_repo=user_repo,
        )

        order = await service.create_order(
            machine_id=machine.id,
            description="Mantenimiento",
            assigned_mechanic_id=mechanic.id,
        )
        await service.start_execution(order.id)
        await service.add_spare_part(order.id, part_ok.id, 2)
        await service.add_spare_part(order.id, part_fail.id, 5)  # ¡Causará excepción!

        await test_uow.commit()

    # Liquidamos la orden (debe fallar)
    async with test_uow:
        machine_repo = MachineRepository(test_uow)
        user_repo = UserRepository(test_uow)
        part_repo = SparePartRepository(test_uow)
        order_repo = MaintenanceOrderRepository(test_uow)

        service = MaintenanceDomainService(
            maintenance_repo=order_repo,
            machine_repo=machine_repo,
            spare_part_repo=part_repo,
            user_metadata_repo=user_repo,
        )

        with pytest.raises(SparePartNegativeStockException):
            try:
                await service.liquidate_order(order.id)
            except Exception as e:
                await test_uow.rollback()
                raise e


    # Verificamos que se hizo rollback completo de los stocks
    async with test_uow:
        part_repo = SparePartRepository(test_uow)
        sp_ok = await part_repo.get_by_id(part_ok.id)
        sp_fail = await part_repo.get_by_id(part_fail.id)

        # Los stocks deben permanecer intactos debido a la transacción ACID
        assert sp_ok.stock_current == 10  # Sin cambios
        assert sp_fail.stock_current == 2  # Sin cambios


@pytest.mark.asyncio
async def test_audit_log_immutability(test_uow):
    """Valida la inmutabilidad de la bitácora de auditoría.

    Cualquier intento de UPDATE o DELETE sobre AuditLogModel debe arrojar
    un PermissionError de manera física.
    """
    from src.features.audit.infrastructure.models import AuditLogModel
    from src.features.audit.infrastructure.repositories import AuditLogRepository
    from src.features.audit.domain.entities import AuditLog
    from uuid import uuid4

    async with test_uow:
        audit_repo = AuditLogRepository(test_uow)
        log = AuditLog(
            entity_name="Test",
            entity_id=uuid4(),
            action="TEST_ACTION",
            payload={"foo": "bar"},
            performed_by="tester"
        )
        await audit_repo.save(log)
        await test_uow.commit()

    # Intentar modificar el registro creado (UPDATE)
    async with test_uow:
        # Recuperamos directamente usando SQLAlchemy
        from sqlalchemy import select
        stmt = select(AuditLogModel).where(AuditLogModel.entity_name == "Test")
        result = await test_uow.session.execute(stmt)
        model = result.scalar_one()

        model.action = "MUTATED"
        with pytest.raises(PermissionError) as exc_info:
            await test_uow.commit()
        assert "La bitácora de auditoría es inmutable" in str(exc_info.value)
        await test_uow.rollback()

    # Intentar eliminar el registro creado (DELETE)
    async with test_uow:
        stmt = select(AuditLogModel).where(AuditLogModel.entity_name == "Test")
        result = await test_uow.session.execute(stmt)
        model = result.scalar_one()

        await test_uow.session.delete(model)
        with pytest.raises(PermissionError) as exc_info:
            await test_uow.commit()
        assert "La bitácora de auditoría es inmutable" in str(exc_info.value)
        await test_uow.rollback()


@pytest.mark.asyncio
async def test_audit_log_generation_on_mutation(test_uow):
    """Valida que las mutaciones principales generen registros de auditoría forense."""
    from src.features.machine.application.dtos import CreateMachineCommand
    from src.features.machine.application.use_cases.create_machine import CreateMachineUseCase
    from src.features.machine.domain.services import MachineDomainService
    from src.features.machine.infrastructure.repositories import MachineRepository
    from src.features.audit.infrastructure.models import AuditLogModel
    from sqlalchemy import select

    async with test_uow:
        m_repo = MachineRepository(test_uow)
        m_service = MachineDomainService(m_repo)
        use_case = CreateMachineUseCase(m_service, test_uow)

        command = CreateMachineCommand(
            code="CAT-AUDIT",
            motor_serial="SERIAL-AUDIT",
            brand="Caterpillar",
            model="Audit-320",
            manufacture_year=2021,
            current_horometer=50.0,
            performed_by="auth-user-audit-123"
        )
        response = await use_case.execute(command)

    # Validamos que se insertó el log en la bitácora
    async with test_uow:
        stmt = select(AuditLogModel).where(
            AuditLogModel.entity_id == response.id,
            AuditLogModel.action == "CREATE"
        )
        result = await test_uow.session.execute(stmt)
        audit_records = result.scalars().all()

        assert len(audit_records) == 1
        assert audit_records[0].performed_by == "auth-user-audit-123"
        assert "CAT-AUDIT" in audit_records[0].payload
