"""Restructure knowledge_items: add user ownership and video FK.

- Add user_id FK, video_id FK, source_url, accessed_at, knowledge_type
- Migrate data: type -> knowledge_type, populate video_id from videos.knowledge_item_id
- Drop title, type columns

Revision ID: a1b2c3d4e5f6
Revises: 94778f0ceddc
Create Date: 2026-08-05 15:29:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "94778f0ceddc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # --- Phase 1: Add new columns (nullable for data migration) ---

    # knowledge_type replaces type
    op.add_column(
        "knowledge_items",
        sa.Column("knowledge_type", sa.String(length=50), nullable=True),
    )

    # user_id FK (nullable initially, made NOT NULL after data migration)
    op.add_column(
        "knowledge_items",
        sa.Column("user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_knowledge_items_user_id",
        "knowledge_items",
        "users",
        ["user_id"],
        ["id"],
    )

    # video_id FK (nullable — only set for type=video)
    op.add_column(
        "knowledge_items",
        sa.Column("video_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_knowledge_items_video_id",
        "knowledge_items",
        "videos",
        ["video_id"],
        ["id"],
    )

    # source_url
    op.add_column(
        "knowledge_items",
        sa.Column("source_url", sa.String(length=2000), nullable=True),
    )

    # accessed_at
    op.add_column(
        "knowledge_items",
        sa.Column(
            "accessed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # --- Phase 2: Data migration ---

    # Copy type -> knowledge_type
    op.execute("UPDATE knowledge_items SET knowledge_type = type")

    # Populate video_id from the reverse FK on videos table
    op.execute(
        """
        UPDATE knowledge_items ki
        SET video_id = v.id
        FROM videos v
        WHERE v.knowledge_item_id = ki.id
        """
    )

    # Assign user_id: use the first available user, or create one if needed
    # For dev environments with existing data
    op.execute(
        """
        UPDATE knowledge_items
        SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1)
        WHERE user_id IS NULL
        """
    )

    # --- Phase 3: Enforce constraints ---

    # Make knowledge_type NOT NULL
    op.alter_column("knowledge_items", "knowledge_type", nullable=False)

    # Make user_id NOT NULL (only safe if all rows have been assigned)
    op.alter_column("knowledge_items", "user_id", nullable=False)

    # --- Phase 4: Drop old columns ---

    # Drop old type column
    op.drop_index(op.f("ix_knowledge_items_type"), table_name="knowledge_items")
    op.drop_column("knowledge_items", "type")

    # Drop title column (now lives on Video)
    op.drop_column("knowledge_items", "title")

    # --- Phase 5: Create indexes ---

    op.create_index(
        op.f("ix_knowledge_items_knowledge_type"),
        "knowledge_items",
        ["knowledge_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_knowledge_items_user_id"),
        "knowledge_items",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_knowledge_items_video_id"),
        "knowledge_items",
        ["video_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    # --- Drop new indexes ---
    op.drop_index(op.f("ix_knowledge_items_video_id"), table_name="knowledge_items")
    op.drop_index(op.f("ix_knowledge_items_user_id"), table_name="knowledge_items")
    op.drop_index(op.f("ix_knowledge_items_knowledge_type"), table_name="knowledge_items")

    # --- Restore old columns ---
    op.add_column(
        "knowledge_items",
        sa.Column("title", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "knowledge_items",
        sa.Column("type", sa.String(length=50), nullable=True),
    )

    # --- Data migration (reverse) ---
    op.execute("UPDATE knowledge_items SET type = knowledge_type")
    op.alter_column("knowledge_items", "type", nullable=False)

    # Restore index on type
    op.create_index(
        op.f("ix_knowledge_items_type"),
        "knowledge_items",
        ["type"],
        unique=False,
    )

    # --- Drop new columns ---
    op.drop_column("knowledge_items", "accessed_at")
    op.drop_column("knowledge_items", "source_url")

    op.drop_constraint("fk_knowledge_items_video_id", "knowledge_items", type_="foreignkey")
    op.drop_column("knowledge_items", "video_id")

    op.drop_constraint("fk_knowledge_items_user_id", "knowledge_items", type_="foreignkey")
    op.drop_column("knowledge_items", "user_id")

    op.drop_column("knowledge_items", "knowledge_type")
