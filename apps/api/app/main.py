from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.admin import router as admin_router
from app.api.ai import router as ai_router
from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.api.automation_rules import router as automation_rules_router
from app.api.billing import router as billing_router
from app.api.contact import router as contact_router
from app.api.health import router as health_router
from app.api.marketplace_accounts import router as marketplace_accounts_router
from app.api.messages import router as messages_router
from app.api.organizations import router as organizations_router
from app.api.replies import router as replies_router
from app.api.yandex_auth import router as yandex_auth_router
from app.core.config import get_settings
from app.core.lifecycle import application_lifespan
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware, SecurityHeadersMiddleware
from app.core.observability import configure_observability


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    configure_observability(settings)

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/docs" if settings.app_env != "production" else None,
        redoc_url="/redoc" if settings.app_env != "production" else None,
        lifespan=application_lifespan,
    )

    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)
    if settings.security_headers_enabled:
        app.add_middleware(SecurityHeadersMiddleware, production=settings.app_env == "production")
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-CSRF-Token", "X-Organization-Id", "X-Request-ID"],
        expose_headers=["X-Request-ID", "X-Billing-Order-Not-Created"],
    )

    app.include_router(health_router)
    app.include_router(admin_router)
    app.include_router(analytics_router)
    app.include_router(billing_router)
    app.include_router(contact_router)
    app.include_router(ai_router)
    app.include_router(automation_rules_router)
    app.include_router(auth_router)
    app.include_router(yandex_auth_router)
    app.include_router(organizations_router)
    app.include_router(marketplace_accounts_router)
    app.include_router(messages_router)
    app.include_router(replies_router)
    return app


app = create_app()
