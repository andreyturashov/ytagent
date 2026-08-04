from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from db.models.user import User
from services.user_service import UserService


def _make_session(**overrides: Any) -> MagicMock:
    session = MagicMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.delete = AsyncMock()
    session.execute = AsyncMock()
    for k, v in overrides.items():
        setattr(session, k, v)
    return session


# ------------------------------------------------------------------
# get_by_id
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_by_id_found() -> None:
    user = MagicMock(spec=User)

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = user

    session = _make_session(execute=AsyncMock(return_value=mock_result))
    service = UserService(session=session)

    result = await service.get_by_id(1)
    assert result is user


@pytest.mark.asyncio
async def test_get_by_id_not_found() -> None:
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None

    session = _make_session(execute=AsyncMock(return_value=mock_result))
    service = UserService(session=session)

    result = await service.get_by_id(999)
    assert result is None


# ------------------------------------------------------------------
# get_by_email
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_by_email_found() -> None:
    user = MagicMock(spec=User)

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = user

    session = _make_session(execute=AsyncMock(return_value=mock_result))
    service = UserService(session=session)

    result = await service.get_by_email("test@example.com")
    assert result is user


@pytest.mark.asyncio
async def test_get_by_email_not_found() -> None:
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None

    session = _make_session(execute=AsyncMock(return_value=mock_result))
    service = UserService(session=session)

    result = await service.get_by_email("missing@example.com")
    assert result is None


# ------------------------------------------------------------------
# create
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_user() -> None:
    session = _make_session()
    service = UserService(session=session)

    user = await service.create(email="new@example.com", name="New User")

    assert user.email == "new@example.com"
    assert user.name == "New User"
    session.add.assert_called_once()
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once()


# ------------------------------------------------------------------
# get_or_create
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_or_create_existing() -> None:
    existing_user = MagicMock(spec=User)

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = existing_user

    session = _make_session(execute=AsyncMock(return_value=mock_result))
    service = UserService(session=session)

    result = await service.get_or_create(email="exists@example.com")

    assert result is existing_user
    session.add.assert_not_called()  # no creation


@pytest.mark.asyncio
async def test_get_or_create_new() -> None:
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None

    session = _make_session(execute=AsyncMock(return_value=mock_result))
    service = UserService(session=session)

    result = await service.get_or_create(email="new@example.com", name="New")

    assert result.email == "new@example.com"
    session.add.assert_called_once()
    session.commit.assert_awaited_once()


# ------------------------------------------------------------------
# delete
# ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_user() -> None:
    user = MagicMock(spec=User)

    session = _make_session()
    service = UserService(session=session)

    await service.delete(user=user)

    session.delete.assert_awaited_once_with(user)
    session.commit.assert_awaited_once()
