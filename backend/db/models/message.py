from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from db.models.chat import Chat

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    chat_id: Mapped[int] = mapped_column(
        ForeignKey("chats.id"),
        index=True,
    )

    role: Mapped[str] = mapped_column()

    content: Mapped[str] = mapped_column(
        Text,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    chat: Mapped["Chat"] = relationship(
        back_populates="messages",
    )
