from .config import settings


def load_system_prompt() -> str:
    """Load the system instructions, dropping single-# annotation/comment lines
    (kept for humans) while preserving ## section headers."""
    with open(settings.PROMPT_PATH, encoding="utf-8") as f:
        raw = f.read()
    lines = [l for l in raw.splitlines() if not (l.startswith("#") and not l.startswith("##"))]
    return "\n".join(lines).strip()


SYSTEM_PROMPT = load_system_prompt()
