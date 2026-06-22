from fastapi import APIRouter

from agents.youtube_agent import ChatState
from agents.youtube_agent import app as agent_app
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
    chat_state: ChatState = {
        "video_id": request.video_id,
        "message": request.message,
    }

    result = await agent_app.ainvoke(chat_state)

    return ChatResponse(answer=result["answer"])
