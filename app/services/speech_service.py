from __future__ import annotations

from app.config import Config
from app.services.openai_client import build_openai_client


def build_speech_audio(answer_text: str) -> bytes:
    cleaned_text = (answer_text or "").strip()
    if not cleaned_text:
        raise ValueError("No hay texto para convertir en audio.")

    client = build_openai_client()
    speech = client.audio.speech.create(
        model=Config.TTS_MODEL,
        voice=Config.TTS_VOICE,
        input=cleaned_text[:4096],
        response_format="mp3",
    )
    return speech.read()
