import logging

import pytest
from uvicorn.logging import AccessFormatter

from app.core.logging import configure_logging


@pytest.mark.parametrize("status", [303, 400])
def test_uvicorn_access_log_removes_oauth_query_but_keeps_request_and_status(status: int) -> None:
    configure_logging("INFO")
    logger = logging.getLogger("uvicorn.access")
    record = logger.makeRecord("uvicorn.access", logging.INFO, "", 0, '%s - "%s %s HTTP/%s" %d',
                               ("127.0.0.1:12345", "GET", "/api/auth/yandex/callback?code=secret-code&state=secret-state", "1.1", status), None)
    assert logger.filter(record)
    formatted = AccessFormatter(fmt="%(request_line)s %(status_code)s", use_colors=False).format(record)
    assert "secret-code" not in formatted and "secret-state" not in formatted
    assert "GET /api/auth/yandex/callback HTTP/1.1" in formatted and str(status) in formatted
