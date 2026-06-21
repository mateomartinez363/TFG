from __future__ import annotations

from io import BytesIO
import unicodedata

from app.config import Config
from app.services.openai_client import build_openai_client

INVALID_TRANSCRIPTS = {
    "subtitulos realizados por la comunidad de amara.org",
    "subtitulos por la comunidad de amara.org",
    "si el audio no se entiende devuelve solo la transcripcion mas literal posible",
}


def normalize_transcript(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(normalized.casefold().split())


def transcribe_audio_bytes(
    audio_bytes: bytes,
    *,
    filename: str = "consulta.webm",
    mime_type: str | None = None,
) -> str:
    if not audio_bytes:
        raise ValueError("No se ha recibido ningun audio para transcribir.")

    client = build_openai_client()
    audio_file = BytesIO(audio_bytes)
    audio_file.name = filename

    transcription = client.audio.transcriptions.create(
        model=Config.TRANSCRIPTION_MODEL,
        file=audio_file,
        language="es",
    )

    text = getattr(transcription, "text", "") or ""
    if not text.strip():
        raise RuntimeError("No se ha podido extraer texto del audio enviado.")

    cleaned_text = text.strip()
    if normalize_transcript(cleaned_text) in INVALID_TRANSCRIPTS:
        raise RuntimeError("La transcripcion de audio ha fallado. Repite la grabacion y habla un poco mas cerca del microfono.")

    return cleaned_text
