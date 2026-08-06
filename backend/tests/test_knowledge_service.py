from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from db.models.chat import Chat
from db.models.knowledge_item import KnowledgeItem, KnowledgeType
from db.models.video import Video
from services.knowledge_service import KnowledgeService


def _make_session(**overrides: Any) -> MagicMock:
    session = MagicMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.delete = AsyncMock()
    session.execute = AsyncMock()
    for k, v in overrides.items():
        setattr(session, k, v)
    return session


# ------------------------------------------------------------------
# create_knowledge_item
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_knowledge_item_with_non_video_object() -> None:
    """Non-Video duck-typed object — creates a Video first, then KI with video_id."""
    session = _make_session()
    service = KnowledgeService(session=session)

    fake_video: Any = MagicMock()
    fake_video.youtube_video_id = "duck123"

    item = await service.create_knowledge_item(
        knowledge_type=KnowledgeType.VIDEO,
        video=fake_video,
    )

    assert item.knowledge_type == KnowledgeType.VIDEO
    assert session.add.call_count >= 2  # Video + KnowledgeItem
    session.flush.assert_awaited_once()
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_knowledge_item_with_real_video() -> None:
    """Video instance with id — KI.video_id is set to the video's id."""
    session = _make_session()
    service = KnowledgeService(session=session)

    video = MagicMock(spec=Video)
    video.id = 42
    video.youtube_video_id = "vid1"

    item = await service.create_knowledge_item(
        knowledge_type=KnowledgeType.VIDEO,
        video=video,
    )

    assert item.knowledge_type == KnowledgeType.VIDEO
    assert item.video_id == 42
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_knowledge_item_no_video() -> None:
    """No video at all — video_id is None."""
    session = _make_session()
    service = KnowledgeService(session=session)

    item = await service.create_knowledge_item(
        knowledge_type=KnowledgeType.WEBSITE,
    )

    assert item.knowledge_type == KnowledgeType.WEBSITE
    assert item.video_id is None
    session.flush.assert_not_awaited()  # flush only when duck-typed video
    session.commit.assert_awaited_once()


# ------------------------------------------------------------------
# get_knowledge_item
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_knowledge_item() -> None:
    ki = KnowledgeItem(knowledge_type=KnowledgeType.VIDEO)

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = ki

    session = _make_session(execute=AsyncMock(return_value=mock_result))
    service = KnowledgeService(session=session)

    result = await service.get_knowledge_item(1)
    assert result is ki


@pytest.mark.asyncio
async def test_get_knowledge_item_not_found() -> None:
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None

    session = _make_session(execute=AsyncMock(return_value=mock_result))
    service = KnowledgeService(session=session)

    result = await service.get_knowledge_item(999)
    assert result is None


# ------------------------------------------------------------------
# attach_to_chat
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_attach_to_chat() -> None:
    chat = MagicMock(spec=Chat)
    chat.id = 10
    ki = MagicMock(spec=KnowledgeItem)
    ki.id = 20

    session = _make_session()
    service = KnowledgeService(session=session)

    relation = await service.attach_to_chat(chat=chat, knowledge_item=ki)

    assert relation.chat_id == 10
    assert relation.knowledge_item_id == 20
    session.add.assert_called_once()
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once()


# ------------------------------------------------------------------
# list_chat_knowledge
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_chat_knowledge() -> None:
    ki1 = KnowledgeItem(knowledge_type=KnowledgeType.VIDEO)
    ki2 = KnowledgeItem(knowledge_type=KnowledgeType.WEBSITE)

    mock_scalars = MagicMock()
    mock_scalars.__iter__ = MagicMock(return_value=iter([ki1, ki2]))
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars

    session = _make_session(execute=AsyncMock(return_value=mock_result))
    service = KnowledgeService(session=session)

    chat = MagicMock(spec=Chat)
    chat.id = 5

    items = await service.list_chat_knowledge(chat=chat)
    assert items == [ki1, ki2]


# ------------------------------------------------------------------
# delete_knowledge_item
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_knowledge_item() -> None:
    ki = KnowledgeItem(knowledge_type=KnowledgeType.VIDEO)

    session = _make_session()
    service = KnowledgeService(session=session)

    await service.delete_knowledge_item(ki)

    session.delete.assert_awaited_once_with(ki)
    session.commit.assert_awaited_once()


# ------------------------------------------------------------------
# search
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_search() -> None:
    ki = KnowledgeItem(knowledge_type=KnowledgeType.VIDEO)

    mock_unique = MagicMock()
    mock_unique.__iter__ = MagicMock(return_value=iter([ki]))
    mock_scalars = MagicMock()
    mock_scalars.unique.return_value = mock_unique
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars

    session = _make_session(execute=AsyncMock(return_value=mock_result))
    service = KnowledgeService(session=session)

    results = await service.search("video")
    assert results == [ki]
    session.execute.assert_awaited_once()
