# db/models/knowledge_item.py

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

if TYPE_CHECKING:
    from db.models.chat_knowledge import ChatKnowledge
    from db.models.user import User
    from db.models.video import Video


class KnowledgeType(StrEnum):
    VIDEO = "video"
    WEBSITE = "website"
    PDF = "pdf"
    GITHUB = "github"


class KnowledgeItem(Base):
    __tablename__ = "knowledge_items"

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True,
    )

    knowledge_type: Mapped[str] = mapped_column(
        String(50),
        index=True,
    )

    # FK to type-specific content (nullable — only one will be set per type)
    video_id: Mapped[int | None] = mapped_column(
        ForeignKey("videos.id"),
        index=True,
    )

    source_url: Mapped[str | None] = mapped_column(
        String(2000),
    )

    accessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationships
    user: Mapped["User"] = relationship(
        back_populates="knowledge_items",
    )

    video: Mapped["Video | None"] = relationship(
        back_populates="knowledge_items",
        foreign_keys="[KnowledgeItem.video_id]",
    )

    chats: Mapped[list["ChatKnowledge"]] = relationship(
        back_populates="knowledge_item",
    )
