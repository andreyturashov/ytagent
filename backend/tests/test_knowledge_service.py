import asyncio
from typing import Any

from db.models.knowledge_item import KnowledgeType
from services.knowledge_service import KnowledgeService


class FakeSession:
    def __init__(self) -> None:
        self.added: list[object] = []

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        return None

    async def refresh(self, obj: object) -> None:
        return None


def test_create_knowledge_item_persists_video_id() -> None:
    session: Any = FakeSession()
    service = KnowledgeService(session=session)

    async def run_test() -> None:
        item = await service.create_knowledge_item(
            knowledge_type=KnowledgeType.VIDEO,
            video=type("Video", (), {"youtube_video_id": "abc123"})(),
        )

        assert item.title == "abc123"

    asyncio.run(run_test())
