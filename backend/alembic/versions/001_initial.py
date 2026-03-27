"""Initial schema

Revision ID: 001
Revises:
Create Date: 2025-03-16

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Initial schema: add tables as needed
    pass


def downgrade() -> None:
    pass
