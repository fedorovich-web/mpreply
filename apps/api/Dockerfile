FROM python:3.13-slim-bookworm AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build

RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY pyproject.toml ./
COPY app ./app
RUN pip install --upgrade pip && pip install .

FROM python:3.13-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/venv/bin:$PATH"

RUN groupadd --gid 10001 respio \
    && useradd --uid 10001 --gid respio --create-home --shell /usr/sbin/nologin respio

WORKDIR /app

COPY --from=builder /venv /venv
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

USER respio

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os, urllib.parse, urllib.request; request = urllib.request.Request('http://127.0.0.1:8000/health/live', headers={'Host': urllib.parse.urlparse(os.environ['API_BASE_URL']).netloc}); urllib.request.urlopen(request, timeout=3).read()"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
