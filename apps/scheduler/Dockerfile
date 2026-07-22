FROM python:3.13-slim-bookworm AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build

RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY apps/api/pyproject.toml ./pyproject.toml
COPY apps/api/app ./app
RUN pip install --upgrade pip && pip install .

FROM python:3.13-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/venv/bin:$PATH"

RUN groupadd --gid 10001 respio \
    && useradd --uid 10001 --gid respio --create-home --shell /usr/sbin/nologin respio

WORKDIR /app

COPY --from=builder /venv /venv
COPY apps/api/app ./app

USER respio

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os; from redis import Redis; client=Redis.from_url(os.environ['REDIS_URL']); assert client.ping(); client.close()"

CMD ["python", "-m", "app.scheduler.main"]
