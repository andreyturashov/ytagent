from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.chat import Chat
from db.models.message import Message, MessageRole


class MessageService:
    """
    Service responsible for chat messages.
    """

    def __init__(
        self,
        session: AsyncSession,
    ) -> None:
        self.session = session

    async def add_user_message(
        self,
        *,
        chat: Chat,
        content: str,
    ) -> Message:
        return await self._create_message(
            chat=chat,
            role=MessageRole.USER,
            content=content,
        )

    async def add_assistant_message(
        self,
        *,
        chat: Chat,
        content: str,
    ) -> Message:
        return await self._create_message(
            chat=chat,
            role=MessageRole.ASSISTANT,
            content=content,
        )

    async def add_tool_message(
        self,
        *,
        chat: Chat,
        content: str,
    ) -> Message:
        return await self._create_message(
            chat=chat,
            role=MessageRole.TOOL,
            content=content,
        )

    async def _create_message(
        self,
        *,
        chat: Chat,
        role: MessageRole,
        content: str,
    ) -> Message:
        message = Message(
            chat_id=chat.id,
            role=role,
            content=content,
        )

        self.session.add(message)

        await self.session.commit()
        await self.session.refresh(message)

        return message

    async def get_message(
        self,
        message_id: int,
    ) -> Message | None:
        result = await self.session.execute(
            select(Message).where(
                Message.id == message_id,
            )
        )

        return result.scalar_one_or_none()

    async def list_messages(
        self,
        chat: Chat,
    ) -> list[Message]:
        result = await self.session.execute(
            select(Message).where(Message.chat_id == chat.id).order_by(Message.created_at)
        )

        return list(result.scalars())

    async def get_recent_messages(
        self,
        chat: Chat,
        *,
        limit: int = 20,
    ) -> list[Message]:
        result = await self.session.execute(
            select(Message)
            .where(Message.chat_id == chat.id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )

        messages = list(result.scalars())

        return list(reversed(messages))

    async def delete_message(
        self,
        message: Message,
    ) -> None:
        await self.session.delete(message)

        await self.session.commit()
