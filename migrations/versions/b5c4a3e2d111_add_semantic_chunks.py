"""Add semantic chunks

Revision ID: b5c4a3e2d111
Revises: 055ca1596306
Create Date: 2026-05-12 12:00:00.000000

"""

from alembic import op
from pgvector.sqlalchemy import Vector
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b5c4a3e2d111"
down_revision = "055ca1596306"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "semantic_chunks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("source_label", sa.String(length=255), nullable=True),
        sa.Column("chunk_key", sa.String(length=80), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("chunk_metadata", sa.JSON(), nullable=False),
        sa.Column("embedding", Vector(dim=1536), nullable=True),
        sa.Column("embedding_model", sa.String(length=120), nullable=True),
        sa.Column("embedded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_type",
            "source_id",
            "chunk_key",
            name="uq_semantic_chunk_source_key",
        ),
    )
    op.create_index(
        "ix_semantic_chunks_source",
        "semantic_chunks",
        ["source_type", "source_id"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_semantic_chunks_source", table_name="semantic_chunks")
    op.drop_table("semantic_chunks")
