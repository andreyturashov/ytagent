from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import the models package to register all ORM classes with Base.metadata.
from db import models  # noqa: F401, E402
