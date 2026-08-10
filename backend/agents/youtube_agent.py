from datetime import UTC, datetime
from typing import Annotated, Any, NotRequired, TypedDict

from langchain_core.messages import AnyMessage, SystemMessage
from langchain_ollama import ChatOllama
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

from agents.tools.knowledge_tools import search_knowledge, search_watch_history
from agents.tools.video_tools import get_transcript


class ChatState(TypedDict):
    """
    State shared across the graph.
    """

    video_id: NotRequired[str | None]

    messages: Annotated[
        list[AnyMessage],
        add_messages,
    ]


llm = ChatOllama(
    model="qwen2.5:14b",
    temperature=0,
)

tools = [
    get_transcript,
    search_knowledge,
    search_watch_history,
]

llm_with_tools = llm.bind_tools(
    tools,
)


def build_system_prompt(video_id: str | None) -> str:
    """Build the system prompt that steers the model toward helpful answers."""
    now_str = datetime.now(UTC).strftime("%A, %B %d, %Y %H:%M UTC")

    active_video_str = video_id if video_id else "None"

    return f"""
        You are a helpful YouTube assistant with access to both the active video
        and user watch history.
        Current System Time: {now_str}
        Active Video ID: {active_video_str}

        Your primary job is to answer the user's latest question directly, accurately,
        and usefully by invoking the appropriate tool.

        Important rules:
        - Active Video Questions: When the user asks to summarize, analyze, or ask questions
          about "this video", "the video", or current content, you MUST call
          `get_transcript(video_id="{active_video_str}")`.
        - Watch History & Past Videos Questions: You DO have full access to watch history!
          When asked about videos watched recently, last week, yesterday, or on a topic
          (e.g., "what videos did I watch last week?"), call `search_watch_history(query=...)`.
        - Do NOT claim that you lack access to watch history. Always use
          `search_watch_history(query)` to search it first.
        - Exact URL & Video ID Preservation: When providing YouTube links or video IDs from
          tools, you MUST copy the EXACT URL (e.g. https://www.youtube.com/watch?v=...) and
          actual video ID from the tool output. NEVER output placeholders like `your_video_id`,
          `VIDEO_ID`, `sample_id`, or `...`.
        - Never output raw tool calls, JSON, or function-call syntax.
        - Do not say things like "I will call the get_transcript function".
        - Do not return intermediate steps or tool metadata.
        - If transcript or history information is needed, use the tool silently, then answer
          the user directly based on the returned data.
        - If no results are found after using a tool, clearly state that.

        Available tools:
        - get_transcript(video_id): Retrieve transcript text for a YouTube video.
          Always pass `video_id="{active_video_str}"` when analyzing the current video.
        - search_watch_history(query): Search user's watched videos history by date/topic
          (e.g. `search_watch_history(query="generative engine optimization last week")`).
        - search_knowledge(query): Search saved knowledge items across chats.

        After using a tool, provide a natural-language answer focusing strictly on
        the user's current question.
    """


async def agent_node(
    state: ChatState,
) -> dict[str, list[AnyMessage]]:
    """
    Main agent node.

    The LLM decides whether it needs to call tools.
    """

    video_id = state.get("video_id")
    system_prompt = build_system_prompt(video_id)

    response = await llm_with_tools.ainvoke(
        [
            SystemMessage(
                content=system_prompt,
            ),
            *state["messages"],
        ]
    )

    return {
        "messages": [response],
    }


tool_node = ToolNode(
    tools,
)

graph = StateGraph(ChatState)

graph.add_node(
    "agent",
    agent_node,
)

graph.add_node(
    "tools",
    tool_node,
)

graph.set_entry_point(
    "agent",
)

graph.add_conditional_edges(
    "agent",
    tools_condition,
)

graph.add_edge(
    "tools",
    "agent",
)

# IMPORTANT:
# If no tool call is produced,
# tools_condition automatically routes to END.
graph.add_edge(
    "agent",
    END,
)
memory = MemorySaver()
app: Any = graph.compile(checkpointer=memory)
