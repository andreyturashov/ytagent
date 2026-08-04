from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from routers.chat import chat
from schemas.chat import ChatRequest
from services.conversation_service import ConversationService


@pytest.mark.asyncio
async def test_chat_endpoint_uses_hardcoded_chat_context() -> None:
    with patch("routers.chat.ConversationService") as conversation_service_cls:
        instance = conversation_service_cls.return_value
        instance.send_message = AsyncMock(return_value="hello from agent")

        response = await chat(
            ChatRequest(message="hello", video_id="abc123", user_id=1, chat_id=1),
            session=MagicMock(),
        )

    assert response.answer == "hello from agent"
    instance.send_message.assert_awaited_once_with(
        user_id=1,
        chat_id=1,
        message="hello",
        youtube_video_id="abc123",
    )


@pytest.mark.asyncio
async def test_get_session() -> None:
    from collections.abc import AsyncGenerator

    from routers.chat import get_session

    mock_db_session = MagicMock()

    async def mock_get_db() -> AsyncGenerator[MagicMock]:
        yield mock_db_session

    with patch("routers.chat.get_db", side_effect=mock_get_db):
        session = await get_session()
        assert session == mock_db_session

    async def mock_empty_get_db() -> AsyncGenerator[None]:
        if False:
            yield

    with (
        patch("routers.chat.get_db", side_effect=mock_empty_get_db),
        pytest.raises(RuntimeError, match="No session available"),
    ):
        await get_session()


@pytest.mark.asyncio
async def test_send_message_passes_thread_id_to_agent() -> None:
    service = ConversationService(session=MagicMock())
    cast(Any, service.users).get_by_id = AsyncMock(return_value=object())
    cast(Any, service.chats).get_by_id = AsyncMock(return_value=object())
    cast(Any, service.messages).add_user_message = AsyncMock()
    cast(Any, service.messages).list_langchain_messages = AsyncMock(return_value=[])
    cast(Any, service.messages).add_assistant_message = AsyncMock()
    cast(Any, service.videos).get_or_create_transcript = AsyncMock()

    with patch("services.conversation_service.youtube_agent") as mock_agent:
        mock_agent.ainvoke = AsyncMock(return_value={"messages": ["assistant reply"]})

        response = await service.send_message(
            user_id=1,
            chat_id=7,
            message="hello",
        )

    assert response == "assistant reply"
    mock_agent.ainvoke.assert_awaited_once()
    assert mock_agent.ainvoke.await_args.kwargs["config"] == {
        "configurable": {
            "thread_id": "7",
        }
    }


@pytest.mark.asyncio
async def test_send_message_user_not_found() -> None:
    service = ConversationService(session=MagicMock())
    cast(Any, service.users).get_by_id = AsyncMock(return_value=None)

    with pytest.raises(ValueError, match="User was not found."):
        await service.send_message(user_id=1, chat_id=1, message="hello")


@pytest.mark.asyncio
async def test_send_message_chat_not_found() -> None:
    service = ConversationService(session=MagicMock())
    cast(Any, service.users).get_by_id = AsyncMock(return_value=object())
    cast(Any, service.chats).get_by_id = AsyncMock(return_value=None)

    with pytest.raises(ValueError, match="Chat was not found."):
        await service.send_message(user_id=1, chat_id=1, message="hello")


@pytest.mark.asyncio
async def test_send_message_with_video_and_ai_message() -> None:
    from langchain_core.messages import AIMessage

    service = ConversationService(session=MagicMock())
    cast(Any, service.users).get_by_id = AsyncMock(return_value=object())
    cast(Any, service.chats).get_by_id = AsyncMock(return_value=object())
    cast(Any, service.messages).add_user_message = AsyncMock()
    cast(Any, service.messages).list_langchain_messages = AsyncMock(return_value=[])
    cast(Any, service.messages).add_assistant_message = AsyncMock()
    cast(Any, service.knowledge).create_knowledge_item = AsyncMock()
    cast(Any, service.videos).get_video_by_youtube_id = AsyncMock(return_value=object())
    cast(Any, service.videos).get_or_create_transcript = AsyncMock()

    ai_msg = AIMessage(content="AI answer content")

    with patch("services.conversation_service.youtube_agent") as mock_agent:
        mock_agent.ainvoke = AsyncMock(return_value={"messages": [ai_msg]})

        response = await service.send_message(
            user_id=1,
            chat_id=1,
            message="hello",
            youtube_video_id="video123",
        )

    assert response == "AI answer content"
    cast(Any, service.knowledge).create_knowledge_item.assert_awaited_once()
    cast(Any, service.videos).get_or_create_transcript.assert_awaited_once_with("video123")
