import glob
import json
import os

from .config import settings


def load_catalogue():
    brands = []
    for path in sorted(glob.glob(os.path.join(settings.CATALOGUE_DIR, "*.json"))):
        with open(path, encoding="utf-8") as f:
            brands.append(json.load(f))
    return brands


def find_products(concerns):
    """Return bridge-eligible products whose concern tags intersect `concerns`.
    (Not used for context-stuffing yet — kept for a future filtered-lookup step.)"""
    wanted = {c.lower() for c in concerns}
    hits = []
    for b in load_catalogue():
        for p in b.get("products", []):
            if not p.get("bridgeEligible", False):
                continue
            if wanted & {c.lower() for c in p.get("concerns", [])}:
                hits.append({**p, "brand": b["brand"]["name"], "site": b["brand"]["site"]})
    return hits


def build_catalogue_block() -> str:
    """Compact, compliance-framed text block of every bridge-eligible product,
    appended to the system prompt so the agent can only point to real URLs."""
    brands = load_catalogue()
    if not brands:
        return ""
    out = ["=== VERIFIED PARTNER PRODUCTS (authoritative list of specific products + URLs) ==="]
    for b in brands:
        brand = b["brand"]
        out.append(f"\n{brand['name']} — {brand['site']} ({brand.get('regulatoryClass', '')})")
        if brand.get("defaultClaimCeiling"):
            out.append(f"  Claim ceiling: {brand['defaultClaimCeiling']}")
        if brand.get("bridgePolicy"):
            out.append(f"  Bridge policy: {brand['bridgePolicy']}")
        for p in b.get("products", []):
            if not p.get("bridgeEligible", False):
                continue
            concerns = ", ".join(p.get("concerns", []))
            line = (
                f"  - {p['name']} [{p.get('evidenceTier', '')}] — {p['oneLiner']} "
                f"(concerns: {concerns}) URL: {p['url']}"
            )
            if p.get("complianceNote"):
                line += f"  [NOTE: {p['complianceNote']}]"
            out.append(line)
    out.append(
        "\nRULES FOR THESE PRODUCTS: Only ever point to a specific product/URL listed above, "
        "or a partner brand homepage named in your instructions. Never invent a product or URL. "
        "Exactly ONE pointer per answer, after natural-first advice, framed as 'where to learn more / "
        "where people get this' — never as a recommendation to use, never with a dose. Include the pointer "
        "for on-topic questions AND when the user just wants to get/buy one of these research-use peptides "
        "(frame it 'sold for research use only'). DO NOT bridge when the user asks for a dose, a protocol, "
        "or how to inject/use it in a human — refuse that part instead. Some sensitive items (prescription-"
        "context or MHRA-warned peptides) are deliberately omitted from this list — never point to a product "
        "for those, even if you know one exists."
    )
    return "\n".join(out)
