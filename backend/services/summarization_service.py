import logging

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

from config import OLLAMA_BASE_URL, OLLAMA_MODEL

logger = logging.getLogger(__name__)


class SummarizationService:
    """
    Service for generating concise video summaries using ChatOllama.
    """

    def __init__(self, model_name: str | None = None, base_url: str | None = None) -> None:
        self.model_name = model_name or OLLAMA_MODEL
        self.base_url = base_url or OLLAMA_BASE_URL
        self.llm = ChatOllama(
            model=self.model_name,
            base_url=self.base_url,
            temperature=0.2,
        )

    async def summarize_transcript(self, transcript: str, title: str | None = None) -> str | None:
        """
        Summarize transcript text into a concise summary.

        Args:
            transcript (str): The video transcript text
            title (str | None): Optional video title for context

        Returns:
            str | None: Summary text or None on failure
        """
        if not transcript or not transcript.strip():
            return None

        # Truncate transcript to first 12,000 characters to stay within context limits
        truncated_transcript = transcript[:12000]

        system_prompt = (
            "You are a helpful assistant that summarizes YouTube video transcripts. "
            "Write a clear, concise summary (3 to 5 sentences) highlighting the key topics, "
            "main arguments, and takeaways. "
            "Output only the summary text without introductory meta-text."
        )

        user_content = f"Title: {title or 'Unknown'}\n\nTranscript:\n{truncated_transcript}"

        try:
            response = await self.llm.ainvoke(
                [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_content),
                ]
            )
            summary = str(response.content).strip()

            return summary if summary else None
        except Exception as e:
            logger.error("Error generating transcript summary: %s", e)

            return None
