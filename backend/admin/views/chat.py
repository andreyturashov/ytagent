from sqladmin import ModelView

from db.models.chat import Chat


class ChatAdmin(ModelView, model=Chat):
    name = "Chat"
    name_plural = "Chats"

    column_list = [
        Chat.id,
        Chat.title,
    ]
