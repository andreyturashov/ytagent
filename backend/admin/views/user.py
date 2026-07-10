from sqladmin import ModelView

from db.models.user import User


class UserAdmin(ModelView, model=User):
    name = "User"
    name_plural = "Users"

    column_list = [
        User.id,
        User.email,
        User.name,
    ]
