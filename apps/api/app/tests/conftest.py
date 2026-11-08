from __future__ import annotations

import os

# Sanitize proxy variables to prevent httpx IPv6 bracket parsing issues in container environments
for _var in ("NO_PROXY", "no_proxy"):
    _val = os.environ.get(_var)
    if _val and "[::1]" in _val:
        os.environ[_var] = _val.replace(",[::1]", "").replace("[::1],", "").replace("[::1]", "")
