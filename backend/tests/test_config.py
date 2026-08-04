from unittest.mock import patch

import config


def test_build_database_url_default() -> None:
    with patch.object(config, "DATABASE_URL", None):
        url = config.build_database_url()
        assert url.startswith("postgresql+asyncpg://")
        assert "localhost" in url
        assert "ytagent" in url


def test_build_database_url_custom() -> None:
    custom_url = "postgresql+asyncpg://user:pass@customhost:5432/customdb"
    with patch.object(config, "DATABASE_URL", custom_url):
        url = config.build_database_url()
        assert url == custom_url
