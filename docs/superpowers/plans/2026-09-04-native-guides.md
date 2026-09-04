# Native Guides (Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the 15 already-written educational guides as native Next.js routes (`/guides` index + `/guides/[slug]`), rendered inside The Iris shell with SSR + per-page SEO, so the chat/voice guide cards and the "Guides" rail link finally land in-app instead of 404ing.

**Architecture:** HTML-fragment port (spec §10, adapted). A dev-time generator reads each standalone backend guide HTML (`backend/app/static/guides/*.html`), strips the backend's own hero chrome, and emits (a) one heavy per-slug content module holding the `<main>…</main><footer class="disc">…</footer>` fragment + SEO meta + JSON-LD, and (b) one lightweight client-safe catalog (slug → title, subtitle, lede). Server components render the fragment via one Iris `<Article>` template with `dangerouslySetInnerHTML`; a scoped `.guide` CSS block restyles the backend classes (`.kicker/.lede/.toc/.tier/.funnel/.disc/…`) into Iris tokens. The content is first-party and committed, so inner-HTML injection is trusted (no user input on this path).

**Tech Stack:** Next.js 16.3.1 App Router (server components, `generateStaticParams`, `generateMetadata`), React 19.2, TypeScript 5 strict, Tailwind v4 (`@theme` tokens in `globals.css`), Vitest 4 + @testing-library/react (jsdom). Generator is a plain Node ESM script (`.mjs`, no new deps).

## Global Constraints

- **Branch:** `feat/native-guides`, cut off `main` (kebab-case, `feat/` per github-workflow). Never start on `main`.
- **Commits:** Conventional Commits (`feat(frontend): …`). **No attribution / Co-Authored-By lines.** Commit only at each task's final step.
- **No backend changes.** `backend/app/static/guides/*.html` and `guides.py` are the source of truth and are read-only here. The FastAPI `/guides/{slug}` route stays in place but goes unused by the product.
- **15 guides**, slugs (canonical order, from `guides.py` `GUIDES`): `better-sleep`, `why-am-i-always-tired`, `what-supplements-to-take`, `skincare`, `hair-loss`, `testosterone`, `menopause`, `injury-recovery`, `muscle-growth`, `gut-health`, `peptides-101`, `longevity-basics`, `weight-loss`, `stress-focus`, `immunity`.
- **Client-bundle discipline:** the 15 heavy HTML modules are server-only. Client components (e.g. `ChatShell`) may import ONLY the lightweight `content/guides/catalog.ts`, never the per-slug modules or `lib/guides.ts`.
- **Path aliases:** `@/` → `frontend/` root (tsconfig + vitest already configured).
- **Verification commands:** `npx vitest run <file>` for a single test file, `npm run typecheck` for types, `npm run build` for the SSG check. Run all from `frontend/`.

---

## File Structure

- `frontend/scripts/build-guides.mjs` — **new.** Dev-time generator. Exports pure `extractGuide(rawHtml)`; `main()` (guarded) reads the 15 backend HTML files and writes the content modules + catalog + index.
- `frontend/scripts/build-guides.test.ts` — **new.** Unit tests for `extractGuide`.
- `frontend/content/guides/<slug>.ts` × 15 — **generated.** `export const guide = { slug, title, lede, html, meta:{title,description,keywords}, ldJson }`. Heavy, server-only.
- `frontend/content/guides/index.ts` — **generated.** Static registry importing all 15 modules → `GUIDES` (ordered) + `BY_SLUG`.
- `frontend/content/guides/catalog.ts` — **generated.** Lightweight, client-safe: `GUIDE_CATALOG` (`{slug,title,subtitle,lede}`) + `guideTitle(slug)`.
- `frontend/lib/guides.ts` — **new (hand-written).** Server API over the registry: types + `getGuide`, `allGuides`, `allGuideSlugs`.
- `frontend/lib/guides.test.ts` — **new.**
- `frontend/components/GuideArticle.tsx` — **new.** Presentational Iris article template (header chrome + fragment + JSON-LD + disclaimer already in fragment).
- `frontend/components/GuideArticle.test.tsx` — **new.**
- `frontend/app/guides/page.tsx` — **new.** Guides index (server component) + metadata.
- `frontend/app/guides/page.test.tsx` — **new.**
- `frontend/app/guides/[slug]/page.tsx` — **new.** Detail route: `generateStaticParams`, `generateMetadata`, renders `GuideArticle`, `notFound()` on unknown slug.
- `frontend/app/guides/[slug]/page.test.tsx` — **new.**
- `frontend/app/globals.css` — **modify.** Append a scoped `.guide` styling block.
- `frontend/components/ChatShell.tsx:18-26` — **modify.** Replace the partial local `GUIDE_TITLES` map with `guideTitle` from the catalog (all 15 slugs resolve).

