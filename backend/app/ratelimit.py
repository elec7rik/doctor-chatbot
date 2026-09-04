"""A small in-process, per-IP sliding-window rate limiter.

Cheap first-line abuse/cost guard: no external store, so the limit is per
instance/process. Combined with the per-request input caps (which bound the
cost of any single call) and a low --max-instances, that keeps worst-case spend
bounded. For a hard global limit later, move this to Cloud Armor or Redis.
"""
import time
from collections import defaultdict, deque
from threading import Lock

from .config import settings

_hits: dict[str, deque] = defaultdict(deque)
_lock = Lock()


def allow(ip: str) -> bool:
    """True if this IP may make another request now; records the hit if so."""
    now = time.time()
    window = settings.RATE_LIMIT_WINDOW_SEC
    cutoff = now - window
    with _lock:
        dq = _hits[ip]
        while dq and dq[0] < cutoff:
            dq.popleft()
        if len(dq) >= settings.RATE_LIMIT_MAX:
            return False
        dq.append(now)
        # Opportunistic memory bound: drop IPs whose windows have fully expired.
        if len(_hits) > 5000:
            for k in [k for k, v in list(_hits.items()) if not v or v[-1] < cutoff]:
                _hits.pop(k, None)
        return True
