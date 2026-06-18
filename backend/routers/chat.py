# routers/chat.py

from fastapi import APIRouter

from schemas.chat import (
    ChatRequest,
    ChatResponse,
)

router = APIRouter()


@router.post(
    "/chat",
    response_model=ChatResponse,
)
async def chat(
    request: ChatRequest,
) -> ChatResponse:

    return ChatResponse(answer=f"You said: {request.message}")
