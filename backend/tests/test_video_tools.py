from unittest.mock import AsyncMock, patch

import pytest

from agents.tools.video_tools import get_transcript


@pytest.mark.asyncio
async def test_get_transcript_found() -> None:
    mock_session = AsyncMock()
    mock_context = AsyncMock()
    mock_context.__aenter__ = AsyncMock(return_value=mock_session)
    mock_context.__aexit__ = AsyncMock(return_value=False)

    with (
        patch("agents.tools.video_tools.AsyncSessionLocal", return_value=mock_context),
        patch("agents.tools.video_tools.VideoService") as mock_service_cls,
    ):
        instance = mock_service_cls.return_value
        instance.get_or_create_transcript = AsyncMock(return_value="Hello world transcript")

        result = await get_transcript.ainvoke({"video_id": "vid123"})

    assert result == "Hello world transcript"
    instance.get_or_create_transcript.assert_awaited_once_with(youtube_video_id="vid123")


@pytest.mark.asyncio
async def test_get_transcript_not_found() -> None:
    mock_session = AsyncMock()
    mock_context = AsyncMock()
    mock_context.__aenter__ = AsyncMock(return_value=mock_session)
    mock_context.__aexit__ = AsyncMock(return_value=False)

    with (
        patch("agents.tools.video_tools.AsyncSessionLocal", return_value=mock_context),
        patch("agents.tools.video_tools.VideoService") as mock_service_cls,
    ):
        instance = mock_service_cls.return_value
        instance.get_or_create_transcript = AsyncMock(return_value=None)

        result = await get_transcript.ainvoke({"video_id": "missing"})

    assert result == "Transcript was not found."
