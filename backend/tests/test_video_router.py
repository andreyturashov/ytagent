"""Tests for routers.video module."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from routers.video import get_summary, get_transcript

# ── get_transcript ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_transcript_success() -> None:
    """Return transcript when video transcript is found."""
    mock_db = MagicMock()

    with patch("routers.video.VideoService") as mock_service_cls:
        instance = mock_service_cls.return_value
        instance.get_or_create_transcript = AsyncMock(return_value="Sample transcript")

        res = await get_transcript(video_id="v123", db=mock_db)

    assert res == {
        "video_id": "v123",
        "transcript": "Sample transcript",
    }
    instance.get_or_create_transcript.assert_awaited_once_with("v123")


@pytest.mark.asyncio
async def test_get_transcript_not_found() -> None:
    """Raise 500 (or caught HTTPException) when transcript is not found."""
    mock_db = MagicMock()

    with patch("routers.video.VideoService") as mock_service_cls:
        instance = mock_service_cls.return_value
        instance.get_or_create_transcript = AsyncMock(return_value=None)

        with pytest.raises(HTTPException) as exc_info:
            await get_transcript(video_id="v123", db=mock_db)

        # In routers/video.py, catching Exception re-raises as 500
        assert exc_info.value.status_code in (404, 500)


@pytest.mark.asyncio
async def test_get_transcript_exception_returns_500() -> None:
    """Unexpected errors result in a 500 HTTPException."""
    mock_db = MagicMock()

    with patch("routers.video.VideoService") as mock_service_cls:
        instance = mock_service_cls.return_value
        instance.get_or_create_transcript = AsyncMock(side_effect=RuntimeError("Database error"))

        with pytest.raises(HTTPException) as exc_info:
            await get_transcript(video_id="v123", db=mock_db)

        assert exc_info.value.status_code == 500
        assert "Database error" in str(exc_info.value.detail)


# ── get_summary ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_summary_success() -> None:
    """Return summary dictionary when agent_app succeeds."""
    mock_db = MagicMock()

    with patch("routers.video.agent_app") as mock_agent:
        mock_agent.ainvoke = AsyncMock(return_value={"summary": "Video summary text"})

        res = await get_summary(video_id="v123", db=mock_db)

    assert res == {
        "video_id": "v123",
        "summary": "Video summary text",
    }
    mock_agent.ainvoke.assert_awaited_once_with({"video_id": "v123"})


@pytest.mark.asyncio
async def test_get_summary_exception_returns_500() -> None:
    """Unexpected agent execution errors result in a 500 HTTPException."""
    mock_db = MagicMock()

    with patch("routers.video.agent_app") as mock_agent:
        mock_agent.ainvoke = AsyncMock(side_effect=RuntimeError("Agent failure"))

        with pytest.raises(HTTPException) as exc_info:
            await get_summary(video_id="v123", db=mock_db)

        assert exc_info.value.status_code == 500
        assert "Agent failure" in str(exc_info.value.detail)
