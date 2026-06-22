import asyncio
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)
from youtube_transcript_api._transcripts import FetchedTranscript
import logging

logger = logging.getLogger(__name__)


class YouTubeIntegration:
    def __init__(self):
        self.ytt_api = YouTubeTranscriptApi()

    async def fetch_transcript(self, video_id: str) -> FetchedTranscript:
        """
        Fetch transcription for a specific video

        Args:
            video_id (str): The ID of the YouTube video for which to fetch the transcript

        Returns:
            FetchedTranscript: The fetched transcript object
        """
        try:
            transcript = await asyncio.to_thread(self.ytt_api.fetch, video_id=video_id)
            logger.info("Successfully fetched transcript for video %s", video_id)

            return transcript

        except (NoTranscriptFound, TranscriptsDisabled, VideoUnavailable) as e:
            logger.error("Error fetching transcript for video %s: %s", video_id, e)

            return None

    def transcript_to_text(self, transcript: FetchedTranscript) -> str:
        """
        Convert a fetched transcript to a string

        Args:
            transcript (FetchedTranscript): The fetched transcript object

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
