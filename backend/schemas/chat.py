from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    video_id: str | None = None
    user_id: int
    chat_id: int


class ChatResponse(BaseModel):
    answer: str
