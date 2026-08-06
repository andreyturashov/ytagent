import asyncio
import logging

from langchain_ollama import OllamaEmbeddings

from config import EMBEDDING_MODEL, OLLAMA_BASE_URL

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Service for generating vector embeddings using OllamaEmbeddings.
    """

    def __init__(self, model_name: str | None = None, base_url: str | None = None) -> None:
        self.model_name = model_name or EMBEDDING_MODEL
        self.base_url = base_url or OLLAMA_BASE_URL
        self._embeddings = OllamaEmbeddings(
            model=self.model_name,
            base_url=self.base_url,
        )

    async def embed_text(self, text: str) -> list[float] | None:
        """
        Generate embedding for a given text string.

        Args:
            text (str): Input text to embed

        Returns:
            list[float] | None: Vector embedding (768 dimensions) or None on failure
        """
        if not text or not text.strip():
            return None

        try:
            vector = await asyncio.to_thread(self._embeddings.embed_query, text)
            return list(vector)
        except Exception as e:
            logger.error("Error generating embedding for text: %s", e)
            return None
