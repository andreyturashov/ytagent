from unittest.mock import AsyncMock, MagicMock

import pytest

from services.summarization_service import SummarizationService


@pytest.mark.asyncio
async def test_summarize_transcript_empty() -> None:
    service = SummarizationService()
    result = await service.summarize_transcript("")
    assert result is None

    result_whitespace = await service.summarize_transcript("   ")
    assert result_whitespace is None


@pytest.mark.asyncio
async def test_summarize_transcript_success() -> None:
    service = SummarizationService()
    mock_response = MagicMock()
    mock_response.content = "This video covers Python programming concepts and async features."

    service.llm = MagicMock()
    service.llm.ainvoke = AsyncMock(return_value=mock_response)

    result = await service.summarize_transcript(
        "Here is a long video transcript...", title="Python Basics"
    )

    assert result == "This video covers Python programming concepts and async features."
    service.llm.ainvoke.assert_awaited_once()


@pytest.mark.asyncio
async def test_summarize_transcript_error_returns_none() -> None:
    service = SummarizationService()
    service.llm = MagicMock()
    service.llm.ainvoke = AsyncMock(side_effect=Exception("LLM model timeout"))

    result = await service.summarize_transcript("Transcript content", title="Error Test")

    assert result is None
