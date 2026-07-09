from sqladmin import ModelView

from db.models.message import Message


class MessageAdmin(ModelView, model=Message):
    name = "Message"
    name_plural = "Messages"

    column_list = [
        Message.id,
        Message.content,
    ]
