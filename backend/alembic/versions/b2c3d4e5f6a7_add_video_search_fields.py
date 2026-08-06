"""Add search fields to videos, drop knowledge_item_id.

- Enable pgvector extension
- Add title, channel_title, description, summary, thumbnail_url,
  duration_seconds, embedding, search_vector to videos
- Drop knowledge_item_id FK and column from videos
- Build HNSW, GIN, and B-tree indexes

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-06 09:44:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: str | Sequence[str] | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # --- Phase 1: Enable pgvector extension ---
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # --- Phase 2: Add content columns to videos ---
    op.add_column(
        "videos",
        sa.Column("title", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "videos",
        sa.Column("channel_title", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "videos",
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.add_column(
        "videos",
        sa.Column("summary", sa.Text(), nullable=True),
    )
    op.add_column(
        "videos",
        sa.Column("thumbnail_url", sa.String(length=1000), nullable=True),
    )
    op.add_column(
        "videos",
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
    )

    # --- Phase 3: Add search infrastructure columns ---

    # Vector embedding column (768-dim for nomic-embed-text)
    op.execute("ALTER TABLE videos ADD COLUMN embedding vector(768)")

    # Full-text search generated column
    op.execute(
        """
        ALTER TABLE videos ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
            to_tsvector('english',
                coalesce(title, '') || ' ' ||
                coalesce(summary, '') || ' ' ||
                coalesce(transcript, ''))
        ) STORED
        """
    )

    # --- Phase 4: Drop old knowledge_item_id FK from videos ---
    # The FK direction is now reversed: KnowledgeItem.video_id -> Video
    op.execute("ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_knowledge_item_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_videos_knowledge_item_id")
    op.execute("ALTER TABLE videos DROP COLUMN IF EXISTS knowledge_item_id")

    # --- Phase 5: Build search indexes ---

    # HNSW index for fast vector similarity search
    op.execute(
        "CREATE INDEX idx_videos_embedding ON videos USING hnsw (embedding vector_cosine_ops)"
    )

    # GIN index for full-text search
    op.execute("CREATE INDEX idx_videos_search_vector ON videos USING gin (search_vector)")

    # B-tree index on accessed_at for temporal queries
    op.create_index(
        "ix_knowledge_items_accessed_at",
        "knowledge_items",
        [sa.text("accessed_at DESC")],
    )


def downgrade() -> None:
    """Downgrade schema."""
    # --- Drop indexes ---
    op.drop_index("ix_knowledge_items_accessed_at", table_name="knowledge_items")
    op.execute("DROP INDEX IF EXISTS idx_videos_search_vector")
    op.execute("DROP INDEX IF EXISTS idx_videos_embedding")

    # --- Restore knowledge_item_id on videos ---
    op.add_column(
        "videos",
        sa.Column("knowledge_item_id", sa.Integer(), nullable=True),
    )
    # Populate from knowledge_items.video_id (reverse migration)
    op.execute(
        """
        UPDATE videos v
        SET knowledge_item_id = ki.id
        FROM knowledge_items ki
        WHERE ki.video_id = v.id
        """
    )
    op.create_index(
        op.f("ix_videos_knowledge_item_id"),
        "videos",
        ["knowledge_item_id"],
        unique=True,
    )
    op.create_foreign_key(
        None,
        "videos",
        "knowledge_items",
        ["knowledge_item_id"],
        ["id"],
    )

    # --- Drop search infrastructure ---
    op.execute("ALTER TABLE videos DROP COLUMN IF EXISTS search_vector")
    op.execute("ALTER TABLE videos DROP COLUMN IF EXISTS embedding")

    # --- Drop content columns ---
    op.drop_column("videos", "duration_seconds")
    op.drop_column("videos", "thumbnail_url")
    op.drop_column("videos", "summary")
    op.drop_column("videos", "description")
    op.drop_column("videos", "channel_title")
    op.drop_column("videos", "title")

    # --- Drop pgvector extension ---
    op.execute("DROP EXTENSION IF EXISTS vector")
