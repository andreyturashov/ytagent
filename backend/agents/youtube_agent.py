from typing import Any, NotRequired, TypedDict, cast

from langchain_ollama import ChatOllama
from langgraph.graph import END, StateGraph
from pydantic import BaseModel

from integrations.youtube import YouTubeIntegration


class ChatState(TypedDict):
    # Video selected in frontend.
    video_id: NotRequired[str | None]

    # User message.
    message: str

    # Filled when transcript is fetched.
    transcript: NotRequired[str]

    # Router decision.
    requires_transcript: NotRequired[bool]

    # Final answer.
    answer: NotRequired[str]


class RouteDecision(BaseModel):
    """
    Structured output returned by router LLM.
    """

    requires_transcript: bool


llm = ChatOllama(
    model="llama3.1",
    temperature=0,
)

router_llm = llm.with_structured_output(
    RouteDecision,
)


async def router_node(
    state: ChatState,
) -> dict[str, bool]:
    """
    Decide whether answering the question
    requires access to the selected video's transcript.
    """

    # If no video selected,
    # transcript cannot be used anyway.
    if not state.get("video_id"):
        return {
            "requires_transcript": False,
        }

    response = cast(
        RouteDecision,
        await router_llm.ainvoke(f"""
        Determine whether answering the user's question
        requires information from the selected YouTube video.

        Question:
        {state["message"]}

        Return:

        requires_transcript = true

        when the answer depends on the video's content.

        Examples:

        "What did the speaker say about AI?"
        -> true

        "Summarize this video"
        -> true

        "What are the key takeaways?"
        -> true

        "What is Python?"
        -> false

        "Who created FastAPI?"
        -> false
    """),
    )

    return {
        "requires_transcript": response.requires_transcript,
    }


async def video_answer_node(
    state: ChatState,
) -> dict[str, Any]:
    """
    Fetch transcript and answer using transcript.
    """

    video_id = state.get("video_id")

    if not video_id:
        return {
            "answer": "No video selected.",
        }

    youtube = YouTubeIntegration()

    transcript = await youtube.fetch_transcript_text(
        video_id=video_id,
    )

    if not transcript:
        return {
            "answer": "Transcript was not found for this video.",
        }

    response = await llm.ainvoke(f"""
        You are helping a user understand a YouTube video.

        Transcript:

        {transcript}

        Question:

        {state["message"]}

        Instructions:
        - Answer using information from the transcript.
        - If the answer is not contained in the transcript,
        clearly state that.
        - Be concise and helpful.
    """)

    answer = response.content if isinstance(response.content, str) else str(response.content)

    return {
        "transcript": transcript,
        "answer": answer,
    }


async def general_answer_node(
    state: ChatState,
) -> dict[str, str]:
    """
    Answer without transcript.
    """

    response = await llm.ainvoke(
        state["message"],
    )

    answer = response.content if isinstance(response.content, str) else str(response.content)

    return {
        "answer": answer,
    }


def route(
    state: ChatState,
) -> str:
    """
    Conditional edge callback.
    """

    if state.get("requires_transcript"):
        return "video"

    return "general"


graph = StateGraph(ChatState)

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

graph.set_entry_point(
    "router",
)

graph.add_conditional_edges(
    "router",
    route,
    {
        "video": "video",
        "general": "general",
    },
)

graph.add_edge(
    "video",
    END,
)

graph.add_edge(
    "general",
    END,
)

app: Any = graph.compile()
