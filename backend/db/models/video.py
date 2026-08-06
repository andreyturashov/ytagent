from datetime import datetime
from typing import TYPE_CHECKING, Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import Computed, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

if TYPE_CHECKING:
    from db.models.knowledge_item import KnowledgeItem


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    youtube_video_id: Mapped[str] = mapped_column(
        unique=True,
        index=True,
    )

    # Content fields
    title: Mapped[str | None] = mapped_column(
        String(500),
    )

    channel_title: Mapped[str | None] = mapped_column(
        String(255),
    )

    description: Mapped[str | None] = mapped_column(
        Text,
    )

    summary: Mapped[str | None] = mapped_column(
        Text,
    )

    transcript: Mapped[str | None] = mapped_column(
        Text,
    )

    thumbnail_url: Mapped[str | None] = mapped_column(
        String(1000),
    )

    duration_seconds: Mapped[int | None] = mapped_column(
        Integer,
    )

    # Search infrastructure
    embedding: Mapped[Any] = mapped_column(
        Vector(768),
        nullable=True,
    )

    search_vector: Mapped[Any] = mapped_column(
        TSVECTOR,
        Computed(
            "to_tsvector('english', "
            "coalesce(title, '') || ' ' || "
            "coalesce(summary, '') || ' ' || "
            "coalesce(transcript, ''))",
            persisted=True,
        ),
        nullable=True,
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    knowledge_items: Mapped[list["KnowledgeItem"]] = relationship(
        back_populates="video",
        foreign_keys="[KnowledgeItem.video_id]",
    )
