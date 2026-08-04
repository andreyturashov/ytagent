"""Tests for services.message_service module."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from db.models.chat import Chat
from db.models.message import MessageRole
from services.message_service import MessageService

# ── Fixtures ─────────────────────────────────────────────────────────


@pytest.fixture
def session() -> MagicMock:
    s = MagicMock()
    s.add = MagicMock()
    s.commit = AsyncMock()
    s.refresh = AsyncMock()
    s.delete = AsyncMock()
    s.execute = AsyncMock()
    return s


@pytest.fixture
def service(session: MagicMock) -> MessageService:
    return MessageService(session=session)


@pytest.fixture
def chat() -> MagicMock:
    c = MagicMock(spec=Chat)
    c.id = 1
    return c


# ── add_user_message ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_add_user_message(
    service: MessageService, session: MagicMock, chat: MagicMock
) -> None:
    msg = await service.add_user_message(chat=chat, content="hi")

    assert msg.role == MessageRole.USER
    assert msg.content == "hi"
    session.add.assert_called_once()
    session.commit.assert_awaited_once()


# ── add_assistant_message ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_add_assistant_message(
    service: MessageService, session: MagicMock, chat: MagicMock
) -> None:
    msg = await service.add_assistant_message(chat=chat, content="hello")

    assert msg.role == MessageRole.ASSISTANT
    assert msg.content == "hello"


# ── add_tool_message ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_add_tool_message(
    service: MessageService, session: MagicMock, chat: MagicMock
) -> None:
    msg = await service.add_tool_message(chat=chat, content="tool output")

    assert msg.role == MessageRole.TOOL
    assert msg.content == "tool output"


# ── get_message ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_message_found(service: MessageService, session: MagicMock) -> None:
    expected = MagicMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = expected
    session.execute = AsyncMock(return_value=result)

    assert await service.get_message(42) is expected


@pytest.mark.asyncio
async def test_get_message_not_found(service: MessageService, session: MagicMock) -> None:
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=result)

    assert await service.get_message(999) is None


# ── list_messages ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_messages(service: MessageService, session: MagicMock, chat: MagicMock) -> None:
    m1, m2 = MagicMock(), MagicMock()
    scalars = MagicMock()
    scalars.__iter__ = MagicMock(return_value=iter([m1, m2]))
    result = MagicMock()
    result.scalars.return_value = scalars
    session.execute = AsyncMock(return_value=result)

    assert await service.list_messages(chat) == [m1, m2]


# ── get_recent_messages ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_recent_messages_reverses_order(
    service: MessageService, session: MagicMock, chat: MagicMock
) -> None:
    """DB returns newest-first; method should reverse to chronological order."""
    m_new, m_old = MagicMock(), MagicMock()
    scalars = MagicMock()
    scalars.__iter__ = MagicMock(return_value=iter([m_new, m_old]))
    result = MagicMock()
    result.scalars.return_value = scalars
    session.execute = AsyncMock(return_value=result)

    messages = await service.get_recent_messages(chat, limit=2)

    assert messages == [m_old, m_new]


# ── list_langchain_messages ─────────────────────────────────────────


def _make_msg(role: str, content: str, msg_id: int = 1) -> MagicMock:
    m = MagicMock()
    m.role = role
    m.content = content
    m.id = msg_id
    return m


@pytest.mark.asyncio
async def test_list_langchain_messages_all_roles(
    service: MessageService, session: MagicMock, chat: MagicMock
) -> None:
    """Each MessageRole maps to the correct LangChain message type."""
    db_msgs = [
        _make_msg(MessageRole.USER, "user msg"),
        _make_msg(MessageRole.ASSISTANT, "ai msg"),
        _make_msg(MessageRole.TOOL, "tool msg", msg_id=7),
        _make_msg(MessageRole.SYSTEM, "sys msg"),
        _make_msg("unknown_role", "fallback msg"),
    ]

    scalars = MagicMock()
    scalars.__iter__ = MagicMock(return_value=iter(db_msgs))
    result = MagicMock()
    result.scalars.return_value = scalars
    session.execute = AsyncMock(return_value=result)

    lc_msgs = await service.list_langchain_messages(chat)

    assert len(lc_msgs) == 5
    assert isinstance(lc_msgs[0], HumanMessage) and lc_msgs[0].content == "user msg"
    assert isinstance(lc_msgs[1], AIMessage) and lc_msgs[1].content == "ai msg"
    assert isinstance(lc_msgs[2], ToolMessage) and lc_msgs[2].content == "tool msg"
    assert isinstance(lc_msgs[3], SystemMessage) and lc_msgs[3].content == "sys msg"
    assert isinstance(lc_msgs[4], HumanMessage) and lc_msgs[4].content == "fallback msg"


# ── delete_message ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_message(service: MessageService, session: MagicMock) -> None:
    msg = MagicMock()

    await service.delete_message(msg)

    session.delete.assert_awaited_once_with(msg)
    session.commit.assert_awaited_once()
