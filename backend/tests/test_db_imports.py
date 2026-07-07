import sys


def test_importing_db_base_does_not_raise_circular_import_error() -> None:
    for module_name in [
        "db.base",
        "db.models",
        "db.models.chat",
        "db.models.chat_knowledge",
        "db.models.knowledge_item",
        "db.models.message",
        "db.models.user",
        "db.models.video",
    ]:
        sys.modules.pop(module_name, None)

    from db.base import Base
    from db.models.video import Video

    assert Base is not None
    assert Video.__tablename__ == "videos"
    assert "videos" in Base.metadata.tables
