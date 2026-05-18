from __future__ import annotations

from dataclasses import dataclass
import re

from app.config import Config
from app.extensions import db
from app.models import SemanticChunk
from app.services.embedding_service import generate_embeddings
from app.services.openai_client import build_openai_client


@dataclass(slots=True)
class RetrievedChunk:
    id: int
    source_type: str
    source_id: int
    source_label: str | None
    chunk_key: str
    content: str
    chunk_metadata: dict
    distance: float


@dataclass(slots=True)
class QueryHints:
    preferred_sources: set[str]
    require_gluten_free: bool
    require_vegan: bool
    require_organic: bool
    wants_breakfast: bool


def extract_query_hints(question: str) -> QueryHints:
    text = question.lower()
    preferred_sources: set[str] = set()

    if re.search(r"\bpedido|\bpedidos", text):
        preferred_sources.add("order")
    if re.search(r"\benvio|\benvios|\btransito|\bseguimiento", text):
        preferred_sources.add("shipment")
    if re.search(r"\bproducto|\bproductos|\bcatalogo|\bdesayun", text):
        preferred_sources.add("product")

    return QueryHints(
        preferred_sources=preferred_sources,
        require_gluten_free="sin gluten" in text,
        require_vegan="vegano" in text or "vegana" in text,
        require_organic="ecologico" in text or "ecologica" in text or "bio" in text,
        wants_breakfast="desayun" in text,
    )


def build_query_embedding(question: str) -> list[float]:
    client = build_openai_client()
    vectors = generate_embeddings(
        texts=[question],
        client=client,
        model=Config.EMBEDDING_MODEL,
        dimensions=Config.EMBEDDING_DIMENSIONS,
    )
    return vectors[0]


def score_chunk(chunk: SemanticChunk, distance_value: float, hints: QueryHints) -> float:
    score = float(distance_value)
    metadata = chunk.chunk_metadata or {}

    if hints.preferred_sources:
        if chunk.source_type in hints.preferred_sources:
            score -= 0.08
        else:
            score += 0.08

    if chunk.source_type == "product":
        if hints.require_gluten_free and not metadata.get("is_gluten_free", False):
            score += 0.18
        if hints.require_vegan and not metadata.get("is_vegan", False):
            score += 0.15
        if hints.require_organic and not metadata.get("is_organic", False):
            score += 0.12
        if hints.wants_breakfast and "desayuno" in chunk.content.lower():
            score -= 0.05

    if chunk.source_type == "order" and "order" not in hints.preferred_sources and hints.preferred_sources:
        score += 0.03

    if chunk.source_type == "shipment" and "shipment" not in hints.preferred_sources and hints.preferred_sources:
        score += 0.03

    return score


def search_semantic_chunks(question: str, top_k: int = 5) -> list[RetrievedChunk]:
    query_embedding = build_query_embedding(question)
    hints = extract_query_hints(question)
    distance = SemanticChunk.embedding.cosine_distance(query_embedding)

    rows = (
        db.session.query(SemanticChunk, distance.label("distance"))
        .filter(SemanticChunk.embedding.is_not(None))
        .order_by(distance)
        .limit(max(top_k * 3, 10))
        .all()
    )

    ranked_rows = sorted(
        rows,
        key=lambda row: score_chunk(row[0], row[1], hints),
    )[:top_k]

    return [
        RetrievedChunk(
            id=chunk.id,
            source_type=chunk.source_type,
            source_id=chunk.source_id,
            source_label=chunk.source_label,
            chunk_key=chunk.chunk_key,
            content=chunk.content,
            chunk_metadata=chunk.chunk_metadata,
            distance=float(distance_value),
        )
        for chunk, distance_value in ranked_rows
    ]


def build_context_block(chunks: list[RetrievedChunk]) -> str:
    lines: list[str] = []

    for index, chunk in enumerate(chunks, start=1):
        label = chunk.source_label or f"{chunk.source_type}-{chunk.source_id}"
        lines.append(
            f"[{index}] {chunk.source_type}:{label}\n"
            f"{chunk.content}"
        )

    return "\n\n".join(lines)
