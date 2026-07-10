from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.chat import Chat
from db.models.user import User


class ChatService:
    """
    Service responsible for chat lifecycle.
    """

    def __init__(
        self,
        session: AsyncSession,
    ) -> None:
        self.session = session

    async def create_chat(
        self,
        *,
        user: User,
        title: str | None = None,
    ) -> Chat:
        chat = Chat(
            user_id=user.id,
            title=title or "New Chat",
        )

        self.session.add(chat)

        await self.session.commit()
        await self.session.refresh(chat)

        return chat

    async def get_by_id(
        self,
        chat_id: int,
    ) -> Chat | None:
        result = await self.session.execute(
            select(Chat).where(Chat.id == chat_id),
        )

        return result.scalar_one_or_none()

    async def list_user_chats(
        self,
        user: User,
    ) -> list[Chat]:
        result = await self.session.execute(
            select(Chat).where(Chat.user_id == user.id).order_by(Chat.updated_at.desc())
        )

        return list(result.scalars())

    async def touch(
        self,
        chat: Chat,
    ) -> None:
        chat.updated_at = datetime.now(UTC)

    async def delete_chat(
        self,
        chat: Chat,
    ) -> None:
        await self.session.delete(chat)
        await self.session.commit()
