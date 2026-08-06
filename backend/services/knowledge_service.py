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
        user_id: int = 1,
        video: Video | Any | None = None,
    ) -> KnowledgeItem:
        # Determine the video_id for the new knowledge item
        video_id: int | None = None

        if isinstance(video, Video) and video.id is not None:
            video_id = video.id
        elif video is not None and not isinstance(video, Video):
            # Duck-typed object with youtube_video_id — create a real Video first
            new_video = Video(
                youtube_video_id=video.youtube_video_id,
            )
            self.session.add(new_video)
            await self.session.flush()
            video_id = new_video.id

        item = KnowledgeItem(
            user_id=user_id,
            knowledge_type=knowledge_type,
            video_id=video_id,
        )
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
