from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.adapters.http import MarketplaceHttpClients
from app.adapters.registry import create_marketplace_registry
from app.db.session import engine


@asynccontextmanager
async def application_lifespan(app: FastAPI) -> AsyncGenerator[None]:
    clients = MarketplaceHttpClients.create()
    try:
        app.state.marketplace_http_clients = clients
        app.state.marketplace_registry = create_marketplace_registry(clients)
        yield
    finally:
        await clients.aclose()
        await engine.dispose()
