from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.knowledge_item import KnowledgeItem, KnowledgeType
from db.models.video import Video
from integrations.youtube import YouTubeIntegration
from services.embedding_service import EmbeddingService
from services.summarization_service import SummarizationService


class VideoService:
    def __init__(
        self,
        session: AsyncSession,
        embedding_service: EmbeddingService | None = None,
        summarization_service: SummarizationService | None = None,
    ) -> None:
        self.session = session
        self.youtube = YouTubeIntegration()
        self.embedding_service = embedding_service or EmbeddingService()
        self.summarization_service = summarization_service or SummarizationService()

    async def get_video_by_youtube_id(self, youtube_video_id: str) -> Video | None:
        result = await self.session.execute(
            select(Video).filter(Video.youtube_video_id == youtube_video_id)
        )

        return result.scalar_one_or_none()

    async def generate_summary_and_embedding(self, video: Video) -> Video:
        """
        Generate summary and vector embeddings for a video if missing.
        """
        updated = False

        if not video.summary and video.transcript:
            summary = await self.summarization_service.summarize_transcript(
                transcript=video.transcript,
                title=video.title,
            )
            if summary:
                video.summary = summary
                updated = True

        if not video.embedding and (video.title or video.summary or video.transcript):
            embed_content = (
                f"Title: {video.title or ''}\n"
                f"Summary: {video.summary or ''}\n"
                f"Transcript: {(video.transcript or '')[:1000]}"
            )
            embedding = await self.embedding_service.embed_text(embed_content)
            if embedding:
                video.embedding = embedding
                updated = True

        if updated:
            self.session.add(video)
            await self.session.commit()
            await self.session.refresh(video)

        return video

    async def create_video(
        self,
        youtube_video_id: str,
        transcript: str | None = None,
        title: str | None = None,
        channel_title: str | None = None,
        thumbnail_url: str | None = None,
        user_id: int = 1,
        generate_embeddings: bool = True,
    ) -> Video:
        if not title or not channel_title or not thumbnail_url:
            metadata = await self.youtube.fetch_metadata(youtube_video_id)
            title = title or metadata.title
            channel_title = channel_title or metadata.channel_title
            thumbnail_url = thumbnail_url or metadata.thumbnail_url

        video = Video(
            youtube_video_id=youtube_video_id,
            transcript=transcript,
            title=title,
            channel_title=channel_title,
            thumbnail_url=thumbnail_url,
        )
        self.session.add(video)
        await self.session.flush()

        knowledge_item = KnowledgeItem(
            user_id=user_id,
            knowledge_type=KnowledgeType.VIDEO,
            video_id=video.id,
            source_url=f"https://www.youtube.com/watch?v={youtube_video_id}",
        )
        self.session.add(knowledge_item)
        await self.session.commit()
        await self.session.refresh(video)

        if generate_embeddings:
            await self.generate_summary_and_embedding(video)

        return video

    async def get_or_create_transcript(self, youtube_video_id: str) -> str | None:
        video = await self.get_video_by_youtube_id(youtube_video_id)

        if video and video.transcript:
            return video.transcript

        transcript = await self.youtube.fetch_transcript_text(youtube_video_id)

        if not transcript:
            return None

        if video:
            video.transcript = transcript
            self.session.add(video)
            await self.session.commit()
            await self.generate_summary_and_embedding(video)
        else:
            video = await self.create_video(
                youtube_video_id=youtube_video_id, transcript=transcript
            )

        return video.transcript