---

### Task 1: Guide extraction (pure function)

**Files:**
- Create: `frontend/scripts/build-guides.mjs`
- Test: `frontend/scripts/build-guides.test.ts`

**Interfaces:**
- Produces: `extractGuide(raw: string) => { title: string; description: string; keywords: string; h1: string; lede: string; ldJson: string; html: string }` — `html` is the `<main>…</main>` region plus a trailing `<footer class="disc">…</footer>` if present, with the `<header class="hero">` excluded. `title/description/keywords/h1/lede` are HTML-entity-decoded plain text. `ldJson` is the raw JSON string from the `application/ld+json` script (or `""`).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/scripts/build-guides.test.ts
import { describe, it, expect } from "vitest";
// @ts-expect-error - plain ESM module, no types
import { extractGuide } from "./build-guides.mjs";

const SAMPLE = `<!doctype html><html><head>
<title>Sleep Better | My Longevity Hub</title>
<meta name="description" content="Fix your sleep &#x27;naturally&#x27;.">
<meta name="keywords" content="sleep, insomnia">
<script type="application/ld+json">{"@type":"Article","headline":"Sleep"}</script>
<style>body{}</style></head>
<body>
<header class="hero"><div class="hero-in"><span class="brand">My Longevity Hub</span><a class="back" href="/">Ask the professor →</a></div></header>
<main>
  <div class="kicker">Guide</div>
  <h1>How to Sleep Better</h1>
  <p class="lede">A no-hype sleep primer.</p>
  <p>Body with a backtick \` and a \${dollar} to escape.</p>
  <aside class="funnel"><a class="funnel-cta" href="https://thenad.co.uk">Explore →</a></aside>
</main>
<footer class="disc"><strong>General information only.</strong></footer>
</body></html>`;

