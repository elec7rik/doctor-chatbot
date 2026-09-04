# Product Catalogue — schema & how to fill it

One JSON file **per brand** (`my-peptides.json`, `mypeptideslabs.json`, `thenad.json`, `imnatura.json`).
A later build step merges them into one catalogue the agent's `findProducts()` lookup reads.

## Why this exists
The agent does **not** use vector RAG for products. It filters this structured catalogue by
`concerns` to find the ~3 relevant products, points to their `url`, and obeys the compliance
fields (`educationOnly`, `claimCeiling`, `bridgePolicy`). So this file is both the **bridge index**
and the **compliance control** — the agent can only surface what's listed here, framed how it's told.

## Field reference

### `brand` (top of file)
| Field | Who fills | Notes |
|---|---|---|
| `id`, `name`, `site` | you | brand identity |
| `regulatoryClass` | me | `research-use-only` \| `food-supplement` \| `cosmetic` \| `prescription-only` |
| `defaultClaimCeiling` | me | the standing rule for what the agent may/may not say for this brand |
| `bridgePolicy` | me | when a bridge is allowed vs suppressed |

### `products[]`
| Field | Who fills | Required | Notes |
|---|---|---|---|
| `id` | me | ✓ | stable slug (e.g. `bpc-157`) |
| `name` | **you** | ✓ | display name |
| `sku` | **you** | – | DB id / SKU (stable key) — `FILL_FROM_DB` placeholder for now |
| `url` | **you** | ✓ | **exact live product-page URL** — the bridge target. No guessed links. `FILL_FROM_DB` for now |
| `category` | **you** | ✓ | the brand's own collection/category |
| `concerns` | me | ✓ | user-concern tags the `findProducts()` filter matches on |
| `aliases` | me | – | alternate names/spellings to aid matching |
| `regulatoryClass` | me | ✓ | per-product (usually = brand default) |
| `educationOnly` | me | ✓ | `true` ⇒ agent may only educate; never recommend use/dose. Drives compliance behaviour |
| `evidenceTier` | me | ✓ | `Strong` \| `Moderate` \| `Promising` \| `Animal-only` — honest grade the agent must stay consistent with |
| `oneLiner` | me | ✓ | pre-vetted compliant one-line description the agent can use verbatim |
| `complianceNote` | me | – | special-case handling (e.g. GHK-Cu cosmetic vs research; Tesamorelin prescription context) |
| `bridgeEligible` | me | ✓ | `false` ⇒ agent must **not** proactively surface this product (may still answer honestly if asked). Used for sensitive/out-of-scope items (Melanotan II, PT-141) and accessories |
| `variants` | you | – | array folding size/kit SKUs under one product: `[{ label, sku, url, price }]` — keeps the lookup returning one canonical page |
| `composition` | you | – | for stacks/blends: the components + amounts (drives an accurate one-liner) |
| `price` | you | – | stored for reference; the agent will **not** quote prices by default (advertising/compliance) |

## What I need from your DB (per product)
Required: **name**, **exact product-page URL**, **category**.
Helpful: short description / benefits text (I'll rewrite for compliance), **SKU/id**.
Optional: price, published/active status.

Everything in the "me" column above I author — you don't need to produce concern tags,
regulatory class, claim ceilings, evidence tiers, or the compliant one-liners.

## How to send it
CSV or JSON export, or just paste a list. Minimal columns:
`name, url, category` (+ `sku`, `description` if easy). Start with **my-peptides**.

## Before launch — verify
- Every `url` resolves to a live page.
- Blend compositions (Glow / Klow / Wolverine / Hulk) are correct.
- Each listed product is actually published / in stock.
