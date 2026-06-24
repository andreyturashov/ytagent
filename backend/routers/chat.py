from fastapi import APIRouter
from langchain_core.messages import AIMessage, HumanMessage

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
    result = await agent_app.ainvoke(
        {
            "video_id": request.video_id,
            "messages": [
                HumanMessage(
                    content=request.message,
                )
            ],
        },
        config={
            "configurable": {
                "thread_id": "chat_1",
            }
        },
    )

    last_message = result["messages"][-1]

    answer = str(last_message.content) if isinstance(last_message, AIMessage) else ""

    return ChatResponse(answer=answer)
