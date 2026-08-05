from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
        video: Video | Any | None = None,
    ) -> KnowledgeItem:
        # The FK column is read instead of the `knowledge_item` relationship
        # because AsyncSession cannot lazy-load relationships.
        if isinstance(video, Video) and video.knowledge_item_id is not None:
            existing_item = await self.get_knowledge_item(video.knowledge_item_id)

            if existing_item is not None:
                return existing_item

        item = KnowledgeItem(
            knowledge_type=knowledge_type,
        )
        self.session.add(item)

        if video is not None:
            await self.session.flush()

            if isinstance(video, Video):
                video.knowledge_item_id = item.id
                self.session.add(video)
            else:
                self.session.add(
                    Video(
                        knowledge_item_id=item.id,
                        youtube_video_id=video.youtube_video_id,
                    )
                )

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

    async def search(
        self,
        query: str,
    ) -> list[KnowledgeItem]:
        stmt = (
            select(KnowledgeItem)
            .options(
                selectinload(KnowledgeItem.video),
            )
            .join(Video, isouter=True)
            .where(
                or_(
                    Video.youtube_video_id.ilike(f"%{query}%"),
                    KnowledgeItem.knowledge_type.ilike(f"%{query}%"),
                )
            )
        )

        result = await self.session.execute(stmt)

        return list(result.scalars().unique())
