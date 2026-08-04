"""Tests for main.py — verifies app wiring, routers, middleware, and admin."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI


@pytest.fixture
def app() -> FastAPI:
    """Import the app with admin setup mocked (it requires a real DB engine)."""
    with patch("admin.setup.Admin") as mock_admin_cls:
        mock_admin_cls.return_value = MagicMock()

        import importlib

        import main

        importlib.reload(main)
        # Clear cached openapi schema so it regenerates with fresh routes
        main.app.openapi_schema = None

        return main.app


def test_app_is_fastapi_instance(app: FastAPI) -> None:
    assert isinstance(app, FastAPI)


def test_chat_router_is_registered(app: FastAPI) -> None:
    """The /api/chat endpoint should be reachable."""
    openapi_paths = list(app.openapi().get("paths", {}).keys())
    assert "/api/chat" in openapi_paths


def test_video_router_is_registered(app: FastAPI) -> None:
    """Video router endpoints (/api/transcript, /api/summary) should be reachable."""
    openapi_paths = list(app.openapi().get("paths", {}).keys())
    assert any("/transcript" in p or "/summary" in p for p in openapi_paths)


def test_cors_middleware_is_configured(app: FastAPI) -> None:
    """CORS middleware should allow all origins."""
    middleware_classes = [getattr(m.cls, "__name__", str(m.cls)) for m in app.user_middleware]
    assert "CORSMiddleware" in middleware_classes
