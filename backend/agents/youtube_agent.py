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

    return f"""
        You are a helpful YouTube assistant.
        Current System Time: {now_str}

        Selected video ID: {video_id or "None"}

        Your job is to answer the user's question clearly and usefully.

        Important rules:
        - Never output raw tool calls, JSON, or function-call syntax.
        - Do not say things like "I will call the get_transcript function".
        - Do not return intermediate steps or tool metadata.
        - If transcript information is needed, use the tool silently. Then answer the user directly.
        - If the answer is not contained in the transcript, clearly say so.

        Available tools:
        - get_transcript(video_id): Get transcript text for a specific video.
        - search_watch_history(query): Search user's watched videos by date or topic.
        - search_knowledge(query): Search saved knowledge items.

        Use search_watch_history when:
        - the user asks what videos they watched yesterday, recently, or last week
        - the user asks which video was about a topic or question

        After using a tool, provide a natural-language answer to the user.
        Never expose the tool call itself.
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
