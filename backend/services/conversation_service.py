from langchain_core.messages import AIMessage
from sqlalchemy.ext.asyncio import AsyncSession

from agents.youtube_agent import app as youtube_agent
from db.models.knowledge_item import KnowledgeType
from services.chat_service import ChatService
from services.knowledge_service import KnowledgeService
from services.message_service import MessageService
from services.user_service import UserService
from services.video_service import VideoService


class ConversationService:
    """
    High-level service orchestrating a conversation.

    Responsible for:

    - loading/creating chat
    - persisting messages
    - attaching knowledge
    - invoking the LangGraph agent
    """

    def __init__(
        self,
        session: AsyncSession,
    ) -> None:
        self.session = session

        self.users = UserService(session)
        self.chats = ChatService(session)
        self.messages = MessageService(session)
        self.knowledge = KnowledgeService(session)
        self.videos = VideoService(session)

    async def send_message(
        self,
        *,
        user_id: int,
        chat_id: int,
        message: str,
        youtube_video_id: str | None = None,
    ) -> str:
        """
        Main entrypoint used by API.
        """

        user = await self.users.get_by_id(user_id)

        if user is None:
            raise ValueError("User was not found.")

        chat = await self.chats.get_by_id(chat_id)

        if chat is None:
            raise ValueError("Chat was not found.")

        #
        # Save user message
        #

        await self.messages.add_user_message(
            chat=chat,
            content=message,
        )

        #
        # Attach video to chat if necessary
        #

        if youtube_video_id is not None:
            await self.knowledge.create_knowledge_item(
                knowledge_type=KnowledgeType.VIDEO,
                video=await self.videos.get_video_by_youtube_id(youtube_video_id),
            )

            # preload transcript if desired
            await self.videos.get_or_create_transcript(youtube_video_id)

        #
        # Build history for LangGraph
        #

        history = await self.messages.list_langchain_messages(chat)

        #
        # Execute agent
        #

        result = await youtube_agent.ainvoke(
            {
                "messages": history,
                "video_id": youtube_video_id,
            },
            config={
                "configurable": {
                    "thread_id": str(chat_id),
                }
            },
        )

        ai_message = result["messages"][-1]

        answer = str(ai_message.content) if isinstance(ai_message, AIMessage) else str(ai_message)

        #
        # Persist assistant message
        #

        await self.messages.add_assistant_message(
            chat=chat,
            content=answer,
        )

        return answer
