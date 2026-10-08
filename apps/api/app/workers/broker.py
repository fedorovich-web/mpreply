from __future__ import annotations

import dramatiq
from dramatiq.brokers.redis import RedisBroker
from dramatiq.middleware import AsyncIO

from app.core.config import get_settings

settings = get_settings()
redis_broker = RedisBroker(url=settings.redis_url.get_secret_value(), namespace="respio")
redis_broker.add_middleware(AsyncIO())
dramatiq.set_broker(redis_broker)
