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
