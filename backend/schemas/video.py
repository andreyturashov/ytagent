from datetime import datetime

from pydantic import BaseModel


class TrackVideoRequest(BaseModel):
    youtube_video_id: str
    url: str | None = None
    user_id: int = 1


class TrackVideoResponse(BaseModel):
    success: bool
    video_id: int
    youtube_video_id: str
    title: str | None = None
    channel_title: str | None = None
    thumbnail_url: str | None = None
    summary: str | None = None


class SearchVideoItem(BaseModel):
    video_id: int
    youtube_video_id: str
    title: str | None = None
    channel_title: str | None = None
    thumbnail_url: str | None = None
    summary: str | None = None
    source_url: str | None = None
    accessed_at: datetime
    score: float


class SearchVideoResponse(BaseModel):
    query: str
    results: list[SearchVideoItem]
