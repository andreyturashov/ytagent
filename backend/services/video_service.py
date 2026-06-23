from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.video import Video
from integrations.youtube import YouTubeIntegration


class VideoService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.youtube = YouTubeIntegration()

    async def get_video_by_youtube_id(self, youtube_video_id: str) -> Video | None:
        result = await self.session.execute(
            select(Video).filter(Video.youtube_video_id == youtube_video_id)
        )

        return result.scalar_one_or_none()

    async def create_video(self, youtube_video_id: str, transcript: str) -> Video:
        video = Video(
            youtube_video_id=youtube_video_id,
            transcript=transcript,
        )
        self.session.add(video)
        await self.session.commit()
        await self.session.refresh(video)

        return video

    async def get_transcript(self, youtube_video_id: str) -> str | None:
        video = await self.get_video_by_youtube_id(youtube_video_id)

        if video and video.transcript:
            return video.transcript

        transcript = await self.youtube.fetch_transcript_text(youtube_video_id)

        if not transcript:
            return None

        video = await self.create_video(youtube_video_id=youtube_video_id, transcript=transcript)

        return video.transcript
