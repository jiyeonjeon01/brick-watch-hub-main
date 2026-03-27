"""Training sessions and logs tables

Revision ID: 002
Revises: 001
Create Date: 2025-03-16

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "training_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("target_type", sa.String(50), server_default="breakout"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "training_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("step", sa.Integer(), nullable=False),
        sa.Column("episode", sa.Integer(), nullable=False),
        sa.Column("reward", sa.Numeric(10, 4), nullable=False),
        sa.Column("loss", sa.Numeric(10, 6), nullable=False),
        sa.Column("epsilon", sa.Numeric(5, 4), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["session_id"], ["training_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_training_logs_session_id"), "training_logs", ["session_id"])
    op.create_index(op.f("ix_training_logs_created_at"), "training_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_training_logs_created_at"), "training_logs")
    op.drop_index(op.f("ix_training_logs_session_id"), "training_logs")
    op.drop_table("training_logs")
    op.drop_table("training_sessions")
