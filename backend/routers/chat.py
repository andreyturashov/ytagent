from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from schemas.chat import (
    ChatRequest,
    ChatResponse,
)
from services.conversation_service import ConversationService

router = APIRouter()


async def get_session() -> AsyncSession:
    async for session in get_db():
        return session
    raise RuntimeError("No session available")


@router.post(
    "/chat",
    response_model=ChatResponse,
)
async def chat(
    request: ChatRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ChatResponse:
    conversation_service = ConversationService(
        session=session,
    )

    answer = await conversation_service.send_message(
        user_id=1,
        chat_id=1,
        message=request.message,
        youtube_video_id=request.video_id,
    )

    return ChatResponse(
        answer=answer,
    )
