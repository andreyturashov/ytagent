from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db

type DbSession = Annotated[AsyncSession, Depends(get_db)]
