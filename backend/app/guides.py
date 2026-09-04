"""My Longevity Hub educational guides — the content hub the agent points to.

Single source of truth for: the guide list, the system-prompt block (so both
the text and voice models know what exists), the text-mode marker rule, and the
voice tool's slug/topic -> card resolution. Guide pages are served by main.py at
/guides/<slug>; the card link is always a same-origin /guides/ path, so the
partner-URL sanitizer never touches it.
"""
import re

GUIDES = [
    {"slug": "better-sleep", "title": "How to Sleep Better, Naturally",
     "topics": ["sleep", "insomnia", "can't sleep", "sleep quality", "waking at night", "magnesium for sleep"]},
    {"slug": "why-am-i-always-tired", "title": "Why Am I Always Tired? Getting Your Energy Back",
     "topics": ["energy", "fatigue", "tired", "tiredness", "low energy", "exhausted", "nad"]},
    {"slug": "what-supplements-to-take", "title": "What Supplements Should You Actually Take?",
     "topics": ["supplements", "multivitamin", "vitamin d", "omega 3", "magnesium", "creatine", "what should i take"]},
    {"slug": "skincare", "title": "Skincare That Actually Works",
     "topics": ["skin", "skincare", "wrinkles", "collagen", "ageing skin", "ghk-cu", "copper peptide"]},
    {"slug": "hair-loss", "title": "Hair Loss and Hair Growth: What Actually Works",
     "topics": ["hair", "hair loss", "hair growth", "thinning hair", "balding", "minoxidil", "finasteride", "biotin"]},
    {"slug": "testosterone", "title": "Low Testosterone: Signs, Causes and What Helps",
     "topics": ["testosterone", "low testosterone", "libido", "trt", "testosterone booster"]},
    {"slug": "menopause", "title": "Menopause and Perimenopause: Symptoms, HRT and Support",
     "topics": ["menopause", "perimenopause", "hot flushes", "hrt", "night sweats"]},
]

_BY_SLUG = {g["slug"]: g for g in GUIDES}


def _alnum(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _card(g: dict) -> dict:
    return {"url": f"/guides/{g['slug']}", "title": g["title"],
            "subtitle": "My Longevity Hub guide", "brand": "guide"}


def build_guides_block() -> str:
    """Compact list of our guides + when to use them — appended to the shared system prompt."""
    lines = ["=== MY LONGEVITY HUB GUIDES (our own educational pages — point to the fitting one) ==="]
    for g in GUIDES:
        lines.append(f"  - slug: {g['slug']} — \"{g['title']}\" (covers: {', '.join(g['topics'][:5])})")
    lines.append(
        "\nThese are OUR pages on this site (each lives at /guides/<slug>). When a user's question is well "
        "covered by one of them, point them to that guide as the natural, no-pressure next step — a softer, "
        "more helpful hook than a product link, and a good place to send someone before or instead of a brand. "
        "Pick at most ONE guide: the single best match. Only ever reference a guide that appears in this list; "
        "never invent a slug or a guide that isn't here."
    )
    return "\n".join(lines)


# Text chat: the model marks a guide with a token the browser turns into a card.
TEXT_GUIDE_RULE = (
    "\n\n## LINKING A GUIDE (written chat)\n"
    "When one of the My Longevity Hub guides listed above genuinely fits the question, add a card for it by "
    "writing a marker on its OWN line at the very end of your reply, in exactly this form: [[guide:<slug>]] — "
    "for example [[guide:better-sleep]]. Use the exact slug from the list. Add at most one marker, and only when "
    "it truly helps. Never put the marker inside a sentence and never explain it — just place it on its own final "
    "line. The app turns it into a tappable card, so you don't need to write out the web address."
)


def resolve_guide(query: str):
    """Map a slug or free-text topic (from the voice show_guide_card tool) to a card, or None."""
    q = (query or "").strip()
    if q in _BY_SLUG:
        return _card(_BY_SLUG[q])
    a = _alnum(q)
    if not a:
        return None
    for g in GUIDES:                                   # exact slug (alnum) match
        if _alnum(g["slug"]) == a:
            return _card(g)
    for g in GUIDES:                                   # topic phrase appears in the query
        if any(t in q.lower() for t in g["topics"]):
            return _card(g)
    for g in GUIDES:                                   # loose containment against slug/title/topics
        hay = _alnum(" ".join([g["slug"], g["title"]] + g["topics"]))
        if len(a) >= 4 and a in hay:
            return _card(g)
    return None
