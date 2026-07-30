"""add machine_types table, machine_type_id to machines, quantity_returned to maintenance_spare_parts

Revision ID: d9c3f10b2a5e
Revises: 9c41ad7be5f2
Create Date: 2026-07-30 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d9c3f10b2a5e"
down_revision: Union[str, Sequence[str], None] = "9c41ad7be5f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create machine_types table
    op.create_table(
        "machine_types",
        sa.Column("name", sa.String(100), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # Add quantity_returned to maintenance_spare_parts
    op.add_column(
        "maintenance_spare_parts",
        sa.Column("quantity_returned", sa.Integer(), nullable=False, server_default="0"),
    )

    # Add machine_type_id to machines
    op.add_column(
        "machines",
        sa.Column("machine_type_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_machines_machine_type_id",
        "machines",
        "machine_types",
        ["machine_type_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_machines_machine_type_id", "machines", type_="foreignkey")
    op.drop_column("machines", "machine_type_id")
    op.drop_column("maintenance_spare_parts", "quantity_returned")
    op.drop_table("machine_types")
