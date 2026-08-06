from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from db.models.knowledge_item import KnowledgeItem, KnowledgeType
from db.models.video import Video
from services.search_service import SearchService, parse_relative_date_range

# ── Relative Date Parser Tests ──────────────────────────────────────────


def test_parse_relative_date_range_yesterday() -> None:
    now = datetime(2026, 8, 6, 14, 0, 0, tzinfo=UTC)
    start, end, cleaned = parse_relative_date_range(
        "What did I watch yesterday about Docker?",
        now=now,
    )

    assert start == datetime(2026, 8, 5, 0, 0, 0, tzinfo=UTC)
    assert end == datetime(2026, 8, 5, 23, 59, 59, 999999, tzinfo=UTC)
    assert cleaned == "What did I watch  about Docker?"


def test_parse_relative_date_range_today() -> None:
    now = datetime(2026, 8, 6, 14, 0, 0, tzinfo=UTC)
    start, end, cleaned = parse_relative_date_range("Videos I watched today", now=now)

    assert start == datetime(2026, 8, 6, 0, 0, 0, tzinfo=UTC)
    assert end == now
    assert cleaned == "Videos I watched"


def test_parse_relative_date_range_last_n_days() -> None:
    now = datetime(2026, 8, 6, 14, 0, 0, tzinfo=UTC)
    start, end, cleaned = parse_relative_date_range("Videos from last 3 days", now=now)

    assert start == now - timedelta(days=3)
    assert end == now
    assert cleaned == "Videos from"


def test_parse_relative_date_range_last_week() -> None:
    now = datetime(2026, 8, 6, 14, 0, 0, tzinfo=UTC)
    start, end, cleaned = parse_relative_date_range("Python tutorials from last week", now=now)

    assert start == now - timedelta(days=7)
    assert end == now
    assert cleaned == "Python tutorials from"


def test_parse_relative_date_range_recently() -> None:
    now = datetime(2026, 8, 6, 14, 0, 0, tzinfo=UTC)
    start, end, cleaned = parse_relative_date_range("Videos I watched recently", now=now)

    assert start == now - timedelta(days=30)
    assert end == now
    assert cleaned == "Videos I watched"


def test_parse_relative_date_range_no_temporal() -> None:
    now = datetime(2026, 8, 6, 14, 0, 0, tzinfo=UTC)
    start, end, cleaned = parse_relative_date_range("MCP server architecture", now=now)

    assert start is None
    assert end is None
    assert cleaned == "MCP server architecture"


# ── SearchService Tests ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_empty_query() -> None:
    session = MagicMock()
    service = SearchService(session)

    results = await service.search("", user_id=1)
    assert results == []


@pytest.mark.asyncio
async def test_search_matching_results() -> None:
    now = datetime(2026, 8, 6, 14, 0, 0, tzinfo=UTC)

    video1 = Video(
        id=1,
        youtube_video_id="v1",
        title="Docker and Kubernetes Tutorial",
        summary="Learn Docker container basics.",
        transcript="Docker allows containerizing apps.",
        embedding=[0.1] * 768,
    )

    ki1 = KnowledgeItem(
        id=10,
        user_id=1,
        video_id=1,
        knowledge_type=KnowledgeType.VIDEO,
        accessed_at=now - timedelta(hours=2),
    )

    video2 = Video(
        id=2,
        youtube_video_id="v2",
        title="Cooking Pasta",
        summary="Recipe for pasta.",
        transcript="Boil water for pasta.",
        embedding=[-0.1] * 768,
    )

    ki2 = KnowledgeItem(
        id=20,
        user_id=1,
        video_id=2,
        knowledge_type=KnowledgeType.VIDEO,
        accessed_at=now - timedelta(days=5),
    )

    mock_tuples = MagicMock()
    mock_tuples.all.return_value = [(ki1, video1), (ki2, video2)]
    mock_result = MagicMock()
    mock_result.tuples.return_value = mock_tuples

    session = MagicMock()
    session.execute = AsyncMock(return_value=mock_result)

    embed_svc = MagicMock()
    embed_svc.embed_text = AsyncMock(return_value=[0.1] * 768)

    service = SearchService(session, embedding_service=embed_svc)

    results = await service.search("Docker tutorial", user_id=1, reference_now=now)

    assert len(results) == 2
    assert results[0].video.youtube_video_id == "v1"
    assert results[0].score > results[1].score
    assert results[0].text_score > 0
    assert results[0].vector_score > 0
