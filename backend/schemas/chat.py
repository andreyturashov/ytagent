from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    video_id: str | None = None


class ChatResponse(BaseModel):
    answer: str
