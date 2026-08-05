from sqladmin import ModelView

from db.models.knowledge_item import KnowledgeItem


class KnowledgeItemAdmin(ModelView, model=KnowledgeItem):
    name = "Knowledge Item"
    name_plural = "Knowledge Items"

    column_list = [
        KnowledgeItem.id,
        KnowledgeItem.knowledge_type,
    ]
