# db/models/chat_knowledge.py

from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from db.models.chat import Chat
    from db.models.knowledge_item import KnowledgeItem

from sqlalchemy import Boolean, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class ChatKnowledge(Base):
    __tablename__ = "chat_knowledge"

    __table_args__ = (
        UniqueConstraint(
            "chat_id",
            "knowledge_item_id",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    chat_id: Mapped[int] = mapped_column(
        ForeignKey("chats.id"),
        index=True,
    )

    knowledge_item_id: Mapped[int] = mapped_column(
        ForeignKey("knowledge_items.id"),
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
    )

    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    chat: Mapped["Chat"] = relationship(
        back_populates="knowledge",
    )

    knowledge_item: Mapped["KnowledgeItem"] = relationship(
        back_populates="chats",
    )
