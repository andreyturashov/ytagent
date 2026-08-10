from langchain_core.tools import tool

from db.session import AsyncSessionLocal
from services.knowledge_service import KnowledgeService
from services.search_service import SearchService


@tool
async def search_knowledge(
    query: str,
) -> str:
    """
    Search knowledge items belonging to the current chat.

    Use this tool when the user asks about:
    - previously analyzed videos
    - previously discussed topics
    - remembered knowledge
    """
    async with AsyncSessionLocal() as session:
        service = KnowledgeService(session)

        items = await service.search(query=query)

        if not items:
            return "No matching knowledge items were found."

        result = []

        for item in items:
            line = f"- [{item.knowledge_type}]"

            if item.video:
                line += f" YouTube: {item.video.youtube_video_id}"

            result.append(line)

        return "\n".join(result)


@tool
async def search_watch_history(
    query: str,
    user_id: int = 1,
) -> str:
    """
    Search the user's watched video history by date or topic (e.g. 'yesterday', 'MCP servers').

    Use this tool when the user asks:
    - What videos did I watch yesterday / recently / last week?
    - Which video was about a specific topic?
    - Search my watch history.
    """
    async with AsyncSessionLocal() as session:
        service = SearchService(session)
        results = await service.search(query=query, user_id=user_id)

        if not results:
            return "No matching videos found in watch history."

        output = []
        for r in results:
            v = r.video
            ki = r.knowledge_item
            accessed_str = ki.accessed_at.strftime("%Y-%m-%d %H:%M")
            url = ki.source_url or f"https://www.youtube.com/watch?v={v.youtube_video_id}"
            card = (
                f"- 🎥 **{v.title or 'Untitled Video'}** "
                f"by *{v.channel_title or 'Unknown Channel'}*\n"
                f"  - YouTube Video ID: `{v.youtube_video_id}`\n"
                f"  - Watched: {accessed_str}\n"
                f"  - URL: {url}"
            )
            if v.summary:
                card += f"\n  - Summary: {v.summary[:200]}..."
            output.append(card)

        return "\n\n".join(output)
