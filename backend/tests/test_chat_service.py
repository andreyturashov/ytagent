from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from db.models.chat import Chat
from db.models.user import User
from services.chat_service import ChatService


def _make_session(**overrides: Any) -> MagicMock:
    session = MagicMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.delete = AsyncMock()
    session.execute = AsyncMock()
    for k, v in overrides.items():
        setattr(session, k, v)
    return session


# ------------------------------------------------------------------
# create_chat
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_chat_with_title() -> None:
    session = _make_session()
    service = ChatService(session=session)

    user = MagicMock(spec=User)
    user.id = 1

    chat = await service.create_chat(user=user, title="My Chat")

    assert chat.title == "My Chat"
    assert chat.user_id == 1
    session.add.assert_called_once()
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_chat_default_title() -> None:
    session = _make_session()
    service = ChatService(session=session)

    user = MagicMock(spec=User)
    user.id = 2

    chat = await service.create_chat(user=user)

    assert chat.title == "New Chat"


# ------------------------------------------------------------------
# get_by_id
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_by_id_found() -> None:
    chat_obj = MagicMock(spec=Chat)

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = chat_obj

    session = _make_session(execute=AsyncMock(return_value=mock_result))
    service = ChatService(session=session)

    result = await service.get_by_id(1)
    assert result is chat_obj


@pytest.mark.asyncio
async def test_get_by_id_not_found() -> None:
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None

    session = _make_session(execute=AsyncMock(return_value=mock_result))
    service = ChatService(session=session)

    result = await service.get_by_id(999)
    assert result is None


# ------------------------------------------------------------------
# list_user_chats
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_user_chats() -> None:
    chat1 = MagicMock(spec=Chat)
    chat2 = MagicMock(spec=Chat)

    mock_scalars = MagicMock()
    mock_scalars.__iter__ = MagicMock(return_value=iter([chat1, chat2]))
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars

    session = _make_session(execute=AsyncMock(return_value=mock_result))
    service = ChatService(session=session)

    user = MagicMock(spec=User)
    user.id = 1

    chats = await service.list_user_chats(user=user)
    assert chats == [chat1, chat2]


# ------------------------------------------------------------------
# touch
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_touch_updates_timestamp() -> None:
    session = _make_session()
    service = ChatService(session=session)

    chat = MagicMock(spec=Chat)
    chat.updated_at = None

    await service.touch(chat=chat)

    assert chat.updated_at is not None


# ------------------------------------------------------------------
# delete_chat
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_chat() -> None:
    session = _make_session()
    service = ChatService(session=session)

    chat = MagicMock(spec=Chat)

    await service.delete_chat(chat=chat)

    session.delete.assert_awaited_once_with(chat)
    session.commit.assert_awaited_once()
