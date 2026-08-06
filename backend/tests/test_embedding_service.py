from unittest.mock import AsyncMock, patch

import pytest

from services.embedding_service import EmbeddingService


@pytest.mark.asyncio
async def test_embed_text_empty() -> None:
    service = EmbeddingService()
    result = await service.embed_text("")
    assert result is None

    result_whitespace = await service.embed_text("   ")
    assert result_whitespace is None


@pytest.mark.asyncio
async def test_embed_text_success() -> None:
    service = EmbeddingService()
    fake_vector = [0.1] * 768

    with patch(
        "services.embedding_service.asyncio.to_thread", new_callable=AsyncMock
    ) as mock_to_thread:
        mock_to_thread.return_value = fake_vector

        result = await service.embed_text("Hello world test text")

    assert result == fake_vector
    mock_to_thread.assert_awaited_once()


@pytest.mark.asyncio
async def test_embed_text_error_returns_none() -> None:
    service = EmbeddingService()

    with patch(
        "services.embedding_service.asyncio.to_thread", new_callable=AsyncMock
    ) as mock_to_thread:
        mock_to_thread.side_effect = Exception("Ollama connection failed")

        result = await service.embed_text("Hello world")

    assert result is None
