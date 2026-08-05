"""Tests for agents.tools.knowledge_tools module."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agents.tools.knowledge_tools import search_knowledge

# ── Fixtures ─────────────────────────────────────────────────────────


@pytest.fixture
def mock_session_context() -> tuple[MagicMock, MagicMock]:
    """Return (session_local_mock, session_instance) wired as an async context manager."""
    session = AsyncMock()
    ctx = AsyncMock()
    ctx.__aenter__ = AsyncMock(return_value=session)
    ctx.__aexit__ = AsyncMock(return_value=False)
    session_local = MagicMock(return_value=ctx)
    return session_local, session


# ── search_knowledge ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_knowledge_no_results(
    mock_session_context: tuple[MagicMock, AsyncMock],
) -> None:
    """When no items match, return a human-readable 'not found' message."""
    session_local, _ = mock_session_context

    with (
        patch("agents.tools.knowledge_tools.AsyncSessionLocal", session_local),
        patch("agents.tools.knowledge_tools.KnowledgeService") as svc_cls,
    ):
        svc_cls.return_value.search = AsyncMock(return_value=[])

        result = await search_knowledge.ainvoke({"query": "nothing"})

    assert result == "No matching knowledge items were found."


@pytest.mark.asyncio
async def test_search_knowledge_with_video(
    mock_session_context: tuple[MagicMock, AsyncMock],
) -> None:
    """Items with a linked video include the YouTube ID in the output."""
    session_local, _ = mock_session_context

    item = MagicMock()
    item.knowledge_type = "video"
    item.video = MagicMock()
    item.video.youtube_video_id = "yt_abc"

    with (
        patch("agents.tools.knowledge_tools.AsyncSessionLocal", session_local),
        patch("agents.tools.knowledge_tools.KnowledgeService") as svc_cls,
    ):
        svc_cls.return_value.search = AsyncMock(return_value=[item])

        result = await search_knowledge.ainvoke({"query": "abc"})

    assert "- [video]" in result
    assert "YouTube: yt_abc" in result


@pytest.mark.asyncio
async def test_search_knowledge_without_video(
    mock_session_context: tuple[MagicMock, AsyncMock],
) -> None:
    """Items without a linked video only show the type tag."""
    session_local, _ = mock_session_context

    item = MagicMock()
    item.knowledge_type = "website"
    item.video = None

    with (
        patch("agents.tools.knowledge_tools.AsyncSessionLocal", session_local),
        patch("agents.tools.knowledge_tools.KnowledgeService") as svc_cls,
    ):
        svc_cls.return_value.search = AsyncMock(return_value=[item])

        result = await search_knowledge.ainvoke({"query": "site"})

    assert result == "- [website]"
    assert "YouTube" not in result
