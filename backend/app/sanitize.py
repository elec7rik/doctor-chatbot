"""Deterministic partner-URL guard.

The model is told to link only real pages, but prompts are probabilistic — it
sometimes fabricates a plausible deep link for a brand that has no product
catalogue (e.g. imnatura.co.uk/products/omega-3). This is the hard backstop:
any partner-brand URL that is NOT a verified my-peptides product page or a known
brand homepage is rewritten down to that brand's bare homepage, so a fabricated
or 404 product link can never reach the user.

Only my-peptides has a product catalogue, so only its listed product URLs are
allowed as deep links; the other three brands are homepage-only.
"""
import re

from .catalogue import load_catalogue

_HOMES = ("my-peptides.co.uk", "mypeptideslabs.com", "thenad.co.uk", "imnatura.co.uk")
_TRAIL = ".,;:!?)]}\"'>"
_URL_RE = re.compile(
    r"(https?://)?("
    r"(?:my-peptides\.co\.uk|mypeptideslabs\.com|thenad\.co\.uk|imnatura\.co\.uk)"
    r"(?:/[^\s)\]}\"'<>]*)?"
    r")",
    re.I,
)


def _norm(url: str) -> str:
    url = re.sub(r"^https?://", "", url.strip(), flags=re.I).lower().rstrip("/")
    return url


def _allowed_deep_urls() -> set:
    allowed = set()
    for brand in load_catalogue():
        for p in brand.get("products", []):
            u = p.get("url", "")
            if u:
                allowed.add(_norm(u))
    return allowed


_ALLOWED = _allowed_deep_urls()


def sanitize_text(text: str) -> str:
    """Collapse any non-verified partner deep-link to its brand homepage."""
    def repl(m: "re.Match") -> str:
        scheme = m.group(1) or ""
        rest = m.group(2)
        trail = ""
        while rest and rest[-1] in _TRAIL:      # don't swallow sentence punctuation
            trail = rest[-1] + trail
            rest = rest[:-1]
        norm = _norm(scheme + rest)
        domain = norm.split("/", 1)[0]
        if "/" not in norm or norm in _ALLOWED:  # homepage, or a verified product page
            return scheme + rest + trail
        return scheme + domain + trail           # fabricated deep link -> homepage

    return _URL_RE.sub(repl, text)


def sanitize_stream(pieces):
    """Sanitize a stream of text pieces without ever releasing a partial URL:
    hold back the trailing partial 'word' until whitespace confirms it's whole,
    then sanitize and flush the completed part. Adds at most one word of lag."""
    buf = ""
    for piece in pieces:
        buf += piece
        cut = max(buf.rfind(" "), buf.rfind("\n"), buf.rfind("\t"))
        if cut >= 0:
            out, buf = buf[: cut + 1], buf[cut + 1:]
            yield sanitize_text(out)
    if buf:
        yield sanitize_text(buf)
