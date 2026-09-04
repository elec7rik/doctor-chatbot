"""In-memory session store for the prototype. Swap for Redis/Postgres in Phase 3
(persistence, analytics, the 'best answers -> pages' flywheel)."""
import uuid
from collections import defaultdict

_sessions = defaultdict(list)  # session_id -> [{"role", "text"}]


def new_session_id() -> str:
    return uuid.uuid4().hex


def get_history(session_id: str):
    return list(_sessions.get(session_id, []))


def append(session_id: str, role: str, text: str):
    _sessions[session_id].append({"role": role, "text": text})
