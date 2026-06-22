from typing import Any, NotRequired, TypedDict

from langgraph.graph import StateGraph, END
from langchain_ollama import ChatOllama

from integrations.youtube import YouTubeIntegration


class ChatState(TypedDict):
    # Video selected in frontend
    video_id: NotRequired[str]

    # User message
    message: str

    # Filled when transcript is fetched
    transcript: NotRequired[str]

    # Filled by router node
    route: NotRequired[str]

    # Final answer returned to API
    answer: NotRequired[str]


# Ollama LLM
llm = ChatOllama(
    model="llama3.1",
    temperature=0,
)


async def router_node(
    state: ChatState,
) -> dict[str, str]:
    """
    Decide whether the user's question
    requires information from the video transcript.
    """

    prompt = f"""
Decide whether the user's question requires information from the selected YouTube video.

Question:
{state["message"]}

Answer ONLY with one word:

video
or
general
"""

    response = await llm.ainvoke(prompt)

    route = response.content.strip().lower()

    if route not in ["video", "general"]:
        route = "general"

    return {
        "route": route,
    }


async def video_answer_node(
    state: ChatState,
) -> dict[str, str]:
    """
    Fetch transcript and answer using transcript content.
    """

    youtube = YouTubeIntegration()

    transcript = await youtube.fetch_transcript_text(
        video_id=state["video_id"],
    )

    if not transcript:
        return {
            "answer": "Transcript was not found for this video.",
        }

    prompt = f"""
You are helping a user understand a YouTube video.

Transcript:

{transcript}

Question:

{state["message"]}

Instructions:
- Answer using information from the transcript.
- If the answer is not present in the transcript, say so.
- Be concise and helpful.
"""

    response = await llm.ainvoke(prompt)

    return {
        "transcript": transcript,
        "answer": response.content,
    }


async def general_answer_node(
    state: ChatState,
) -> dict[str, str]:
    """
    Answer general questions without using transcript.
    """

    response = await llm.ainvoke(state["message"])

    return {
        "answer": response.content,
    }


def route(
    state: ChatState,
) -> str:
    """
    Conditional edge router.
    """

    if state["route"] == "video":
        return "video"

    return "general"


# Build graph
graph = StateGraph(ChatState)

# Register nodes
graph.add_node(
    "router",
    router_node,
)

graph.add_node(
    "video",
    video_answer_node,
)

graph.add_node(
    "general",
    general_answer_node,
)

# Entry point
graph.set_entry_point("router")

# Conditional routing
graph.add_conditional_edges(
    "router",
    route,
    {
        "video": "video",
        "general": "general",
    },
)

# Finish execution
graph.add_edge(
    "video",
    END,
)

graph.add_edge(
    "general",
    END,
)

# Compile graph
app: Any = graph.compile()
