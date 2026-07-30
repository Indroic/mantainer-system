"""add solvency_type column to spare_part_solvencies

Revision ID: e7f4a2c1b8d3
Revises: d9c3f10b2a5e
Create Date: 2026-07-30 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e7f4a2c1b8d3"
down_revision: Union[str, Sequence[str], None] = "d9c3f10b2a5e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "spare_part_solvencies",
        sa.Column("solvency_type", sa.String(20), nullable=False, server_default="ASIGNACION"),
    )
    op.create_index("ix_spare_part_solvencies_solvency_type", "spare_part_solvencies", ["solvency_type"])


def downgrade() -> None:
    op.drop_index("ix_spare_part_solvencies_solvency_type", table_name="spare_part_solvencies")
    op.drop_column("spare_part_solvencies", "solvency_type")