describe("extractGuide", () => {
  it("pulls SEO meta as decoded text", () => {
    const g = extractGuide(SAMPLE);
    expect(g.title).toBe("Sleep Better | My Longevity Hub");
    expect(g.description).toBe("Fix your sleep 'naturally'.");
    expect(g.keywords).toBe("sleep, insomnia");
    expect(g.h1).toBe("How to Sleep Better");
    expect(g.lede).toBe("A no-hype sleep primer.");
    expect(g.ldJson).toContain('"headline":"Sleep"');
  });
  it("keeps main + disc footer, drops the hero chrome and head", () => {
    const g = extractGuide(SAMPLE);
    expect(g.html).toContain("<main>");
    expect(g.html).toContain('class="funnel-cta"');
    expect(g.html).toContain('class="disc"');
    expect(g.html).not.toContain('class="hero"');
    expect(g.html).not.toContain("<style>");
    expect(g.html).not.toContain("<title>");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run scripts/build-guides.test.ts`
Expected: FAIL — cannot find `extractGuide` (module has no such export yet).

- [ ] **Step 3: Write the minimal implementation**

```js
// frontend/scripts/build-guides.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));            // frontend/scripts
const SRC_DIR = join(HERE, "..", "..", "backend", "app", "static", "guides");
const OUT_DIR = join(HERE, "..", "content", "guides");

// Canonical order — matches backend/app/guides.py GUIDES.
export const SLUGS = [
  "better-sleep", "why-am-i-always-tired", "what-supplements-to-take", "skincare",
  "hair-loss", "testosterone", "menopause", "injury-recovery", "muscle-growth",
  "gut-health", "peptides-101", "longevity-basics", "weight-loss", "stress-focus", "immunity",
];

function decodeEntities(s) {
  return (s || "")
    .replace(/&#x27;/gi, "'").replace(/&#39;/g, "'")
    .replace(/&#x2014;/gi, "—").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}

function pick(re, raw) { const m = raw.match(re); return m ? m[1] : ""; }
function stripTags(s) { return decodeEntities((s || "").replace(/<[^>]*>/g, "")); }

export function extractGuide(raw) {
  const title = decodeEntities(pick(/<title>([\s\S]*?)<\/title>/i, raw));
  const description = decodeEntities(pick(/<meta name="description" content="([\s\S]*?)">/i, raw));
  const keywords = decodeEntities(pick(/<meta name="keywords" content="([\s\S]*?)">/i, raw));
  const ldJson = pick(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i, raw).trim();
  const h1 = stripTags(pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i, raw));
  const lede = stripTags(pick(/<p class="lede">([\s\S]*?)<\/p>/i, raw));
  // Body region: <main> … </main> plus an optional trailing <footer class="disc"> … </footer>.
  const html = pick(/(<main[\s\S]*?<\/main>(?:\s*<footer[\s\S]*?<\/footer>)?)/i, raw).trim();
  return { title, description, keywords, h1, lede, ldJson, html };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run scripts/build-guides.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/scripts/build-guides.mjs frontend/scripts/build-guides.test.ts
git commit -m "feat(frontend): guide HTML extraction for the native-guides port"
```

---

### Task 2: Generator — emit content modules, index, catalog

**Files:**
- Modify: `frontend/scripts/build-guides.mjs` (append `esc`, `main()`, run guard)
- Generated (by running it): `frontend/content/guides/<slug>.ts` ×15, `frontend/content/guides/index.ts`, `frontend/content/guides/catalog.ts`

**Interfaces:**
- Produces (generated `content/guides/<slug>.ts`): `export const guide = { slug, title, lede, html, meta: { title, description, keywords }, ldJson }` typed `as const`-ish plain object.
- Produces (`content/guides/catalog.ts`): `export const GUIDE_CATALOG: { slug: string; title: string; subtitle: string; lede: string }[]` and `export function guideTitle(slug: string): string | undefined`.
- Produces (`content/guides/index.ts`): `export const GUIDES` (array, canonical order) and `export const BY_SLUG: Record<string, (typeof GUIDES)[number]>`.

- [ ] **Step 1: Append the generator body to `build-guides.mjs`**

```js
// --- append to frontend/scripts/build-guides.mjs ---

// Escape a string for embedding inside a TS template literal.
function esc(s) { return String(s).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${"); }

function moduleSource(slug, g) {
  return `// AUTO-GENERATED by scripts/build-guides.mjs — do not edit by hand.
export const guide = {
  slug: ${JSON.stringify(slug)},
  title: ${JSON.stringify(g.h1 || g.title)},
  lede: ${JSON.stringify(g.lede)},
  meta: {
    title: ${JSON.stringify(g.title)},
    description: ${JSON.stringify(g.description)},
    keywords: ${JSON.stringify(g.keywords)},
  },
  ldJson: \`${esc(g.ldJson)}\`,
  html: \`${esc(g.html)}\`,
} as const;
`;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const catalog = [];
  for (const slug of SLUGS) {
    const raw = readFileSync(join(SRC_DIR, `${slug}.html`), "utf8");
    const g = extractGuide(raw);
    if (!g.html) throw new Error(`No <main> extracted for ${slug}`);
    writeFileSync(join(OUT_DIR, `${slug}.ts`), moduleSource(slug, g));
    catalog.push({ slug, title: g.h1 || g.title, subtitle: "My Longevity Hub guide", lede: g.lede });
  }
  // index.ts — static registry (server-only; imports the heavy modules)
  const imports = SLUGS.map((s, i) => `import { guide as g${i} } from "./${s}";`).join("\n");
  const arr = SLUGS.map((_, i) => `g${i}`).join(", ");
  writeFileSync(join(OUT_DIR, "index.ts"),
`// AUTO-GENERATED by scripts/build-guides.mjs — do not edit by hand.
${imports}

export const GUIDES = [${arr}] as const;
export type Guide = (typeof GUIDES)[number];
export const BY_SLUG: Record<string, Guide> =
  Object.fromEntries(GUIDES.map((g) => [g.slug, g]));
`);
  // catalog.ts — lightweight, client-safe (no html blobs)
  writeFileSync(join(OUT_DIR, "catalog.ts"),
`// AUTO-GENERATED by scripts/build-guides.mjs — do not edit by hand.
export interface GuideCatalogEntry { slug: string; title: string; subtitle: string; lede: string; }
export const GUIDE_CATALOG: GuideCatalogEntry[] = ${JSON.stringify(catalog, null, 2)};
const TITLES: Record<string, string> = Object.fromEntries(GUIDE_CATALOG.map((g) => [g.slug, g.title]));
export function guideTitle(slug: string): string | undefined { return TITLES[slug]; }
`);
  console.log(`Wrote ${SLUGS.length} guides + index + catalog to ${OUT_DIR}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
```

- [ ] **Step 2: Run the generator**

Run: `cd frontend && node scripts/build-guides.mjs`
Expected: `Wrote 15 guides + index + catalog to …/content/guides`. Confirm 17 files exist: `ls content/guides` shows 15 `<slug>.ts` + `index.ts` + `catalog.ts`.

- [ ] **Step 3: Verify the extraction tests still pass and types compile**

Run: `cd frontend && npx vitest run scripts/build-guides.test.ts && npm run typecheck`
Expected: tests PASS; `tsc --noEmit` reports no errors in the generated files.

- [ ] **Step 4: Commit (generator + generated content)**

```bash
git add frontend/scripts/build-guides.mjs frontend/content/guides
git commit -m "feat(frontend): generate native guide content modules, index and catalog"
```

---

### Task 3: Server API — `lib/guides.ts`

**Files:**
- Create: `frontend/lib/guides.ts`
- Test: `frontend/lib/guides.test.ts`

**Interfaces:**
- Consumes: `GUIDES`, `BY_SLUG`, `Guide` from `@/content/guides/index`.
- Produces: `type GuideDoc = Guide`; `allGuides(): readonly GuideDoc[]`; `allGuideSlugs(): string[]`; `getGuide(slug: string): GuideDoc | undefined`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/lib/guides.test.ts
import { describe, it, expect } from "vitest";
import { allGuides, allGuideSlugs, getGuide } from "./guides";

describe("guides API", () => {
  it("exposes all 15 guides", () => {
    expect(allGuides()).toHaveLength(15);
    expect(allGuideSlugs()).toContain("peptides-101");
    expect(allGuideSlugs()).toContain("weight-loss"); // was missing from ChatShell's old map
  });
  it("getGuide returns a doc with html + seo meta", () => {
    const g = getGuide("peptides-101");
    expect(g?.html).toContain("Research Peptides 101");
    expect(g?.html).toContain("my-peptides.co.uk"); // funnel CTA preserved
    expect(g?.meta.description.length).toBeGreaterThan(0);
  });
  it("getGuide is undefined for an unknown slug", () => {
    expect(getGuide("not-a-guide")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/guides.test.ts`
Expected: FAIL — `./guides` not found.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/lib/guides.ts
import { GUIDES, BY_SLUG, type Guide } from "@/content/guides/index";

export type GuideDoc = Guide;

export function allGuides(): readonly GuideDoc[] { return GUIDES; }
export function allGuideSlugs(): string[] { return GUIDES.map((g) => g.slug); }
export function getGuide(slug: string): GuideDoc | undefined { return BY_SLUG[slug]; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/guides.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/guides.ts frontend/lib/guides.test.ts
git commit -m "feat(frontend): server-side guides registry API"
```

---

### Task 4: Iris article template — `GuideArticle`

**Files:**
- Create: `frontend/components/GuideArticle.tsx`
- Test: `frontend/components/GuideArticle.test.tsx`

**Interfaces:**
- Consumes: `GuideDoc` from `@/lib/guides`.
- Produces: `export function GuideArticle({ guide }: { guide: GuideDoc }): JSX.Element` — renders a `.guide` wrapper with an Iris header (brand + "Ask the professor →" back link to `/`), a "← All guides" link to `/guides`, the fragment via `dangerouslySetInnerHTML`, and the JSON-LD script when present. Sync server component (no hooks).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/GuideArticle.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GuideArticle } from "./GuideArticle";
import { getGuide } from "@/lib/guides";

describe("GuideArticle", () => {
  const guide = getGuide("peptides-101")!;
  it("renders the article fragment inside an Iris .guide wrapper", () => {
    const { container } = render(<GuideArticle guide={guide} />);
    expect(container.querySelector(".guide")).toBeTruthy();
    expect(container.querySelector("article.guide-body")).toBeTruthy();
    expect(screen.getByText(/Research Peptides 101/)).toBeInTheDocument();
  });
  it("offers a way back to chat and to the index", () => {
    render(<GuideArticle guide={guide} />);
    expect(screen.getByRole("link", { name: /Ask the professor/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /All guides/i })).toHaveAttribute("href", "/guides");
  });
  it("injects the JSON-LD structured data", () => {
    const { container } = render(<GuideArticle guide={guide} />);
    const ld = container.querySelector('script[type="application/ld+json"]');
    expect(ld?.textContent).toContain("Article");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run components/GuideArticle.test.tsx`
Expected: FAIL — `./GuideArticle` not found.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/components/GuideArticle.tsx
import type { GuideDoc } from "@/lib/guides";

export function GuideArticle({ guide }: { guide: GuideDoc }) {
  return (
    <div className="guide">
      <header className="guide-top">
        <a className="guide-back" href="/guides">← All guides</a>
        <span className="guide-brand">My Longevity Hub</span>
        <a className="guide-ask" href="/">Ask the professor →</a>
      </header>
      <article className="guide-body" dangerouslySetInnerHTML={{ __html: guide.html }} />
      {guide.ldJson ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: guide.ldJson }} />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run components/GuideArticle.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/GuideArticle.tsx frontend/components/GuideArticle.test.tsx
git commit -m "feat(frontend): Iris guide article template"
```

---

### Task 5: Detail route — `app/guides/[slug]/page.tsx`

**Files:**
- Create: `frontend/app/guides/[slug]/page.tsx`
- Test: `frontend/app/guides/[slug]/page.test.tsx`

**Interfaces:**
- Consumes: `getGuide`, `allGuideSlugs` from `@/lib/guides`; `GuideArticle` from `@/components/GuideArticle`; `notFound` from `next/navigation`.
- Produces: `generateStaticParams(): { slug: string }[]`; `generateMetadata({ params }): Promise<Metadata>`; default async page component. In Next 16 `params` is a Promise — `await` it.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/app/guides/[slug]/page.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Page, { generateStaticParams, generateMetadata } from "./page";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

describe("guide detail route", () => {
  it("generateStaticParams lists all 15 slugs", async () => {
    const params = await generateStaticParams();
    expect(params).toHaveLength(15);
    expect(params).toContainEqual({ slug: "better-sleep" });
  });
  it("generateMetadata returns per-page SEO", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "peptides-101" }) });
    expect(String(meta.title)).toMatch(/Peptides 101/);
    expect(meta.description).toBeTruthy();
  });
  it("renders a known guide", async () => {
    render(await Page({ params: Promise.resolve({ slug: "better-sleep" }) }));
    expect(screen.getByRole("link", { name: /All guides/i })).toBeInTheDocument();
  });
  it("calls notFound on an unknown slug", async () => {
    await expect(Page({ params: Promise.resolve({ slug: "nope" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run "app/guides/[slug]/page.test.tsx"`
Expected: FAIL — `./page` not found.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/app/guides/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGuide, allGuideSlugs } from "@/lib/guides";
import { GuideArticle } from "@/components/GuideArticle";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return allGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return {};
  return {
    title: g.meta.title,
    description: g.meta.description,
    keywords: g.meta.keywords,
    alternates: { canonical: `/guides/${slug}` },
    openGraph: { type: "article", title: g.title, description: g.meta.description },
  };
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();
  return <GuideArticle guide={g} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run "app/guides/[slug]/page.test.tsx"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "frontend/app/guides/[slug]"
git commit -m "feat(frontend): native guide detail route with SSG + SEO"
```

---

### Task 6: Guides index — `app/guides/page.tsx`

**Files:**
- Create: `frontend/app/guides/page.tsx`
- Test: `frontend/app/guides/page.test.tsx`

**Interfaces:**
- Consumes: `GUIDE_CATALOG` from `@/content/guides/catalog`.
- Produces: `metadata: Metadata`; default sync page component rendering a `.guide-index` list — each entry a link to `/guides/<slug>` showing title + lede.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/app/guides/page.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Page from "./page";

describe("guides index", () => {
  it("links to all 15 guides", () => {
    render(<Page />);
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/guides/"));
    expect(links).toHaveLength(15);
    expect(screen.getByRole("link", { name: /Sleep Better/i })).toHaveAttribute("href", "/guides/better-sleep");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run app/guides/page.test.tsx`
Expected: FAIL — `./page` not found.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/app/guides/page.tsx
import type { Metadata } from "next";
import { GUIDE_CATALOG } from "@/content/guides/catalog";

export const metadata: Metadata = {
  title: "Guides · My Longevity Hub",
  description: "Straight, no-hype guides on sleep, energy, supplements, peptides and living longer.",
};

export default function GuidesIndex() {
  return (
    <div className="guide guide-index">
      <header className="guide-top">
        <span className="guide-brand">My Longevity Hub</span>
        <a className="guide-ask" href="/">Ask the professor →</a>
      </header>
      <h1 className="gi-title">Guides</h1>
      <p className="gi-lede">Honest, plain-English reads on the things people actually ask about.</p>
      <ul className="gi-list">
        {GUIDE_CATALOG.map((g) => (
          <li key={g.slug}>
            <a className="gi-card" href={`/guides/${g.slug}`}>
              <span className="gi-card-title">{g.title}</span>
              <span className="gi-card-lede">{g.lede}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run app/guides/page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/guides/page.tsx frontend/app/guides/page.test.tsx
git commit -m "feat(frontend): native guides index route"
```

---

### Task 7: Iris styling for guides (`.guide` block)

**Files:**
- Modify: `frontend/app/globals.css` (append a scoped `.guide` block at end of file)

**Interfaces:** none (CSS only). Restyles the backend's classes — `.kicker .byline .lede .toc .callout .tier .funnel .funnel-k .funnel-cta .faqwrap .faq .refs .disc` — plus base `h1/h2/h3/p/ul/ol/li/strong/a` under `.guide-body`, using Iris tokens. Also styles `.guide-top`, `.guide-back/brand/ask`, and the `.guide-index` cards.

- [ ] **Step 1: Add a smoke test for the styling hooks**

Because CSS isn't unit-tested, assert the render still exposes the class hooks the CSS targets (guards against renames):

```tsx
// append to frontend/components/GuideArticle.test.tsx
it("exposes the class hooks the Iris CSS targets", () => {
  const { container } = render(<GuideArticle guide={getGuide("hair-loss")!} />);
  expect(container.querySelector(".guide-top")).toBeTruthy();
  expect(container.querySelector(".guide-body .funnel, .guide-body .lede")).toBeTruthy();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run components/GuideArticle.test.tsx`
Expected: FAIL on the new case only if a hook is missing; if it already passes, proceed (the case documents the contract).

- [ ] **Step 3: Append the CSS**

```css
/* ---- native guides (Phase 4) ---- */
.guide { max-width: 760px; margin: 0 auto; padding: 0 20px 64px; }
.guide-top {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 0; margin-bottom: 8px; border-bottom: 1px solid var(--color-line);
}
.guide-brand { font-weight: 800; letter-spacing: .12em; font-size: 12px; text-transform: uppercase; color: var(--color-ink-2); }
.guide-back { font-size: 13px; font-weight: 600; color: var(--color-ink-3); text-decoration: none; }
.guide-back:hover { color: var(--color-accent-ink); }
.guide-ask { margin-left: auto; font-size: 13px; font-weight: 600; color: var(--color-accent-ink); text-decoration: none; }
.guide-ask:hover { text-decoration: underline; }

.guide-body { color: var(--color-ink); }
.guide-body .kicker { color: var(--color-accent-ink); font-weight: 700; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
.guide-body h1 { font-size: 2rem; line-height: 1.15; letter-spacing: -.02em; margin: .2em 0 .3em; text-wrap: balance; }
.guide-body .byline { color: var(--color-ink-3); font-size: 13px; margin: 0 0 8px; }
.guide-body .lede { font-size: 1.15rem; color: var(--color-ink-2); margin: .5em 0 1.4em; text-wrap: pretty; }
.guide-body h2 { font-size: 1.3rem; letter-spacing: -.015em; margin: 1.7em 0 .5em; }
.guide-body h3 { font-size: 1.05rem; margin: 1.2em 0 .3em; }
.guide-body p { margin: .7em 0; text-wrap: pretty; }
.guide-body ul, .guide-body ol { margin: .6em 0; padding-left: 1.3em; }
.guide-body li { margin: .35em 0; }
.guide-body strong { font-weight: 650; }
.guide-body a { color: var(--color-link); }
.guide-body .tier {
  display: inline-block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
  padding: 2px 8px; border-radius: var(--radius-xs); background: var(--color-accent-soft); color: var(--color-accent-ink);
  vertical-align: middle;
}
.guide-body .toc {
  background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md);
  padding: 14px 18px; margin: 0 0 1.5em;
}
.guide-body .toc > div { font-weight: 700; font-size: 12px; color: var(--color-ink-3); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
.guide-body .toc a { display: block; padding: 3px 0; text-decoration: none; color: var(--color-ink-2); font-size: 14.5px; }
.guide-body .toc a:hover { color: var(--color-accent-ink); }
.guide-body .callout {
  background: var(--color-accent-soft); border: 1px solid var(--color-line); border-left: 3px solid var(--color-accent);
  border-radius: var(--radius-sm); padding: 12px 16px; margin: 1.2em 0; font-size: 15px;
}
.guide-body .funnel {
  display: block; background: var(--color-surface); border: 1px solid var(--color-line);
  border-radius: var(--radius-lg); padding: 18px 20px; margin: 1.8em 0; box-shadow: var(--shadow-sm);
}
.guide-body .funnel-k { color: var(--color-ink-3); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
.guide-body .funnel p { margin: .2em 0 .8em; }
.guide-body .funnel-cta {
  display: inline-block; font-weight: 700; text-decoration: none; color: #fff;
  background: var(--color-accent); padding: 9px 16px; border-radius: var(--radius-sm); font-size: 14.5px;
}
.guide-body .funnel-cta:hover { background: var(--color-accent-ink); }
.guide-body .faqwrap { margin: 1.8em 0; }
.guide-body .faq { border-top: 1px solid var(--color-line); padding: 12px 0; }
.guide-body .refs { margin-top: 1.8em; font-size: 14px; color: var(--color-ink-2); }
.guide-body .disc {
  display: block; margin-top: 2em; padding-top: 16px; border-top: 1px solid var(--color-line);
  color: var(--color-ink-3); font-size: 13px; line-height: 1.55;
}

.guide-index .gi-title { font-size: 2rem; letter-spacing: -.02em; margin: .6em 0 .2em; }
.guide-index .gi-lede { color: var(--color-ink-2); margin: 0 0 1.4em; }
.gi-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.gi-card {
  display: block; padding: 16px 18px; border: 1px solid var(--color-line); border-radius: var(--radius-md);
  background: var(--color-surface); text-decoration: none; box-shadow: var(--shadow-sm);
  transition: border-color var(--dur-base) var(--ease), transform var(--dur-fast) var(--ease);
}
.gi-card:hover { border-color: var(--color-accent); transform: translateY(-1px); }
.gi-card-title { display: block; font-weight: 650; color: var(--color-ink); margin-bottom: 4px; }
.gi-card-lede { display: block; color: var(--color-ink-3); font-size: 14px; }
```

- [ ] **Step 4: Run the component tests to confirm hooks intact**

Run: `cd frontend && npx vitest run components/GuideArticle.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/globals.css frontend/components/GuideArticle.test.tsx
git commit -m "feat(frontend): Iris styling for native guide pages"
```

---

### Task 8: Wire chat cards to the full catalog (DRY the title map)

**Files:**
- Modify: `frontend/components/ChatShell.tsx:18-26` (remove local `GUIDE_TITLES`, import `guideTitle`), and the render filter around line 69-73.
- Test: `frontend/components/ChatShell` — add/adjust a test proving a previously-missing slug now yields a card. (If `ChatShell.test.tsx` does not exist, add a focused test; otherwise extend it.)

**Interfaces:**
- Consumes: `guideTitle` from `@/content/guides/catalog` (client-safe, no HTML blobs).

- [ ] **Step 1: Write/extend the failing test**

```tsx
// frontend/components/ChatShell.guides.test.tsx
import { describe, it, expect } from "vitest";
import { guideTitle } from "@/content/guides/catalog";

// Guards the DRY fix: every slug the backend can emit now resolves to a card title.
describe("guide card titles", () => {
  it("resolves slugs that the old 7-entry map dropped", () => {
    for (const slug of ["weight-loss", "immunity", "gut-health", "longevity-basics",
                         "muscle-growth", "injury-recovery", "stress-focus", "what-supplements-to-take"]) {
      expect(guideTitle(slug)).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails or is red-then-green**

Run: `cd frontend && npx vitest run components/ChatShell.guides.test.tsx`
Expected: PASS once the catalog exists (Task 2). If catalog import path is wrong, FAIL — fix the import.

- [ ] **Step 3: Replace the local map in `ChatShell.tsx`**

Remove the `const GUIDE_TITLES: Record<string, string> = { … };` block (lines ~18-26) and add near the other imports:

```tsx
import { guideTitle } from "@/content/guides/catalog";
```

Then change the guide-card render (around lines 69-73) from the local map to the catalog helper:

```tsx
{m.guideSlugs
  .filter((s) => guideTitle(s))
  .map((s) => (
    <LinkCard key={s} href={`/guides/${s}`} title={guideTitle(s)!} subtitle="My Longevity Hub guide" />
  ))}
```

- [ ] **Step 4: Run the full frontend suite + typecheck**

Run: `cd frontend && npm run test:run && npm run typecheck`
Expected: all tests PASS; no type errors. (Confirms no other file referenced the removed `GUIDE_TITLES`.)

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ChatShell.tsx frontend/components/ChatShell.guides.test.tsx
git commit -m "feat(frontend): resolve all 15 guide cards from the shared catalog"
```

---

### Task 9: Production build check (SSG + no client-bundle bloat)

**Files:** none (verification task).

- [ ] **Step 1: Run the production build**

Run: `cd frontend && npm run build`
Expected: build succeeds; the route table lists `/guides` and `/guides/[slug]` as **static** (prerendered — 15 pages under `[slug]`). No "dynamic server usage" warnings for these routes.

- [ ] **Step 2: Confirm the heavy modules did not leak into a client bundle**

Run: `cd frontend && grep -rl "content/guides/index" .next/static 2>/dev/null; echo "exit: $?"`
Expected: no matches (grep exits non-zero / prints nothing). The per-slug HTML blobs must appear only in server output, never `.next/static`. If a match appears, a client component is importing `lib/guides` or `content/guides/index` — trace and switch it to `content/guides/catalog`.

- [ ] **Step 3: Full suite one more time**

Run: `cd frontend && npm run test:run`
Expected: green.

- [ ] **Step 4: Commit (if the build produced lockfile/config churn; otherwise skip)**

```bash
git add -A
git commit -m "chore(frontend): verify native-guides production build" --allow-empty
```

---

## Completion

After all tasks pass, use **superpowers:finishing-a-development-branch** to verify the suite and present merge options (this branch splits from `main`).

## Self-Review notes

- **Spec §10 coverage:** native `/guides` index + `/guides/[slug]` server routes with `generateStaticParams` + per-page SEO ✅ (Tasks 5, 6); one Iris article template ✅ (Task 4, 7); chat cards deep-link to `/guides/<slug>` ✅ (already true; Task 8 widens coverage to all 15). Deviation from §10: content is stored as **HTML fragments** (approach B), not typed structured sections — approved by the user for the 15-article port.
- **Client bundle:** the split between `catalog.ts` (client-safe) and the heavy per-slug modules (server-only) is enforced by Task 9's grep. This is the one non-obvious risk and it has an explicit gate.
- **Compliance:** the `<footer class="disc">` medical disclaimer is carried into every guide fragment (Task 1 extraction) and styled (Task 7) — the UK ASA/MHRA educational framing is preserved.
- **Types:** `GuideDoc = Guide` from the generated `index.ts`; `getGuide`/`allGuideSlugs`/`allGuides` names are used identically across Tasks 3, 5, 6.
