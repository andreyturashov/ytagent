from typing import Annotated, Any, NotRequired, TypedDict

from langchain_core.messages import AnyMessage, SystemMessage
from langchain_ollama import ChatOllama
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

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
    model="llama3.1",
    temperature=0,
)

tools = [
    get_transcript,
]

llm_with_tools = llm.bind_tools(
    tools,
)


async def agent_node(
    state: ChatState,
) -> dict[str, list[AnyMessage]]:
    """
    Main agent node.

    The LLM decides whether it needs to call tools.
    """

    video_id = state.get("video_id")

    system_prompt = f"""
        You are a helpful YouTube assistant.

        Selected video ID:

        {video_id}

        Available tools:

        - get_transcript(video_id)

        Use get_transcript when:
        - user asks to summarize the video
        - user asks what was said in the video
        - user asks about video content
        - user asks for key takeaways
        - user asks questions requiring transcript information

        If the question can be answered without the transcript,
        answer directly.

        When using get_transcript:
        - first retrieve the transcript
        - then answer the user's question using the transcript
        - if the answer is not contained in the transcript,
        clearly say so
    """

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
