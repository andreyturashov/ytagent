from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from youtube_transcript_api._errors import NoTranscriptFound

from integrations.youtube import YouTubeIntegration

# ------------------------------------------------------------------
# fetch_transcript
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fetch_transcript_success() -> None:
    integration = YouTubeIntegration()
    fake_transcript = MagicMock()

    with patch("integrations.youtube.asyncio.to_thread", new_callable=AsyncMock) as mock_to_thread:
        mock_to_thread.return_value = fake_transcript

        result = await integration.fetch_transcript("vid123")

    assert result is fake_transcript
    mock_to_thread.assert_awaited_once()


@pytest.mark.asyncio
async def test_fetch_transcript_error_returns_none() -> None:
    integration = YouTubeIntegration()

    with patch("integrations.youtube.asyncio.to_thread", new_callable=AsyncMock) as mock_to_thread:
        mock_to_thread.side_effect = NoTranscriptFound(
            video_id="vid123",
            requested_language_codes=["en"],
            transcript_data={},
        )

        result = await integration.fetch_transcript("vid123")

    assert result is None


# ------------------------------------------------------------------
# transcript_to_text
# ------------------------------------------------------------------


def test_transcript_to_text_with_data() -> None:
    integration = YouTubeIntegration()

    snippet1 = MagicMock()
    snippet1.text = "Hello"
    snippet2 = MagicMock()
    snippet2.text = "world"

    transcript = MagicMock()
    transcript.snippets = [snippet1, snippet2]

    result = integration.transcript_to_text(transcript)
    assert result == "Hello world"


def test_transcript_to_text_none() -> None:
    integration = YouTubeIntegration()

    result = integration.transcript_to_text(None)
    assert result == ""


# ------------------------------------------------------------------
# fetch_transcript_text
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fetch_transcript_text() -> None:
    integration = YouTubeIntegration()

    with (
        patch.object(integration, "fetch_transcript", new_callable=AsyncMock) as mock_fetch,
        patch.object(integration, "transcript_to_text", return_value="full text") as mock_to_text,
    ):
        mock_fetch.return_value = MagicMock()

        result = await integration.fetch_transcript_text("vid456")

    assert result == "full text"
    mock_fetch.assert_awaited_once_with("vid456")
    mock_to_text.assert_called_once()
