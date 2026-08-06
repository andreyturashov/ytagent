"""Tests for services.video_service module."""

from typing import cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.video_service import VideoService

# ── Fixtures ─────────────────────────────────────────────────────────


@pytest.fixture
def session() -> MagicMock:
    s = MagicMock()
    s.add = MagicMock()
    s.flush = AsyncMock()
    s.commit = AsyncMock()
    s.refresh = AsyncMock()
    s.execute = AsyncMock()
    return s


@pytest.fixture
def service(session: MagicMock) -> VideoService:
    with patch("services.video_service.YouTubeIntegration"):
        embed_svc = MagicMock()
        embed_svc.embed_text = AsyncMock(return_value=[0.1] * 768)
        sum_svc = MagicMock()
        sum_svc.summarize_transcript = AsyncMock(return_value="Summary of video content")

        svc = VideoService(session, embedding_service=embed_svc, summarization_service=sum_svc)

    svc.youtube = MagicMock()
    svc.youtube.fetch_metadata = AsyncMock(
        return_value=MagicMock(
            title="Mock Title",
            channel_title="Mock Channel",
            thumbnail_url="https://img.youtube.com/vi/yt_123/hqdefault.jpg",
        )
    )
    return svc


# ── get_video_by_youtube_id ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_video_by_youtube_id_returns_video(
    service: VideoService, session: MagicMock
) -> None:
    video = MagicMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = video
    session.execute = AsyncMock(return_value=result)

    assert await service.get_video_by_youtube_id("abc") is video


@pytest.mark.asyncio
async def test_get_video_by_youtube_id_returns_none(
    service: VideoService, session: MagicMock
) -> None:
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=result)

    assert await service.get_video_by_youtube_id("missing") is None


# ── create_video ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_video_persists_and_returns(service: VideoService, session: MagicMock) -> None:
    video = await service.create_video("yt_123", "Hello world", generate_embeddings=False)

    assert video.youtube_video_id == "yt_123"
    assert video.transcript == "Hello world"
    assert session.add.call_count == 2  # KnowledgeItem + Video
    session.flush.assert_awaited_once()
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once()


@pytest.mark.asyncio
async def test_generate_summary_and_embedding(service: VideoService, session: MagicMock) -> None:
    video = MagicMock()
    video.summary = None
    video.embedding = None
    video.transcript = "Video transcript text"
    video.title = "Sample Video Title"

    updated_video = await service.generate_summary_and_embedding(video)

    assert updated_video.summary == "Summary of video content"
    assert updated_video.embedding == [0.1] * 768
    session.commit.assert_awaited_once()


# ── get_or_create_transcript ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_or_create_transcript_cached(service: VideoService, session: MagicMock) -> None:
    """When the video already has a transcript, return it without fetching."""
    existing = MagicMock()
    existing.transcript = "cached transcript"

    result = MagicMock()
    result.scalar_one_or_none.return_value = existing
    session.execute = AsyncMock(return_value=result)

    text = await service.get_or_create_transcript("cached_id")

    assert text == "cached transcript"
    mock_yt = cast(MagicMock, service.youtube)
    mock_yt.fetch_transcript_text.assert_not_called()


@pytest.mark.asyncio
async def test_get_or_create_transcript_fetches_and_saves(
    service: VideoService, session: MagicMock
) -> None:
    """When no cached transcript exists, fetch from YouTube and persist."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=result)

    mock_yt = cast(MagicMock, service.youtube)
    mock_yt.fetch_transcript_text = AsyncMock(return_value="new transcript")

    text = await service.get_or_create_transcript("new_id")

    assert text is not None
    mock_yt.fetch_transcript_text.assert_awaited_once_with("new_id")
    assert session.commit.call_count >= 1


@pytest.mark.asyncio
async def test_get_or_create_transcript_returns_none_when_unavailable(
    service: VideoService, session: MagicMock
) -> None:
    """When YouTube returns no transcript, return None without creating."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=result)

    mock_yt = cast(MagicMock, service.youtube)
    mock_yt.fetch_transcript_text = AsyncMock(return_value="")

    text = await service.get_or_create_transcript("no_subs")

    assert text is None
    session.add.assert_not_called()
