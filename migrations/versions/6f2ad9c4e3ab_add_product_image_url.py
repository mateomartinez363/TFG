"""Add product image url

Revision ID: 6f2ad9c4e3ab
Revises: b5c4a3e2d111
Create Date: 2026-06-20 13:35:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "6f2ad9c4e3ab"
down_revision = "b5c4a3e2d111"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("products", sa.Column("image_url", sa.String(length=255), nullable=True))


def downgrade():
    op.drop_column("products", "image_url")
