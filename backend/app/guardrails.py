"""Deterministic pre-LLM backstop. Guarantees a safe response for the clearest
crises BEFORE the model is ever called. Deliberately conservative — the model
handles nuance well (proven in eval); this only hard-catches the unambiguous cases."""
import re
from typing import Optional

_SELF_HARM = re.compile(
    r"\b(kill(ing)? myself|end (my life|it all|things)|ending (my life|things|it all)|"
    r"take my own life|suicid|self[-\s]?harm|hurt(ing)? myself|"
    r"don'?t want to (live|be here|wake up)|want to die)\b",
    re.I,
)

_EMERGENCY = re.compile(
    r"\b(heart attack|can'?t breathe|cannot breathe|not breathing|having a stroke|"
    r"overdose|overdosed|unconscious|anaphyla|choking|severe bleeding|coughing up blood)\b",
    re.I,
)

_CRISIS_MSG = (
    "I'm really sorry you're feeling like this — you deserve support right now, and you "
    "don't have to face it alone.\n\n"
    "Please reach out immediately:\n"
    "• Samaritans — call 116 123 (free, 24/7)\n"
    "• Text SHOUT to 85258\n"
    "• If you might act on these thoughts, call 999 or go to your nearest A&E\n"
    "• You can also call NHS 111 or speak to your GP\n\n"
    "Please contact one of these now."
)

_EMERGENCY_MSG = (
    "This could be a medical emergency. Please call 999 now (or have someone take you to the "
    "nearest A&E). Don't wait — this needs urgent medical help straight away."
)


def check_emergency(text: str) -> Optional[str]:
    if not text:
        return None
    if _SELF_HARM.search(text):
        return _CRISIS_MSG
    if _EMERGENCY.search(text):
        return _EMERGENCY_MSG
    return None
