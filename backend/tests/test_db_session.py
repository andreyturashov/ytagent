from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_get_db_yields_session_and_closes() -> None:
    mock_session = AsyncMock()

    mock_context_manager = AsyncMock()
    mock_context_manager.__aenter__ = AsyncMock(return_value=mock_session)
    mock_context_manager.__aexit__ = AsyncMock(return_value=False)

    mock_session_local = MagicMock(return_value=mock_context_manager)

    with patch("db.session.AsyncSessionLocal", mock_session_local):
        from db.session import get_db

        gen = get_db()
        session = await gen.__anext__()

        assert session is mock_session

        with pytest.raises(StopAsyncIteration):
            await gen.__anext__()
