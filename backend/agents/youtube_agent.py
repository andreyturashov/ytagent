from typing import TypedDict

from langgraph.graph import StateGraph, END
from langchain_ollama import ChatOllama
from youtube_transcript_api import YouTubeTranscriptApi

from backend.integrations.youtube import YouTubeIntegration


class State(TypedDict):
    video_id: str
    transcript: str
    summary: str


llm = ChatOllama(
    model="llama3.1",
    temperature=0,
)

youtube_api = YouTubeTranscriptApi()


async def get_transcript_node(state: State) -> dict[str, str] | None:
    youtube_integration = YouTubeIntegration()

    transcript = await youtube_integration.fetch_transcript_text(
        video_id=state["video_id"]
    )

    if not transcript:
        return None

    return {"transcript": transcript}


async def summarize_node(state: State) -> dict[str, str]:
    prompt = f"""
Summarize the following YouTube video.

Transcript:

{state["transcript"]}

Provide:
1. Short summary
2. Main topics
3. Key takeaways
"""

    response = await llm.ainvoke(prompt)

    return {"summary": response.content}


graph = StateGraph(State)

graph.add_node(
    "get_transcript",
    get_transcript_node,
)

graph.add_node(
    "summarize",
    summarize_node,
)

graph.set_entry_point("get_transcript")

graph.add_edge(
    "get_transcript",
    "summarize",
)

graph.add_edge(
    "summarize",
    END,
)

app = graph.compile()
