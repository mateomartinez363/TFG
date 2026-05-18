from openai import OpenAI

from app.config import Config


def build_openai_client(config: type[Config] = Config) -> OpenAI:
    if not config.OPENAI_API_KEY or config.OPENAI_API_KEY == "replace-me":
        raise ValueError("OPENAI_API_KEY no esta configurada con un valor real.")

    return OpenAI(api_key=config.OPENAI_API_KEY)
