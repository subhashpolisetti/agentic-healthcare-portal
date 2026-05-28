import os
from pydantic_settings import BaseSettings

# APP_ENV=local (default) → loads .env.local
# APP_ENV=prod            → loads .env.prod
_env = os.getenv("APP_ENV", "local")
_env_file = f".env.{_env}" if os.path.exists(f".env.{_env}") else ".env"


class Settings(BaseSettings):
    # ChromaDB
    chroma_tenant: str
    chroma_database: str
    chroma_api_key: str
    collection_name: str = "doctors_nppes"
    patient_collection_name: str = "patient_cases"

    # Groq LLM
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # Embedding model (local, free)
    embedding_model: str = "all-MiniLM-L6-v2"

    # Spring Boot URL — AI service calls back to Spring Boot for status updates
    spring_boot_url: str = "http://localhost:8080"

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:8080"

    class Config:
        env_file = _env_file
        extra = "ignore"


settings = Settings()
