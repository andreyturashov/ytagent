from sqladmin import ModelView

from db.models.chat_knowledge import ChatKnowledge


class ChatKnowledgeAdmin(ModelView, model=ChatKnowledge):
    name = "Chat Knowledge"
    name_plural = "Chat Knowledge"

    column_list = [
        ChatKnowledge.id,
        ChatKnowledge.is_active,
    ]
