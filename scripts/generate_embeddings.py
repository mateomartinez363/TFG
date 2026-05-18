from __future__ import annotations

import argparse
from datetime import UTC, datetime

from app import create_app
from app.config import Config
from app.extensions import db
from app.models import SemanticChunk
from app.services.embedding_service import build_embedding_client, generate_embeddings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Genera embeddings para semantic_chunks.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenera embeddings aunque ya existan.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=25,
        help="Numero de fragmentos enviados por lote al modelo de embeddings.",
    )
    return parser.parse_args()


def load_pending_chunks(force: bool) -> list[SemanticChunk]:
    query = SemanticChunk.query.order_by(SemanticChunk.id)
    if not force:
        query = query.filter(SemanticChunk.embedding.is_(None))
    return query.all()


def chunked(items: list[SemanticChunk], batch_size: int) -> list[list[SemanticChunk]]:
    return [items[index:index + batch_size] for index in range(0, len(items), batch_size)]


def update_embeddings(force: bool, batch_size: int) -> None:
    chunks = load_pending_chunks(force=force)
    if not chunks:
        print("No hay fragmentos pendientes de vectorizar.")
        return

    client = build_embedding_client()
    total_batches = chunked(chunks, batch_size)

    for batch_number, batch in enumerate(total_batches, start=1):
        texts = [item.content for item in batch]
        vectors = generate_embeddings(
            texts=texts,
            client=client,
            model=Config.EMBEDDING_MODEL,
            dimensions=Config.EMBEDDING_DIMENSIONS,
        )

        timestamp = datetime.now(UTC)
        for semantic_chunk, vector in zip(batch, vectors, strict=True):
            semantic_chunk.embedding = vector
            semantic_chunk.embedding_model = Config.EMBEDDING_MODEL
            semantic_chunk.embedded_at = timestamp

        db.session.commit()
        print(
            f"Lote {batch_number}/{len(total_batches)} procesado "
            f"({len(batch)} fragmentos)."
        )

    embedded_count = SemanticChunk.query.filter(SemanticChunk.embedding.is_not(None)).count()
    print(f"Embeddings almacenados: {embedded_count}")


if __name__ == "__main__":
    args = parse_args()
    app = create_app()
    with app.app_context():
        update_embeddings(force=args.force, batch_size=args.batch_size)
