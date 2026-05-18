from __future__ import annotations

from openai import APIError, RateLimitError

from app.config import Config
from app.services.openai_client import build_openai_client


def build_answer(question: str, context: str) -> str:
    client = build_openai_client()

    system_prompt = (
        "Eres el asistente de El Naranjo, una tienda de alimentacion natural. "
        "Responde en espanol de forma clara, breve y fiel al contexto recuperado. "
        "No inventes datos que no aparezcan en el contexto. "
        "Si el contexto es insuficiente, dilo explicitamente. "
        "Prioriza la precision sobre sonar convincente. "
        "Cuando afirmes algo concreto, apoyalote en referencias como [1], [2] segun el contexto recibido. "
        "Si hay resultados parcialmente relevantes pero no exactos, distinguelos de los exactos."
    )

    user_prompt = (
        f"Pregunta del usuario:\n{question}\n\n"
        f"Contexto recuperado:\n{context}\n\n"
        "Redacta una respuesta util para el usuario basandote solo en ese contexto. "
        "Formato deseado: 1 o 2 parrafos cortos. "
        "No menciones datos que no aparezcan en los fragmentos."
    )

    try:
        response = client.responses.create(
            model=Config.RESPONSE_MODEL,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
    except RateLimitError as exc:
        raise RuntimeError(
            "OpenAI devolvio un limite de uso al generar la respuesta. "
            "Revisa la cuota o espera antes de reintentar."
        ) from exc
    except APIError as exc:
        raise RuntimeError(f"Error de OpenAI al generar la respuesta: {exc}") from exc

    return response.output_text.strip()
