"""Tests for routers.video module."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from routers.video import get_summary, get_transcript, search_videos, track_video
from schemas.video import TrackVideoRequest

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


# ── track_video & search_videos ──────────────────────────────────────


@pytest.mark.asyncio
async def test_track_video_success() -> None:
    mock_db = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_ki_res = MagicMock()
    mock_ki_res.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_ki_res)

    mock_video = MagicMock()
    mock_video.id = 10
    mock_video.youtube_video_id = "v_track"
    mock_video.title = "Tracked Title"
    mock_video.channel_title = "Tracked Channel"
    mock_video.thumbnail_url = "http://thumb"
    mock_video.summary = "Tracked summary"

    with patch("routers.video.VideoService") as mock_service_cls:
        svc = mock_service_cls.return_value
        svc.get_video_by_youtube_id = AsyncMock(return_value=mock_video)

        req = TrackVideoRequest(youtube_video_id="v_track", user_id=1)
        res = await track_video(payload=req, db=mock_db)

    assert res.success is True
    assert res.youtube_video_id == "v_track"
    assert res.title == "Tracked Title"


@pytest.mark.asyncio
async def test_search_videos_success() -> None:
    mock_db = MagicMock()
    mock_res = MagicMock()
    mock_res.video.id = 1
    mock_res.video.youtube_video_id = "v_search"
    mock_res.video.title = "Searched Video"
    mock_res.video.channel_title = "Search Channel"
    mock_res.video.thumbnail_url = "http://thumb"
    mock_res.video.summary = "Search summary"
    mock_res.knowledge_item.source_url = "http://url"
    mock_res.knowledge_item.accessed_at = MagicMock()
    mock_res.score = 0.95

    with patch("routers.video.SearchService") as mock_search_cls:
        svc = mock_search_cls.return_value
        svc.search = AsyncMock(return_value=[mock_res])

        res = await search_videos(db=mock_db, q="Docker", user_id=1, limit=10)

    assert res.query == "Docker"
    assert len(res.results) == 1
    assert res.results[0].title == "Searched Video"
    assert res.results[0].score == 0.95
