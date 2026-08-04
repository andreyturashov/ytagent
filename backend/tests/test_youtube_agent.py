from unittest.mock import AsyncMock, patch

import pytest
from langchain_core.messages import HumanMessage

from agents.youtube_agent import agent_node, build_system_prompt


def test_build_system_prompt() -> None:
    prompt_with_id = build_system_prompt("test_video_123")
    assert "test_video_123" in prompt_with_id

    prompt_none = build_system_prompt(None)
    assert "None" in prompt_none


@pytest.mark.asyncio
async def test_agent_node() -> None:
    from agents import youtube_agent

    state = {
        "video_id": "test_vid",
        "messages": [HumanMessage(content="Hello")],
    }

    mock_response = HumanMessage(content="Mocked response")
    mock_llm = AsyncMock()
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)

    with patch.object(youtube_agent, "llm_with_tools", mock_llm):
        result = await agent_node(state)  # type: ignore[arg-type]

        assert result == {"messages": [mock_response]}
        mock_llm.ainvoke.assert_awaited_once()
