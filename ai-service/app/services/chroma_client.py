import chromadb
from sentence_transformers import SentenceTransformer
from app.core.config import settings

_client = None
_model = None


def get_chroma_client() -> chromadb.CloudClient:
    global _client
    if _client is None:
        _client = chromadb.CloudClient(
            tenant=settings.chroma_tenant,
            database=settings.chroma_database,
            api_key=settings.chroma_api_key,
        )
    return _client


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(settings.embedding_model)
    return _model


def embed(text: str) -> list[float]:
    return get_embedding_model().encode(text).tolist()


def get_doctors_collection():
    return get_chroma_client().get_collection(settings.collection_name)


def get_patient_cases_collection():
    return get_chroma_client().get_or_create_collection(settings.patient_collection_name)
