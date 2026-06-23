from fastapi import FastAPI
from sqladmin import Admin
from sqlalchemy.ext.asyncio import AsyncEngine

from admin.views import VideoAdmin


def setup_admin(
    app: FastAPI,
    engine: AsyncEngine,
) -> None:
    admin = Admin(
        app,
        engine,
    )

    admin.add_view(VideoAdmin)
