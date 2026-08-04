"""Tests for agents.youtube_agent_graph module."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agents.youtube_agent_graph import (
    ChatState,
    RouteDecision,
    general_answer_node,
    route,
    router_node,
    video_answer_node,
)

# ── Fixtures ─────────────────────────────────────────────────────────


@pytest.fixture
def mock_llm() -> AsyncMock:
    """A mock that replaces the module-level `llm` object."""
    m = AsyncMock()
    response = MagicMock()
    response.content = "mocked answer"
    m.ainvoke = AsyncMock(return_value=response)
    return m


# ── route (conditional edge) ─────────────────────────────────────────


def test_route_returns_video_when_transcript_required() -> None:
    state: ChatState = {"requires_transcript": True, "message": "hi"}
    assert route(state) == "video"


def test_route_returns_general_when_no_transcript() -> None:
    state: ChatState = {"requires_transcript": False, "message": "hi"}
    assert route(state) == "general"


def test_route_returns_general_when_key_missing() -> None:
    state: ChatState = {"message": "hi"}
    assert route(state) == "general"


# ── router_node ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_router_node_no_video_id() -> None:
    """Without a video_id, transcript is never required."""
    state: ChatState = {"message": "What is Python?"}

    result = await router_node(state)

    assert result == {"requires_transcript": False}


@pytest.mark.asyncio
async def test_router_node_with_video_id() -> None:
    """With a video_id, the router LLM decides."""
    state: ChatState = {"video_id": "abc", "message": "Summarize this video"}

    decision = RouteDecision(requires_transcript=True)

    with patch("agents.youtube_agent_graph.router_llm") as mock_router:
        mock_router.ainvoke = AsyncMock(return_value=decision)

        result = await router_node(state)

    assert result == {"requires_transcript": True}


# ── video_answer_node ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_video_answer_node_no_video_id() -> None:
    """Without a video_id, return a 'no video' message."""
    state: ChatState = {"message": "hi"}

    result = await video_answer_node(state)

    assert result == {"answer": "No video selected."}


@pytest.mark.asyncio
async def test_video_answer_node_no_transcript(mock_llm: AsyncMock) -> None:
    """When the transcript fetch returns empty, report it."""
    state: ChatState = {"video_id": "vid1", "message": "summarize"}

    with patch("agents.youtube_agent_graph.YouTubeIntegration") as mock_yt_cls:
        mock_yt_cls.return_value.fetch_transcript_text = AsyncMock(return_value="")

        result = await video_answer_node(state)

    assert result == {"answer": "Transcript was not found for this video."}


@pytest.mark.asyncio
async def test_video_answer_node_with_transcript(mock_llm: AsyncMock) -> None:
    """With a transcript, the LLM answers based on it."""
    state: ChatState = {"video_id": "vid1", "message": "summarize"}

    with (
        patch("agents.youtube_agent_graph.YouTubeIntegration") as mock_yt_cls,
        patch("agents.youtube_agent_graph.llm", mock_llm),
    ):
        mock_yt_cls.return_value.fetch_transcript_text = AsyncMock(
            return_value="Hello world transcript"
        )

        result = await video_answer_node(state)

    assert result["answer"] == "mocked answer"
    assert result["transcript"] == "Hello world transcript"


@pytest.mark.asyncio
async def test_video_answer_node_non_string_content() -> None:
    """When LLM response.content is not a string, it is coerced via str()."""
    state: ChatState = {"video_id": "vid1", "message": "summarize"}

    non_str_llm = AsyncMock()
    response = MagicMock()
    response.content = ["list", "content"]  # non-string
    non_str_llm.ainvoke = AsyncMock(return_value=response)

    with (
        patch("agents.youtube_agent_graph.YouTubeIntegration") as mock_yt_cls,
        patch("agents.youtube_agent_graph.llm", non_str_llm),
    ):
        mock_yt_cls.return_value.fetch_transcript_text = AsyncMock(return_value="transcript")

        result = await video_answer_node(state)

    assert result["answer"] == "['list', 'content']"


# ── general_answer_node ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_general_answer_node(mock_llm: AsyncMock) -> None:
    """General answers are produced without a transcript."""
    state: ChatState = {"message": "What is Python?"}

    with patch("agents.youtube_agent_graph.llm", mock_llm):
        result = await general_answer_node(state)

    assert result == {"answer": "mocked answer"}
    mock_llm.ainvoke.assert_awaited_once_with("What is Python?")


@pytest.mark.asyncio
async def test_general_answer_node_non_string_content() -> None:
    """When LLM response.content is not a string, it is coerced via str()."""
    state: ChatState = {"message": "test"}

    non_str_llm = AsyncMock()
    response = MagicMock()
    response.content = 42
    non_str_llm.ainvoke = AsyncMock(return_value=response)

    with patch("agents.youtube_agent_graph.llm", non_str_llm):
        result = await general_answer_node(state)

    assert result == {"answer": "42"}
