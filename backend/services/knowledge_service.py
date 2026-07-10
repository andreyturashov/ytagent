from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.chat import Chat
from db.models.chat_knowledge import ChatKnowledge
from db.models.knowledge_item import KnowledgeItem, KnowledgeType
from db.models.video import Video


class KnowledgeService:
    """
    Service responsible for managing knowledge items
    and attaching them to chats.
    """

    def __init__(
        self,
        session: AsyncSession | Any,
    ) -> None:
        self.session = session

    async def create_knowledge_item(
        self,
        *,
        knowledge_type: KnowledgeType,
        video: Video | None = None,
    ) -> KnowledgeItem:
        item = KnowledgeItem(
            type=knowledge_type,
            title=video.youtube_video_id if video is not None else "",
        )

        if video is not None:
            item.video = video

        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)

        return item

    async def get_knowledge_item(
        self,
        knowledge_item_id: int,
    ) -> KnowledgeItem | None:
        result = await self.session.execute(
            select(KnowledgeItem).where(
                KnowledgeItem.id == knowledge_item_id,
            )
        )

        return result.scalar_one_or_none()

    async def attach_to_chat(
        self,
        *,
        chat: Chat,
        knowledge_item: KnowledgeItem,
    ) -> ChatKnowledge:
        relation = ChatKnowledge(
            chat_id=chat.id,
            knowledge_item_id=knowledge_item.id,
        )

        self.session.add(relation)

        await self.session.commit()
        await self.session.refresh(relation)

        return relation

    async def list_chat_knowledge(
        self,
        chat: Chat,
    ) -> list[KnowledgeItem]:
        result = await self.session.execute(
            select(KnowledgeItem)
            .join(ChatKnowledge)
            .where(
                ChatKnowledge.chat_id == chat.id,
            )
        )

        return list(result.scalars())

    async def delete_knowledge_item(
        self,
        knowledge_item: KnowledgeItem,
    ) -> None:
        await self.session.delete(knowledge_item)
        await self.session.commit()
