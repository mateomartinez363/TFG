from __future__ import annotations

from typing import Iterable

from openai import APIError, OpenAI, RateLimitError

from app.config import Config
from app.services.openai_client import build_openai_client


def generate_embeddings(
    texts: Iterable[str],
    client: OpenAI,
    model: str,
    dimensions: int,
) -> list[list[float]]:
    inputs = list(texts)
    if not inputs:
        return []

    try:
        response = client.embeddings.create(
            model=model,
            input=inputs,
            encoding_format="float",
            dimensions=dimensions,
        )
    except RateLimitError as exc:
        raise RuntimeError(
            "OpenAI devolvio insufficient_quota o un limite de uso. "
            "Revisa la cuota y la facturacion de la API key."
        ) from exc
    except APIError as exc:
        raise RuntimeError(f"Error de OpenAI al generar embeddings: {exc}") from exc

    return [item.embedding for item in response.data]
