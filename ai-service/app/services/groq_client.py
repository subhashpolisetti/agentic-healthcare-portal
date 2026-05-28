from collections.abc import Generator

from groq import Groq
from app.core.config import settings

_client = None


def get_groq_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def chat(system_prompt: str, user_message: str, max_tokens: int = 1024) -> str:
    response = get_groq_client().chat.completions.create(
        model=settings.groq_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        max_tokens=max_tokens,
        temperature=0.3,
        timeout=30.0,
    )
    return response.choices[0].message.content or ""


def chat_stream(
    system_prompt: str, user_message: str, max_tokens: int = 150
) -> Generator[str, None, None]:
    """Yields raw text tokens from Groq streaming API as they arrive."""
    stream = get_groq_client().chat.completions.create(
        model=settings.groq_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        max_tokens=max_tokens,
        temperature=0.3,
        stream=True,
        timeout=30.0,
    )
    for chunk in stream:
        token = chunk.choices[0].delta.content or ""
        if token:
            yield token
