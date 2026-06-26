# db/models/knowledge_item.py

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base
from db.models.chat_knowledge import ChatKnowledge
from db.models.video import Video


class KnowledgeItem(Base):
    __tablename__ = "knowledge_items"

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    type: Mapped[str] = mapped_column(
        String(50),
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(500),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    chats: Mapped[list["ChatKnowledge"]] = relationship(
        back_populates="knowledge_item",
    )

    video: Mapped["Video"] = relationship(
        back_populates="knowledge_item",
        uselist=False,
    )
