import os

from dotenv import load_dotenv

load_dotenv()


def build_database_url() -> str:
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("POSTGRES_DB", "elnaranjo")
    user = os.getenv("POSTGRES_USER", "elnaranjo")
    password = os.getenv("POSTGRES_PASSWORD", "elnaranjo")

    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{database}"


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", build_database_url())
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    EMBEDDING_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "1536"))
    RESPONSE_MODEL = os.getenv("RESPONSE_MODEL", "gpt-4.1-mini")
