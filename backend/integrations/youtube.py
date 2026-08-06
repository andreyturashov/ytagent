import asyncio
import logging
from dataclasses import dataclass

import httpx
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)
from youtube_transcript_api._transcripts import FetchedTranscript

logger = logging.getLogger(__name__)


@dataclass
class VideoMetadata:
    title: str | None = None
    channel_title: str | None = None
    thumbnail_url: str | None = None
    description: str | None = None
    duration_seconds: int | None = None


class YouTubeIntegration:
    def __init__(self) -> None:
        self.ytt_api = YouTubeTranscriptApi()

    async def fetch_transcript(self, video_id: str) -> FetchedTranscript | None:
        """
        Fetch transcription for a specific video

        Args:
            video_id (str): The ID of the YouTube video for which to fetch the transcript

        Returns:
            FetchedTranscript | None: The fetched transcript object or None if not found
        """
        try:
            transcript = await asyncio.to_thread(self.ytt_api.fetch, video_id=video_id)
            logger.info("Successfully fetched transcript for video %s", video_id)

            return transcript

        except (NoTranscriptFound, TranscriptsDisabled, VideoUnavailable) as e:
            logger.error("Error fetching transcript for video %s: %s", video_id, e)

            return None

    def transcript_to_text(self, transcript: FetchedTranscript | None) -> str:
        """
        Convert a fetched transcript to a string

        Args:
            transcript (FetchedTranscript | None): The fetched transcript object
            or None if not found

        Returns:
            str: The transcript as a string
        """
        if not transcript:
            return ""

        return " ".join([entry.text for entry in transcript.snippets])

    async def fetch_transcript_text(self, video_id: str) -> str:
        """
        Fetch the transcript text for a specific video

        Args:
            video_id (str): The ID of the YouTube video for which to fetch the transcript

        Returns:
            str: The transcript as a string
        """
        transcript = await self.fetch_transcript(video_id)

        return self.transcript_to_text(transcript)

    async def fetch_metadata(self, video_id: str) -> VideoMetadata:
        """
        Fetch video metadata (title, channel, thumbnail) using YouTube oEmbed endpoint.

        Args:
            video_id (str): The ID of the YouTube video

        Returns:
            VideoMetadata: Metadata container
        """
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        fallback_thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)

                if response.status_code == 200:
                    data = response.json()

                    return VideoMetadata(
                        title=data.get("title"),
                        channel_title=data.get("author_name"),
                        thumbnail_url=data.get("thumbnail_url", fallback_thumbnail),
                    )
        except Exception as e:
            logger.error("Error fetching metadata for video %s: %s", video_id, e)

        return VideoMetadata(thumbnail_url=fallback_thumbnail)
