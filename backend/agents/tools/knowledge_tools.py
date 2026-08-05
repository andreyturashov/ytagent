from langchain_core.tools import tool

from db.session import AsyncSessionLocal
from services.knowledge_service import KnowledgeService


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

    print(f"Searching knowledge for query: {query}")
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
