from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db.session import engine


@asynccontextmanager
async def application_lifespan(_: FastAPI) -> AsyncGenerator[None]:
    try:
        yield
    finally:
        await engine.dispose()
