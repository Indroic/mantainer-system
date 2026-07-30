"""planificador/almacen roles, notifications, solvencies, maintenance plans, failure category

Cubre los cambios de esquema de la refactorización:
  · Renombrado del rol "Administrador" a "Planificador" en ``user_metadata``.
  · Notificaciones dirigidas (spec 2.2 / 3.1 / 3.2 / 3.3).
  · Solvencias de Repuestos con numeración interna secuencial (spec 3.3).
  · Planes de mantenimiento preventivo por componente/uso (spec 5.2).
  · Clasificación de fallas y descripción del trabajo realizado (spec 4.1 / 5.1).

Revision ID: 9c41ad7be5f2
Revises: 378e3387584e
Create Date: 2026-07-29 10:12:44.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9c41ad7be5f2"
down_revision: Union[str, Sequence[str], None] = "378e3387584e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ======================================================================
    # 1. Notificaciones dirigidas
    # ======================================================================
    op.create_table(
        "notifications",
        sa.Column("recipient_user_id", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False, server_default="INFO"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("link", sa.String(length=255), nullable=True),
        sa.Column("related_entity_id", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_notifications_recipient_user_id"),
        "notifications",
        ["recipient_user_id"],
        unique=False,
    )
    # La bandeja se consulta siempre como "no leídas de este usuario".
    op.create_index(
        "notifications_recipient_unread_idx",
        "notifications",
        ["recipient_user_id", "is_read"],
        unique=False,
    )

    # ======================================================================
    # 2. Solvencias de Repuestos
    # ======================================================================
    op.create_table(
        "spare_part_solvencies",
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("maintenance_order_id", sa.UUID(), nullable=False),
        sa.Column("machine_id", sa.UUID(), nullable=False),
        sa.Column("machine_code", sa.String(length=50), nullable=True),
        sa.Column("issued_by", sa.String(length=255), nullable=False),
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default="PENDIENTE_DESPACHO",
        ),
        sa.Column("dispatched_by", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["maintenance_order_id"], ["maintenance_orders.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["machine_id"], ["machines.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    # El folio es único a nivel de BD: dos emisiones concurrentes no pueden
    # compartir numeración.
    op.create_index(
        op.f("ix_spare_part_solvencies_code"), "spare_part_solvencies", ["code"], unique=True
    )
    op.create_index(
        op.f("ix_spare_part_solvencies_maintenance_order_id"),
        "spare_part_solvencies",
        ["maintenance_order_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_spare_part_solvencies_machine_id"),
        "spare_part_solvencies",
        ["machine_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_spare_part_solvencies_status"),
        "spare_part_solvencies",
        ["status"],
        unique=False,
    )

    op.create_table(
        "solvency_items",
        sa.Column("solvency_id", sa.UUID(), nullable=False),
        sa.Column("spare_part_id", sa.UUID(), nullable=False),
        sa.Column("spare_part_code", sa.String(length=50), nullable=False),
        sa.Column("spare_part_name", sa.String(length=100), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit_cost", sa.Float(), nullable=False, server_default="0"),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["solvency_id"], ["spare_part_solvencies.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_solvency_items_spare_part_id"),
        "solvency_items",
        ["spare_part_id"],
        unique=False,
    )

    # ======================================================================
    # 3. Planes de mantenimiento preventivo por componente / uso
    # ======================================================================
    op.create_table(
        "maintenance_plans",
        sa.Column("machine_id", sa.UUID(), nullable=False),
        sa.Column("spare_part_id", sa.UUID(), nullable=True),
        sa.Column("component_name", sa.String(length=150), nullable=False),
        sa.Column("basis", sa.String(length=20), nullable=False, server_default="USO"),
        sa.Column("interval_value", sa.Float(), nullable=False),
        sa.Column("last_service_value", sa.Float(), nullable=False, server_default="0"),
        sa.Column("warning_threshold", sa.Float(), nullable=False, server_default="50"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["machine_id"], ["machines.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_maintenance_plans_machine_id"),
        "maintenance_plans",
        ["machine_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_maintenance_plans_spare_part_id"),
        "maintenance_plans",
        ["spare_part_id"],
        unique=False,
    )

    # ======================================================================
    # 4. Alertas: origen en un plan preventivo
    # ======================================================================
    op.add_column("alerts", sa.Column("maintenance_plan_id", sa.UUID(), nullable=True))
    op.create_index(
        op.f("ix_alerts_maintenance_plan_id"),
        "alerts",
        ["maintenance_plan_id"],
        unique=False,
    )

    # ======================================================================
    # 5. Órdenes de trabajo: clasificación de falla, trabajo realizado y autor
    # ======================================================================
    op.add_column(
        "maintenance_orders",
        sa.Column("failure_category", sa.String(length=50), nullable=True),
    )
    op.create_index(
        op.f("ix_maintenance_orders_failure_category"),
        "maintenance_orders",
        ["failure_category"],
        unique=False,
    )
    op.add_column("maintenance_orders", sa.Column("work_performed", sa.Text(), nullable=True))
    op.add_column(
        "maintenance_orders",
        sa.Column("created_by", sa.String(length=255), nullable=True),
    )

    # ======================================================================
    # 6. Datos: "Administrador" pasa a llamarse "Planificador"
    #
    # `user_metadata.role` guarda la etiqueta del dominio. La tabla `user` de
    # Better Auth (misma BD, esquema propiedad de Drizzle) se migra aparte con
    # `pnpm db:auth:sync`, para no cruzar la frontera de propiedad del esquema.
    # ======================================================================
    op.execute(
        "UPDATE user_metadata SET role = 'Planificador' "
        "WHERE role IN ('Administrador', 'admin', 'ADMIN', 'ADMINISTRADOR')"
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Revertimos el renombrado del rol.
    op.execute(
        "UPDATE user_metadata SET role = 'Administrador' WHERE role = 'Planificador'"
    )

    op.drop_column("maintenance_orders", "created_by")
    op.drop_column("maintenance_orders", "work_performed")
    op.drop_index(
        op.f("ix_maintenance_orders_failure_category"), table_name="maintenance_orders"
    )
    op.drop_column("maintenance_orders", "failure_category")

    op.drop_index(op.f("ix_alerts_maintenance_plan_id"), table_name="alerts")
    op.drop_column("alerts", "maintenance_plan_id")

    op.drop_index(
        op.f("ix_maintenance_plans_spare_part_id"), table_name="maintenance_plans"
    )
    op.drop_index(op.f("ix_maintenance_plans_machine_id"), table_name="maintenance_plans")
    op.drop_table("maintenance_plans")

    op.drop_index(op.f("ix_solvency_items_spare_part_id"), table_name="solvency_items")
    op.drop_table("solvency_items")

    op.drop_index(
        op.f("ix_spare_part_solvencies_status"), table_name="spare_part_solvencies"
    )
    op.drop_index(
        op.f("ix_spare_part_solvencies_machine_id"), table_name="spare_part_solvencies"
    )
    op.drop_index(
        op.f("ix_spare_part_solvencies_maintenance_order_id"),
        table_name="spare_part_solvencies",
    )
    op.drop_index(op.f("ix_spare_part_solvencies_code"), table_name="spare_part_solvencies")
    op.drop_table("spare_part_solvencies")

    op.drop_index("notifications_recipient_unread_idx", table_name="notifications")
    op.drop_index(op.f("ix_notifications_recipient_user_id"), table_name="notifications")
    op.drop_table("notifications")
