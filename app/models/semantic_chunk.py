from pgvector.sqlalchemy import Vector

from app.extensions import db


class SemanticChunk(db.Model):
    __tablename__ = "semantic_chunks"
    __table_args__ = (
        db.UniqueConstraint(
            "source_type",
            "source_id",
            "chunk_key",
            name="uq_semantic_chunk_source_key",
        ),
        db.Index("ix_semantic_chunks_source", "source_type", "source_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    source_type = db.Column(db.String(50), nullable=False)
    source_id = db.Column(db.Integer, nullable=False)
    source_label = db.Column(db.String(255), nullable=True)
    chunk_key = db.Column(db.String(80), nullable=False)
    content = db.Column(db.Text, nullable=False)
    chunk_metadata = db.Column(db.JSON, nullable=False, default=dict)
    embedding = db.Column(Vector(1536), nullable=True)
    embedding_model = db.Column(db.String(120), nullable=True)
    embedded_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.now(),
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.now(),
        onupdate=db.func.now(),
    )
