from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.user import User


class UserService:
    """
    Service responsible for user management.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(
        self,
        user_id: int,
    ) -> User | None:
        result = await self.session.execute(
            select(User).where(User.id == user_id),
        )

        return result.scalar_one_or_none()

    async def get_by_email(
        self,
        email: str,
    ) -> User | None:
        result = await self.session.execute(
            select(User).where(User.email == email),
        )

        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        email: str,
        name: str | None = None,
    ) -> User:
        user = User(
            email=email,
            name=name,
        )

        self.session.add(user)

        await self.session.commit()
        await self.session.refresh(user)

        return user

    async def get_or_create(
        self,
        *,
        email: str,
        name: str | None = None,
    ) -> User:
        user = await self.get_by_email(email)

        if user:
            return user

        return await self.create(
            email=email,
            name=name,
        )

    async def delete(
        self,
        user: User,
    ) -> None:
        await self.session.delete(user)
        await self.session.commit()
