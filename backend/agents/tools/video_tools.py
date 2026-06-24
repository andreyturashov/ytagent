from langchain_core.tools import tool

from db.session import AsyncSessionLocal
from services.video_service import VideoService


@tool
async def get_transcript(
    video_id: str,
) -> str:
    """
    Retrieve transcript for a YouTube video.
    """

    async with AsyncSessionLocal() as session:
        service = VideoService(session)

        transcript = await service.get_or_create_transcript(
            youtube_video_id=video_id,
        )

        if not transcript:
            return "Transcript was not found."

        return transcript
