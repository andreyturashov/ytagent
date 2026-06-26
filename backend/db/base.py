from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models to register them with Base.metadata
from db.models.chat import Chat  # noqa: F401, E402
from db.models.chat_knowledge import ChatKnowledge  # noqa: F401, E402
from db.models.knowledge_item import KnowledgeItem  # noqa: F401, E402
from db.models.message import Message  # noqa: F401, E402
from db.models.user import User  # noqa: F401, E402
from db.models.video import Video  # noqa: F401, E402
