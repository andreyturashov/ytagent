from fastapi import FastAPI
from sqladmin import Admin
from sqlalchemy.ext.asyncio import AsyncEngine

from admin.views.chat import ChatAdmin
from admin.views.chat_knowledge import ChatKnowledgeAdmin
from admin.views.knowledge_item import KnowledgeItemAdmin
from admin.views.message import MessageAdmin
from admin.views.video import VideoAdmin


def setup_admin(
    app: FastAPI,
    engine: AsyncEngine,
) -> None:
    admin = Admin(
        app,
        engine,
    )

    admin.add_view(ChatAdmin)
    admin.add_view(ChatKnowledgeAdmin)
    admin.add_view(KnowledgeItemAdmin)
    admin.add_view(MessageAdmin)
    admin.add_view(VideoAdmin)
