# Next.js Foundation & Chat Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `frontend/` Next.js app with the Iris design system and a working, streaming text-chat product (light/dark, mobile + desktop, persisted history) that proxies to the existing FastAPI backend.

**Architecture:** Next.js 16 App Router client shell for chat; a Node-runtime Route Handler proxies the FastAPI `/chat/stream` and streams it back unbuffered. Logic lives in framework-agnostic `lib/` modules (storage, schemas, markdown, api, theme) wrapped by a `useChat` hook. Voice, read-aloud, dictation and guides are later plans; this plan leaves clearly-marked seams for them.

**Tech Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 strict · Tailwind CSS v4 (`@theme`) · motion v13 · clsx + tailwind-merge · zod v4 · Vitest 4 + @testing-library/react (jsdom).

This plan is Phase 1 of 4. It implements the spec `docs/superpowers/specs/2026-09-04-nextjs-chat-agent-design.md` sections: 3, 4, 5 (chat only), 6 (chat parts), 8 (chat send), 9, 11 (chat), 13 (chat units). Voice/TTS/STT/guides seams are stubbed and completed in Plans 2–4.

## Global Constraints

- Next.js **16**, React **19**, TypeScript **5 strict** (`"strict": true`, `noUncheckedIndexedAccess": true`). Tailwind CSS **v4** via `@tailwindcss/postcss`. `motion` **v13**. `zod` **v4**. Vitest **4**. No Stripe / no commerce SDK.
- `BACKEND_URL` is **server-only** (default `http://localhost:8000`); never referenced in a client component or `NEXT_PUBLIC_*`.
- Light theme is the **default**; a saved `np-theme` of `dark` wins; no flash on load.
- All localStorage access wrapped in try/catch; app renders correctly with none present.
- UK English, the professor's tone. Copy for the empty state and disclaimer is verbatim from `design/preview.html` / `design/CHAT_VOICE_MODES.md`.
- Interactive targets ≥ 44px. Respect `prefers-reduced-motion`. Colour is never the only signal.
- Persistence keys: `np-history`, `np-session`, `np-theme` (this plan); `np-readaloud`, `np-receipts` reserved for later plans.
- Brand domains for autolink: `my-peptides.co.uk`, `mypeptideslabs.com`, `thenad.co.uk`, `imnatura.co.uk`.
- Iris tokens are the values already in `design/preview.html` `:root` (source of truth for exact hex); mirror them, do not invent new ones.

---

### Task 1: Scaffold the `frontend/` app

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/next.config.ts`, `frontend/postcss.config.mjs`, `frontend/eslint.config.mjs`, `frontend/vitest.config.ts`, `frontend/vitest.setup.ts`, `frontend/.env.local.example`, `frontend/.gitignore`
- Create: `frontend/app/layout.tsx`, `frontend/app/page.tsx`, `frontend/app/globals.css` (minimal; tokens land in Task 2)
- Create: `frontend/lib/__smoke__.test.ts`

**Interfaces:**
- Produces: a buildable Next app; `npm --prefix frontend run test:run`, `build`, `typecheck`, `lint` scripts.

- [ ] **Step 1: Write `frontend/package.json`**

```json
{
  "name": "chat-agent-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "next": "16.3.1",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.0.0",
    "motion": "^13.0.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/node": "^22.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "16.3.1",
    "vitest": "^4.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/user-event": "^14.5.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: Write config files**

`frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`frontend/next.config.ts`:
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = { reactStrictMode: true };
export default nextConfig;
```

`frontend/postcss.config.mjs`:
```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

`frontend/eslint.config.mjs`:
```js
import next from "eslint-config-next";
export default [...next()];
```

`frontend/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
});
```

`frontend/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

`frontend/.env.local.example`:
```
# Server-only: FastAPI origin the BFF proxies to.
BACKEND_URL=http://localhost:8000
# Client: WebSocket origin for /live (empty = same-origin). Dev points at FastAPI.
NEXT_PUBLIC_LIVE_WS_URL=ws://localhost:8000/live
```

`frontend/.gitignore`:
```
/node_modules
/.next
/out
.env.local
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 3: Write minimal `app/globals.css`, `app/layout.tsx`, `app/page.tsx`**

`frontend/app/globals.css`:
```css
@import "tailwindcss";
```

`frontend/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ask the Professor · My Longevity Hub",
  description: "Straight answers on living longer, better.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`frontend/app/page.tsx`:
```tsx
export default function Page() {
  return <main>Chat coming online.</main>;
}
```

- [ ] **Step 4: Write the smoke test** — `frontend/lib/__smoke__.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("toolchain", () => {
  it("runs", () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 5: Install and verify**

Run: `cd frontend && npm install && npm run test:run && npm run typecheck && npm run build`
Expected: install succeeds; 1 test passes; typecheck clean; `build` completes with the `/` route.

- [ ] **Step 6: Commit**
```bash
git add frontend
git commit -m "feat(frontend): scaffold Next.js 16 app with Tailwind v4 and Vitest"
```

---

### Task 2: Iris design tokens + theme-reactive Tailwind theme

**Files:**
- Modify: `frontend/app/globals.css`
- Create: `frontend/lib/tokens.ts`, `frontend/lib/tokens.test.ts`

**Interfaces:**
- Produces: theme-reactive CSS vars (`--color-bg`, `--color-surface`, `--color-ink`, `--color-ink-2/3/4`, `--color-line`, `--color-user`, `--color-accent`, `--color-accent-ink`, `--color-accent-soft`, `--color-link`, `--color-focus`, `--color-danger`, iris ramp `--color-iris-50..800`), radii (`--radius-xs/sm/md/lg/xl`), shadows (`--shadow-sm/md/lg/orb`), gradients (`--grad-orb-ring/core/glow`, `--grad-greeting`), motion (`--dur-fast/base`, `--ease`); a `dark` Tailwind variant bound to `[data-theme=dark]`; `IRIS` ramp exported from `lib/tokens.ts` for any JS that needs a hex.

- [ ] **Step 1: Write the token test** — `frontend/lib/tokens.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { IRIS } from "./tokens";
describe("IRIS ramp", () => {
  it("exposes the sanctioned accent stops as hex", () => {
    expect(IRIS[600]).toBe("#5B4BD6");
    expect(IRIS[400]).toBe("#8A5CF0");
    expect(Object.keys(IRIS)).toHaveLength(9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/tokens.test.ts`
Expected: FAIL — cannot find module `./tokens`.

- [ ] **Step 3: Write `frontend/lib/tokens.ts`**
```ts
/** The iris ramp — the one accent. Mirrors design/preview.html :root. */
export const IRIS = {
  50: "#F1F0FE", 100: "#E5E2FC", 200: "#D0CAF8", 300: "#B3A9F5",
  400: "#8A5CF0", 500: "#6D5DE8", 600: "#5B4BD6", 700: "#4B3AC9", 800: "#38299B",
} as const;
export type IrisStop = keyof typeof IRIS;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/tokens.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the full `frontend/app/globals.css`**

Port every value from `design/preview.html` `:root` (light) and `:root[data-theme="dark"]`. Static scales go in `@theme`; theme-reactive semantic colours are declared in `@theme` then overridden under `[data-theme=dark]` and the media query so Tailwind utilities (`bg-bg`, `text-ink`, `bg-surface`, …) react to the theme.

```css
@import "tailwindcss";

/* dark applies when the root carries data-theme="dark" */
@custom-variant dark (&:where([data-theme="dark"] *), &:where([data-theme="dark"]));

@theme {
  /* iris ramp */
  --color-iris-50:#F1F0FE; --color-iris-100:#E5E2FC; --color-iris-200:#D0CAF8;
  --color-iris-300:#B3A9F5; --color-iris-400:#8A5CF0; --color-iris-500:#6D5DE8;
  --color-iris-600:#5B4BD6; --color-iris-700:#4B3AC9; --color-iris-800:#38299B;
  /* semantic (light defaults; overridden below for dark) */
  --color-bg:#F6F7FB; --color-surface:#FFFFFF; --color-surface-2:#EEEFF4; --color-user:#F1F0FE;
  --color-ink:#1E2233; --color-ink-2:#454A63; --color-ink-3:#616679; --color-ink-4:#8A8FA3;
  --color-line:#E7E8F0;
  --color-accent:var(--color-iris-600); --color-accent-ink:var(--color-iris-700);
  --color-accent-soft:var(--color-iris-50); --color-link:var(--color-iris-700);
  --color-focus:var(--color-iris-500); --color-danger:#E5484D; --color-danger-ink:#BC3B36;
  /* radii */
  --radius-xs:6px; --radius-sm:10px; --radius-md:14px; --radius-lg:20px; --radius-xl:28px;
  /* elevation */
  --shadow-sm:0 1px 2px rgba(30,34,60,.04),0 6px 16px -10px rgba(70,60,150,.18);
  --shadow-md:0 2px 4px rgba(30,34,60,.05),0 14px 30px -14px rgba(70,60,150,.24);
  --shadow-lg:0 10px 44px -14px rgba(80,70,160,.30);
  --shadow-orb:0 24px 70px -16px rgba(110,94,230,.50);
  /* gradients */
  --grad-orb-ring:conic-gradient(from 210deg,#B3A9F5,#8A5CF0,#6D5DE8,#B3A9F5,#8A5CF0);
  --grad-orb-core:radial-gradient(circle at 34% 30%,#FBFAFF 0%,#C9BFFF 24%,#8A5CF0 56%,#5B4BD6 82%,#38299B 100%);
  --grad-orb-glow:radial-gradient(circle,rgba(138,92,240,.45),transparent 62%);
  --grad-greeting:linear-gradient(96deg,#6D5DE8,#8A5CF0 55%,#6D5DE8);
  /* motion + type */
  --dur-fast:120ms; --dur-base:180ms; --ease:cubic-bezier(.2,0,0,1);
  --font-sans:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
}

/* dark overrides (explicit choice wins over the media query) */
:root[data-theme="dark"]{
  --color-bg:#121320; --color-surface:#1B1D2B; --color-surface-2:#23263A; --color-user:#262552;
  --color-ink:#E9E9F2; --color-ink-2:#ADB0C6; --color-ink-3:#838799; --color-ink-4:#5A5E74;
  --color-line:#2C2F45; --color-accent:var(--color-iris-500); --color-accent-ink:var(--color-iris-300);
  --color-accent-soft:rgba(109,93,232,.16); --color-link:var(--color-iris-300); --color-focus:var(--color-iris-300);
  --color-danger:#F26A6E; --color-danger-ink:#F49B9E;
  --shadow-sm:0 2px 8px rgba(0,0,0,.40); --shadow-md:0 8px 24px rgba(0,0,0,.50);
  --shadow-lg:0 16px 48px rgba(0,0,0,.60); --shadow-orb:0 24px 70px -16px rgba(110,94,230,.42);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]):not([data-theme="dark"]){
    --color-bg:#121320; --color-surface:#1B1D2B; --color-surface-2:#23263A; --color-user:#262552;
    --color-ink:#E9E9F2; --color-ink-2:#ADB0C6; --color-ink-3:#838799; --color-ink-4:#5A5E74;
    --color-line:#2C2F45; --color-accent:var(--color-iris-500); --color-accent-ink:var(--color-iris-300);
    --color-accent-soft:rgba(109,93,232,.16); --color-link:var(--color-iris-300); --color-focus:var(--color-iris-300);
    --color-danger:#F26A6E; --color-danger-ink:#F49B9E;
    --shadow-sm:0 2px 8px rgba(0,0,0,.40); --shadow-md:0 8px 24px rgba(0,0,0,.50);
    --shadow-lg:0 16px 48px rgba(0,0,0,.60); --shadow-orb:0 24px 70px -16px rgba(110,94,230,.42);
  }
}

@layer base {
  html,body{height:100%}
  body{
    margin:0; color:var(--color-ink); font-family:var(--font-sans); font-size:15.5px; line-height:1.55;
    -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
    background:
      radial-gradient(120% 60% at 8% -8%, rgba(138,92,240,.10), transparent 55%),
      radial-gradient(120% 55% at 100% 0%, rgba(109,93,232,.07), transparent 50%),
      var(--color-bg);
  }
  :focus-visible{outline:2px solid var(--color-focus); outline-offset:2px}
}
```

Add the Inter font via `next/font` in Task 3's layout (sets the `--font-sans` face). For now the stack falls back to system fonts.

- [ ] **Step 6: Verify build picks up Tailwind**

Run: `cd frontend && npm run build`
Expected: build succeeds (Tailwind v4 compiles the `@theme`).

- [ ] **Step 7: Commit**
```bash
git add frontend/app/globals.css frontend/lib/tokens.ts frontend/lib/tokens.test.ts
git commit -m "feat(frontend): add Iris design tokens and theme-reactive Tailwind theme"
```

---

### Task 3: Theme system — `lib/theme.ts`, no-flash init, `useTheme`, `ThemeToggle`

**Files:**
- Create: `frontend/lib/theme.ts`, `frontend/lib/theme.test.ts`
- Create: `frontend/components/ThemeToggle.tsx`, `frontend/components/ThemeToggle.test.tsx`
- Modify: `frontend/app/layout.tsx` (no-flash script + Inter font)

**Interfaces:**
- Produces: `type Theme = "light" | "dark"`; `getStoredTheme(): Theme | null`; `resolveInitialTheme(): Theme` (stored ?? "light"); `applyTheme(t: Theme): void` (sets `data-theme`, persists `np-theme`); `THEME_INIT_SCRIPT: string`; hook `useTheme(): { theme: Theme; toggle(): void }`; `<ThemeToggle />`.

- [ ] **Step 1: Write `frontend/lib/theme.test.ts`**
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resolveInitialTheme, applyTheme, getStoredTheme } from "./theme";

beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute("data-theme"); });

describe("theme", () => {
  it("defaults to light when nothing is stored", () => {
    expect(resolveInitialTheme()).toBe("light");
  });
  it("honours a stored dark choice", () => {
    localStorage.setItem("np-theme", "dark");
    expect(resolveInitialTheme()).toBe("dark");
  });
  it("applyTheme sets the attribute and persists", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(getStoredTheme()).toBe("dark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/theme.test.ts`
Expected: FAIL — cannot find module `./theme`.

- [ ] **Step 3: Write `frontend/lib/theme.ts`**
```ts
export type Theme = "light" | "dark";
const KEY = "np-theme";

export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch { return null; }
}

export function resolveInitialTheme(): Theme {
  return getStoredTheme() ?? "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
}

/** Runs before paint in <head> to avoid a flash; default light. */
export const THEME_INIT_SCRIPT =
  `try{var t=localStorage.getItem("np-theme");document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"light");}catch(e){document.documentElement.setAttribute("data-theme","light");}`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/theme.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `frontend/components/ThemeToggle.tsx`**
```tsx
"use client";
import { useEffect, useState } from "react";
import { applyTheme, resolveInitialTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => { setTheme(resolveInitialTheme()); }, []);
  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={theme === "dark"}
      aria-label="Switch between light and dark mode"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-grid size-11 place-items-center rounded-full border border-line bg-surface text-ink-2 shadow-sm transition-colors hover:border-accent hover:text-accent"
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      )}
    </button>
  );
}
```

- [ ] **Step 6: Write `frontend/components/ThemeToggle.test.tsx`**
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle";

beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute("data-theme"); });

describe("ThemeToggle", () => {
  it("toggles data-theme and aria-pressed on click", async () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /switch between light and dark/i });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(btn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });
});
```

- [ ] **Step 7: Wire the no-flash script + Inter into `app/layout.tsx`**
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Ask the Professor · My Longevity Hub",
  description: "Straight answers on living longer, better.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
```
In `globals.css` `@theme`, change the Inter reference so the loaded face is used: set `--font-sans:var(--font-inter),-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;`.

- [ ] **Step 8: Run tests + build**

Run: `cd frontend && npx vitest run lib/theme.test.ts components/ThemeToggle.test.tsx && npm run build`
Expected: PASS; build succeeds.

- [ ] **Step 9: Commit**
```bash
git add frontend/lib/theme.ts frontend/lib/theme.test.ts frontend/components/ThemeToggle.tsx frontend/components/ThemeToggle.test.tsx frontend/app/layout.tsx frontend/app/globals.css
git commit -m "feat(frontend): theme system with no-flash init and light/dark toggle"
```

---

### Task 4: `lib/storage.ts` — typed localStorage

**Files:**
- Create: `frontend/lib/storage.ts`, `frontend/lib/storage.test.ts`

**Interfaces:**
- Consumes: `Turn` from Task 5 is NOT required here — define a local `Turn` type inline as `{ role: "user" | "model"; text: string }` and re-export it from `schemas.ts` in Task 5 to keep one source. To avoid a cycle, `storage.ts` imports `Turn` from `schemas.ts`; therefore **do Task 5 before Task 4's implementation** — or define `Turn` in `schemas.ts` first. (Sequence: Task 5 then Task 4.)
- Produces: `loadHistory(): Turn[]`, `saveHistory(turns: Turn[]): void` (caps at 40), `loadSession(): string | null`, `saveSession(id: string): void`, `clearChat(): void`.

- [ ] **Step 1: Write `frontend/lib/storage.test.ts`**
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadHistory, saveHistory, loadSession, saveSession, clearChat } from "./storage";

beforeEach(() => localStorage.clear());

describe("storage", () => {
  it("returns [] history when empty or corrupt", () => {
    expect(loadHistory()).toEqual([]);
    localStorage.setItem("np-history", "{not json");
    expect(loadHistory()).toEqual([]);
  });
  it("round-trips and caps history at 40", () => {
    const turns = Array.from({ length: 50 }, (_, i) => ({ role: "user" as const, text: `m${i}` }));
    saveHistory(turns);
    const back = loadHistory();
    expect(back).toHaveLength(40);
    expect(back[0]!.text).toBe("m10");
  });
  it("round-trips session and clears both", () => {
    saveSession("sid-1"); saveHistory([{ role: "user", text: "hi" }]);
    expect(loadSession()).toBe("sid-1");
    clearChat();
    expect(loadSession()).toBeNull();
    expect(loadHistory()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/storage.test.ts`
Expected: FAIL — cannot find module `./storage`.

- [ ] **Step 3: Write `frontend/lib/storage.ts`**
```ts
import { TurnSchema, type Turn } from "./schemas";
import { z } from "zod";

const HKEY = "np-history", SKEY = "np-session";

export function loadHistory(): Turn[] {
  try {
    const raw = localStorage.getItem(HKEY);
    if (!raw) return [];
    const parsed = z.array(TurnSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch { return []; }
}
export function saveHistory(turns: Turn[]): void {
  try { localStorage.setItem(HKEY, JSON.stringify(turns.slice(-40))); } catch { /* ignore */ }
}
export function loadSession(): string | null {
  try { return localStorage.getItem(SKEY); } catch { return null; }
}
export function saveSession(id: string): void {
  try { localStorage.setItem(SKEY, id); } catch { /* ignore */ }
}
export function clearChat(): void {
  try { localStorage.removeItem(HKEY); localStorage.removeItem(SKEY); } catch { /* ignore */ }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/storage.test.ts`
Expected: PASS (requires Task 5's `schemas.ts`).

- [ ] **Step 5: Commit**
```bash
git add frontend/lib/storage.ts frontend/lib/storage.test.ts
git commit -m "feat(frontend): typed localStorage helpers for chat history and session"
```

---

### Task 5: `lib/schemas.ts` — zod contracts

**Files:**
- Create: `frontend/lib/schemas.ts`, `frontend/lib/schemas.test.ts`

**Interfaces:**
- Produces: `TurnSchema` + `Turn` (`{role:"user"|"model"; text:string}`), `ChatRequestSchema` + `ChatRequest` (`{message:string; session_id?:string|null; history?:Turn[]}`), and the WS `LiveMessageSchema` union (reserved for Plan 3: `ready|card|interrupted|turn|guardrail|info|error`).

- [ ] **Step 1: Write `frontend/lib/schemas.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { TurnSchema, ChatRequestSchema, LiveMessageSchema } from "./schemas";

describe("schemas", () => {
  it("accepts a valid turn and rejects a bad role", () => {
    expect(TurnSchema.safeParse({ role: "user", text: "hi" }).success).toBe(true);
    expect(TurnSchema.safeParse({ role: "bot", text: "hi" }).success).toBe(false);
  });
  it("requires a non-empty message in ChatRequest", () => {
    expect(ChatRequestSchema.safeParse({ message: "" }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ message: "ok", history: [{ role: "model", text: "y" }] }).success).toBe(true);
  });
  it("parses a card live-message", () => {
    const m = LiveMessageSchema.safeParse({ type: "card", url: "/guides/x", title: "X" });
    expect(m.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/schemas.test.ts`
Expected: FAIL — cannot find module `./schemas`.

- [ ] **Step 3: Write `frontend/lib/schemas.ts`**
```ts
import { z } from "zod";

export const TurnSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string(),
});
export type Turn = z.infer<typeof TurnSchema>;

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  session_id: z.string().nullish(),
  history: z.array(TurnSchema).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/** Inbound /live messages (reserved for Plan 3). */
export const LiveMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("card"), url: z.string(), title: z.string(), subtitle: z.string().optional() }),
  z.object({ type: z.literal("interrupted") }),
  z.object({ type: z.literal("turn") }),
  z.object({ type: z.literal("guardrail"), text: z.string() }),
  z.object({ type: z.literal("info"), text: z.string() }),
  z.object({ type: z.literal("error"), text: z.string() }),
]);
export type LiveMessage = z.infer<typeof LiveMessageSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/lib/schemas.ts frontend/lib/schemas.test.ts
git commit -m "feat(frontend): zod contracts for chat and live messages"
```

---

### Task 6: `lib/markdown.ts` — safe renderer (ported)

**Files:**
- Create: `frontend/lib/markdown.ts`, `frontend/lib/markdown.test.ts`

Port the renderer from `backend/app/static/index.html` (`esc`, `inline`, `render`, `stripDisclaimer`, `stripGuideTokens`) to typed TS, preserving behaviour exactly.

**Interfaces:**
- Produces: `renderMarkdown(md: string): string` (safe HTML), `stripDisclaimer(t: string): string`, `stripGuideTokens(t: string): string`, `extractGuideSlugs(t: string): string[]`, `BRANDS: readonly string[]`.

- [ ] **Step 1: Write `frontend/lib/markdown.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { renderMarkdown, stripGuideTokens, extractGuideSlugs } from "./markdown";

describe("markdown", () => {
  it("escapes HTML in user input", () => {
    expect(renderMarkdown("<script>alert(1)</script>")).not.toContain("<script>");
    expect(renderMarkdown("<b>x</b>")).toContain("&lt;b&gt;");
  });
  it("renders bold, code and headings", () => {
    expect(renderMarkdown("**hi**")).toContain("<strong>hi</strong>");
    expect(renderMarkdown("`x`")).toContain("<code>x</code>");
    expect(renderMarkdown("# Head")).toContain("<h3>Head</h3>");
  });
  it("renders a tier badge", () => {
    expect(renderMarkdown("*Promising*")).toContain('class="tier"');
  });
  it("autolinks brand domains once", () => {
    const html = renderMarkdown("try my-peptides.co.uk today");
    expect(html).toContain('href="https://my-peptides.co.uk"');
  });
  it("renders bullet lists", () => {
    expect(renderMarkdown("- one\n- two")).toContain("<ul><li>one</li><li>two</li></ul>");
  });
  it("strips and extracts guide tokens", () => {
    expect(stripGuideTokens("hi [[guide:better-sleep]]")).toBe("hi");
    expect(extractGuideSlugs("a [[guide:hair-loss]] b [[guide:hair-loss]]")).toEqual(["hair-loss"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/markdown.test.ts`
Expected: FAIL — cannot find module `./markdown`.

- [ ] **Step 3: Write `frontend/lib/markdown.ts`** (ported from `index.html` lines 302–350, typed)
```ts
export const BRANDS = ["my-peptides.co.uk", "mypeptideslabs.com", "thenad.co.uk", "imnatura.co.uk"] as const;

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  let out = esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(Strong|Moderate|Promising|Animal-only)\*/g, '<span class="tier">$1</span>')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  for (const d of BRANDS) {
    out = out.replace(new RegExp("(?<!//)\\b" + d.replace(/\./g, "\\.") + "\\b", "g"),
      '<a href="https://' + d + '" target="_blank" rel="noopener">' + d + "</a>");
  }
  return out;
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n");
  let html = "";
  let list: "ul" | "ol" | null = null;
  const closeList = () => { if (list) { html += "</" + list + ">"; list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#{1,6}\s+(.*)/))) { closeList(); html += "<h3>" + inline(m[1]!) + "</h3>"; }
    else if ((m = line.match(/^[-*]\s+(.*)/))) { if (list !== "ul") { closeList(); list = "ul"; html += "<ul>"; } html += "<li>" + inline(m[1]!) + "</li>"; }
    else if ((m = line.match(/^\d+[.)]\s+(.*)/))) { if (list !== "ol") { closeList(); list = "ol"; html += "<ol>"; } html += "<li>" + inline(m[1]!) + "</li>"; }
    else { closeList(); html += "<p>" + inline(line) + "</p>"; }
  }
  closeList();
  return html;
}

export function stripDisclaimer(t: string): string {
  return t.replace(/\s*(?:\*\*\*|---)?\s*>?\s*The Nutty Professor is an AI character[\s\S]*?qualified clinician\.?\s*$/i, "").trim();
}

export function stripGuideTokens(t: string): string {
  return t.replace(/\[\[guide:[a-z0-9-]*\]\]/gi, "")
          .replace(/\s*\[\[[^\]]*$/, "")
          .replace(/\n{3,}/g, "\n\n").trim();
}

export function extractGuideSlugs(t: string): string[] {
  const seen: string[] = [];
  const re = /\[\[guide:([a-z0-9-]+)\]\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) { const s = m[1]!.toLowerCase(); if (!seen.includes(s)) seen.push(s); }
  return seen;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/markdown.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/lib/markdown.ts frontend/lib/markdown.test.ts
git commit -m "feat(frontend): port safe markdown renderer with tier and brand autolinks"
```

---

### Task 7: BFF Route Handler `POST /api/chat/stream`

**Files:**
- Create: `frontend/app/api/chat/stream/route.ts`, `frontend/app/api/chat/stream/route.test.ts`

**Interfaces:**
- Consumes: `ChatRequestSchema` (Task 5), `BACKEND_URL` env.
- Produces: a Node-runtime handler that validates the body, forwards to `${BACKEND_URL}/chat/stream`, returns the upstream `ReadableStream` unbuffered with `X-Session-Id` propagated; maps upstream 429/413 to the same status; 400 on invalid body.

- [ ] **Step 1: Write `frontend/app/api/chat/stream/route.test.ts`**
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });
beforeEach(() => { process.env.BACKEND_URL = "http://backend.test"; });

function req(body: unknown) {
  return new Request("http://localhost/api/chat/stream", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("POST /api/chat/stream", () => {
  it("400s an invalid body", async () => {
    const res = await POST(req({ message: "" }));
    expect(res.status).toBe(400);
  });
  it("forwards to the backend and propagates X-Session-Id", async () => {
    const upstream = new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("hi")); c.close(); } }),
      { status: 200, headers: { "X-Session-Id": "sid-9", "content-type": "text/plain" } });
    globalThis.fetch = vi.fn().mockResolvedValue(upstream);
    const res = await POST(req({ message: "hello" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Session-Id")).toBe("sid-9");
    expect(await res.text()).toBe("hi");
    expect(globalThis.fetch).toHaveBeenCalledWith("http://backend.test/chat/stream", expect.objectContaining({ method: "POST" }));
  });
  it("maps a 429 through", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("slow down", { status: 429 }));
    const res = await POST(req({ message: "hello" }));
    expect(res.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run app/api/chat/stream/route.test.ts`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 3: Write `frontend/app/api/chat/stream/route.ts`**
```ts
import { ChatRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try { json = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  const parsed = ChatRequestSchema.safeParse(json);
  if (!parsed.success) return new Response("Invalid request", { status: 400 });

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}/chat/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
  } catch {
    return new Response("Upstream unreachable", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(await upstream.text().catch(() => ""), { status: upstream.status || 502 });
  }

  const headers = new Headers({
    "content-type": upstream.headers.get("content-type") ?? "text/plain; charset=utf-8",
    "cache-control": "no-cache",
    "x-accel-buffering": "no",
  });
  const sid = upstream.headers.get("X-Session-Id");
  if (sid) headers.set("X-Session-Id", sid);

  return new Response(upstream.body, { status: 200, headers });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run app/api/chat/stream/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/app/api/chat/stream
git commit -m "feat(frontend): BFF route that streams chat from FastAPI with session header"
```

---

### Task 8: `lib/api.ts` — client stream reader

**Files:**
- Create: `frontend/lib/api.ts`, `frontend/lib/api.test.ts`

**Interfaces:**
- Consumes: `ChatRequest`, `/api/chat/stream`.
- Produces: `streamChat(body: ChatRequest, onChunk: (full: string) => void, signal?: AbortSignal): Promise<{ sessionId: string | null; full: string; status: number }>` — reads the stream, calling `onChunk` with the accumulated text; returns final text + `X-Session-Id` + status. On 429/413 returns `{ status, full: "", sessionId: null }` without throwing.

- [ ] **Step 1: Write `frontend/lib/api.test.ts`**
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { streamChat } from "./api";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

function streamResponse(chunks: string[], headers: Record<string, string> = {}, status = 200) {
  const enc = new TextEncoder();
  return new Response(new ReadableStream({
    start(c) { for (const ch of chunks) c.enqueue(enc.encode(ch)); c.close(); },
  }), { status, headers });
}

describe("streamChat", () => {
  it("accumulates chunks and returns the session id", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(streamResponse(["Hel", "lo"], { "X-Session-Id": "s1" }));
    const seen: string[] = [];
    const res = await streamChat({ message: "hi" }, (full) => seen.push(full));
    expect(res.full).toBe("Hello");
    expect(res.sessionId).toBe("s1");
    expect(seen.at(-1)).toBe("Hello");
  });
  it("returns status without throwing on 429", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(streamResponse([], {}, 429));
    const res = await streamChat({ message: "hi" }, () => {});
    expect(res.status).toBe(429);
    expect(res.full).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/api.test.ts`
Expected: FAIL — cannot find module `./api`.

- [ ] **Step 3: Write `frontend/lib/api.ts`**
```ts
import type { ChatRequest } from "./schemas";

export interface StreamResult { sessionId: string | null; full: string; status: number; }

export async function streamChat(
  body: ChatRequest,
  onChunk: (full: string) => void,
  signal?: AbortSignal,
): Promise<StreamResult> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (res.status === 429 || res.status === 413) return { sessionId: null, full: "", status: res.status };
  if (!res.ok || !res.body) throw new Error("HTTP " + res.status);

  const sessionId = res.headers.get("X-Session-Id");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    full += dec.decode(value, { stream: true });
    onChunk(full);
  }
  full += dec.decode();
  onChunk(full);
  return { sessionId, full, status: 200 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/lib/api.ts frontend/lib/api.test.ts
git commit -m "feat(frontend): client stream reader for the chat BFF"
```

---

### Task 9: Presentational components (Orb, TypingDots, LinkCard, Disclaimer, Message, Welcome)

**Files:**
- Create: `frontend/components/Orb.tsx`, `frontend/components/TypingDots.tsx`, `frontend/components/LinkCard.tsx`, `frontend/components/Disclaimer.tsx`, `frontend/components/Message.tsx`, `frontend/components/Welcome.tsx`
- Create: `frontend/components/Message.test.tsx`, `frontend/components/Welcome.test.tsx`
- Modify: `frontend/app/globals.css` (append the component-CSS block below for orb/typing/tier/prose — these are the pieces that are cleaner as CSS than utilities; ported from `index.html`/`preview.html`)

**Interfaces:**
- Consumes: `renderMarkdown`, `extractGuideSlugs` (Task 6); guide catalog is Plan 4, so `LinkCard` takes explicit `{href,title,subtitle}` props.
- Produces: `<Orb state?: "idle"|"listening"|"thinking"|"speaking" className?>`, `<TypingDots/>`, `<LinkCard href title subtitle?/>`, `<Disclaimer/>`, `<Message role="user"|"bot" html?: string>`, `<Welcome onChip(text)>`.

- [ ] **Step 1: Append component CSS to `globals.css`** (orb layers + keyframes, typing dots, tier badge, message prose, link card) — port verbatim from `backend/app/static/index.html` (the themed version), replacing `var(--x)` with `var(--color-x)` where the token was renamed in Task 2. Include: `.orb`, `.orb span`, `.orb .orb-glow/-ring/-core`, `.orb.listening/.thinking/.speaking`, `@keyframes orb-spin/orb-breathe/orb-speak`, `.typing`, `@keyframes bob`, `.tier`, `.prose` rules for `p/h3/ul/ol/li/strong/em/code/a`, `.linkcard` and children, all under `@layer components`, plus `@media (prefers-reduced-motion:reduce)` disabling orb/typing animations.

- [ ] **Step 2: Write `frontend/components/Orb.tsx`**
```tsx
import clsx from "clsx";
export function Orb({ state, className }: { state?: "idle" | "listening" | "thinking" | "speaking"; className?: string }) {
  return (
    <div className={clsx("orb", state, className)} aria-hidden="true">
      <span className="orb-glow" /><span className="orb-ring" /><span className="orb-core" />
    </div>
  );
}
```

- [ ] **Step 3: Write `TypingDots.tsx`, `Disclaimer.tsx`, `LinkCard.tsx`**
```tsx
// TypingDots.tsx
export function TypingDots() {
  return <div className="typing" aria-label="The professor is typing"><i /><i /><i /></div>;
}
```
```tsx
// Disclaimer.tsx
export function Disclaimer() {
  return (
    <div className="disc">
      <div className="disc-rule" />
      <p><strong>General information only</strong> — not medical advice, diagnosis or treatment. For anything urgent, call <strong>999</strong> or NHS <strong>111</strong>.</p>
    </div>
  );
}
```
```tsx
// LinkCard.tsx
export function LinkCard({ href, title, subtitle }: { href: string; title: string; subtitle?: string }) {
  return (
    <a className="linkcard" href={href} target="_blank" rel="noopener">
      <span className="lc-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1" /></svg></span>
      <span className="lc-body"><span className="lc-title">{title}</span><span className="lc-sub">{(subtitle ? subtitle + " · " : "") + "Tap to open"}</span></span>
      <span className="lc-go" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg></span>
    </a>
  );
}
```

- [ ] **Step 4: Write `Message.tsx` and its test**
```tsx
// Message.tsx
import clsx from "clsx";
export function Message({ role, html, children }: { role: "user" | "bot"; html?: string; children?: React.ReactNode }) {
  return (
    <div className={clsx("msg", role)}>
      <div className="b">
        {html !== undefined ? <div dangerouslySetInnerHTML={{ __html: html }} /> : children}
      </div>
    </div>
  );
}
```
```tsx
// Message.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Message } from "./Message";
import { renderMarkdown } from "@/lib/markdown";
describe("Message", () => {
  it("renders bot markdown html", () => {
    render(<Message role="bot" html={renderMarkdown("**hello**")} />);
    expect(screen.getByText("hello").tagName).toBe("STRONG");
  });
});
```

- [ ] **Step 5: Write `Welcome.tsx` and its test**
```tsx
// Welcome.tsx
import { Orb } from "./Orb";
const CHIPS = [
  "How do I sleep better?",
  "What supplements should I take daily?",
  "Does NMN actually work?",
  "How can I recover from an injury faster?",
];
export function Welcome({ onChip }: { onChip: (text: string) => void }) {
  return (
    <div className="welcome" id="welcome">
      <Orb className="welcome-orb" />
      <div className="big">Straight answers on <span className="kw">living longer</span>, better.</div>
      <p>Fasting, sleep, supplements, peptides, recovery, energy — the honest version, no hype.</p>
      <div className="chips">
        {CHIPS.map((c) => <button key={c} className="chip" type="button" onClick={() => onChip(c)}>{c}</button>)}
      </div>
    </div>
  );
}
```
```tsx
// Welcome.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Welcome } from "./Welcome";
describe("Welcome", () => {
  it("fires onChip with the chip text", async () => {
    const onChip = vi.fn();
    render(<Welcome onChip={onChip} />);
    await userEvent.click(screen.getByRole("button", { name: "Does NMN actually work?" }));
    expect(onChip).toHaveBeenCalledWith("Does NMN actually work?");
  });
});
```
Add `.welcome`, `.welcome .big`, `.kw`, `.chips`, `.chip`, `.welcome-orb` (112px) CSS to `globals.css` `@layer components`, ported from the themed `index.html`.

- [ ] **Step 6: Run tests + build**

Run: `cd frontend && npx vitest run components/Message.test.tsx components/Welcome.test.tsx && npm run build`
Expected: PASS; build clean.

- [ ] **Step 7: Commit**
```bash
git add frontend/components frontend/app/globals.css
git commit -m "feat(frontend): Iris presentational components (orb, message, welcome, link card)"
```

---

### Task 10: `useChat` hook

**Files:**
- Create: `frontend/lib/useChat.ts`, `frontend/lib/useChat.test.tsx`

**Interfaces:**
- Consumes: `streamChat` (Task 8), `loadHistory/saveHistory/loadSession/saveSession/clearChat` (Task 4), `renderMarkdown/stripDisclaimer/stripGuideTokens/extractGuideSlugs` (Task 6), `Turn` (Task 5).
- Produces: `type ChatMessage = { role:"user"|"bot"; html:string; guideSlugs:string[] }`; `useChat(): { messages: ChatMessage[]; busy: boolean; send(text:string): Promise<void>; newChat(): void; started: boolean }`. Persists raw turns to `history[]`; `send` streams and re-renders the growing bot message; guide slugs surface for LinkCards; errors append a professor apology bubble.

- [ ] **Step 1: Write `frontend/lib/useChat.test.tsx`**
```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "./useChat";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });
beforeEach(() => localStorage.clear());

function streamResponse(text: string, sid = "s1") {
  const enc = new TextEncoder();
  return new Response(new ReadableStream({ start(c) { c.enqueue(enc.encode(text)); c.close(); } }),
    { status: 200, headers: { "X-Session-Id": sid } });
}

describe("useChat", () => {
  it("adds a user bubble then streams a bot reply with a guide card", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(streamResponse("Sleep is **key**. [[guide:better-sleep]]"));
    const { result } = renderHook(() => useChat());
    await act(async () => { await result.current.send("how do I sleep?"); });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(result.current.messages[0]).toMatchObject({ role: "user" });
    const bot = result.current.messages[1]!;
    expect(bot.role).toBe("bot");
    expect(bot.html).toContain("<strong>key</strong>");
    expect(bot.guideSlugs).toEqual(["better-sleep"]);
    expect(localStorage.getItem("np-session")).toBe("s1");
  });
  it("shows an apology bubble when the request throws", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useChat());
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => expect(result.current.messages.at(-1)!.html).toMatch(/couldn.t reach the professor/i));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/useChat.test.tsx`
Expected: FAIL — cannot find module `./useChat`.

- [ ] **Step 3: Write `frontend/lib/useChat.ts`**
```ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { streamChat } from "./api";
import { renderMarkdown, stripDisclaimer, stripGuideTokens, extractGuideSlugs, esc } from "./markdown";
import { loadHistory, saveHistory, loadSession, saveSession, clearChat } from "./storage";
import type { Turn } from "./schemas";

export interface ChatMessage { role: "user" | "bot"; html: string; guideSlugs: string[]; }

function renderBot(full: string): { html: string; guideSlugs: string[] } {
  const clean = stripDisclaimer(stripGuideTokens(full));
  return { html: renderMarkdown(clean), guideSlugs: extractGuideSlugs(full) };
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const history = useRef<Turn[]>([]);
  const session = useRef<string | null>(null);

  useEffect(() => {
    history.current = loadHistory();
    session.current = loadSession();
    if (history.current.length) {
      setStarted(true);
      setMessages(history.current.map((t) =>
        t.role === "user"
          ? { role: "user", html: esc(t.text).replace(/\n/g, "<br>"), guideSlugs: [] }
          : { role: "bot", ...renderBot(t.text) },
      ));
    }
  }, []);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setStarted(true);
    setBusy(true);
    setMessages((m) => [...m, { role: "user", html: esc(text).replace(/\n/g, "<br>"), guideSlugs: [] }]);
    const prior = history.current.slice(-16);
    let botIndex = -1;
    setMessages((m) => { botIndex = m.length; return [...m, { role: "bot", html: "", guideSlugs: [] }]; });
    try {
      const res = await streamChat(
        { message: text, session_id: session.current, history: prior },
        (full) => setMessages((m) => m.map((msg, i) => i === botIndex ? { role: "bot", ...renderBot(full) } : msg)),
      );
      if (res.status === 429) { setMessages((m) => patch(m, botIndex, "<p>You’re sending messages a little fast — give me a few seconds, then try again.</p>")); return; }
      if (res.status === 413) { setMessages((m) => patch(m, botIndex, "<p>That message is a bit long for me — try trimming it down.</p>")); return; }
      if (res.sessionId) { session.current = res.sessionId; saveSession(res.sessionId); }
      setMessages((m) => m.map((msg, i) => i === botIndex ? { role: "bot", ...renderBot(res.full) } : msg));
      history.current = [...history.current, { role: "user", text }, { role: "model", text: res.full }];
      saveHistory(history.current);
    } catch (err) {
      setMessages((m) => patch(m, botIndex, `<p>Sorry — I couldn’t reach the professor just now. Is the server running? <span style="color:var(--color-ink-3)">(${esc(String((err as Error).message || err))})</span></p>`));
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const newChat = useCallback(() => { clearChat(); history.current = []; session.current = null; setMessages([]); setStarted(false); }, []);

  return { messages, busy, started, send, newChat };
}

function patch(m: ChatMessage[], i: number, html: string): ChatMessage[] {
  return m.map((msg, idx) => idx === i ? { role: "bot", html, guideSlugs: [] } : msg);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/useChat.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/lib/useChat.ts frontend/lib/useChat.test.tsx
git commit -m "feat(frontend): useChat hook with streaming, persistence and guide cards"
```

---

### Task 11: Composer

**Files:**
- Create: `frontend/components/Composer.tsx`, `frontend/components/Composer.test.tsx`
- Modify: `frontend/app/globals.css` (composer CSS ported from themed `index.html`)

**Interfaces:**
- Consumes: nothing from later plans directly. The morphing key exposes `onCall` (voice entry, wired in Plan 3) and `onSend`.
- Produces: `<Composer busy onSend(text) onCall?() />`. Empty textarea → key shows the waveform glyph, `aria-label="Call the professor"`, calls `onCall` (a no-op prop in this plan; if `onCall` is undefined the key is disabled with `title="Voice mode coming soon"`). Non-empty → key shows the arrow glyph, `aria-label="Send"`, calls `onSend`. Dictation mic is rendered disabled here (wired in Plan 2). Enter sends, Shift+Enter newline, autosize to 140px.

- [ ] **Step 1: Write `frontend/components/Composer.test.tsx`**
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "./Composer";

describe("Composer", () => {
  it("morphs the key: call when empty, send when there is text", async () => {
    const onSend = vi.fn(), onCall = vi.fn();
    render(<Composer busy={false} onSend={onSend} onCall={onCall} />);
    expect(screen.getByRole("button", { name: "Call the professor" })).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "hello");
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });
  it("sends on Enter and clears", async () => {
    const onSend = vi.fn();
    render(<Composer busy={false} onSend={onSend} />);
    const box = screen.getByRole("textbox");
    await userEvent.type(box, "hi there{Enter}");
    expect(onSend).toHaveBeenCalledWith("hi there");
    expect((box as HTMLTextAreaElement).value).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run components/Composer.test.tsx`
Expected: FAIL — cannot find module `./Composer`.

- [ ] **Step 3: Write `frontend/components/Composer.tsx`**
```tsx
"use client";
import { useRef, useState } from "react";

export function Composer({ busy, onSend, onCall }: { busy: boolean; onSend: (t: string) => void; onCall?: () => void }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const hasText = value.trim().length > 0;

  function autosize() { const el = ref.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px"; }
  function submit() { const t = value.trim(); if (!t || busy) return; onSend(t); setValue(""); requestAnimationFrame(autosize); }

  return (
    <div className="composer">
      <div className="box">
        <textarea
          ref={ref} className="field" rows={1} placeholder="Ask the professor…" autoComplete="off"
          value={value} disabled={busy}
          onChange={(e) => { setValue(e.target.value); autosize(); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button className="pill-btn mic" type="button" disabled aria-label="Speak your question (coming soon)">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><line x1="12" y1="18" x2="12" y2="21" /></svg>
        </button>
        {hasText ? (
          <button className="pill-btn send" type="button" aria-label="Send" onClick={submit}>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="6 11 12 5 18 11" /></svg>
          </button>
        ) : (
          <button className="pill-btn send" type="button" aria-label="Call the professor"
            disabled={!onCall} title={onCall ? "Call the professor" : "Voice mode coming soon"} onClick={onCall}>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h2" /><path d="M7 8v8" /><path d="M11 5v14" /><path d="M15 8v8" /><path d="M19 12h2" /></svg>
          </button>
        )}
      </div>
      <p className="foot">Answers are AI-generated. The professor is an original character, not a real doctor.</p>
    </div>
  );
}
```

- [ ] **Step 4: Append composer CSS to `globals.css`** — port `.composer`, `.box`, `.box:focus-within`, `.field`, `.pill-btn`, `.mic`, `.send` from the themed `index.html` (§ composer), under `@layer components`, mapping token names to `--color-*`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run components/Composer.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add frontend/components/Composer.tsx frontend/components/Composer.test.tsx frontend/app/globals.css
git commit -m "feat(frontend): composer with morphing call/send key"
```

---

### Task 12: Header, Rail/Drawer, and the ChatShell page

**Files:**
- Create: `frontend/components/Header.tsx`, `frontend/components/SideNav.tsx` (drawer ≤md / rail ≥lg), `frontend/components/ReadAloudSwitch.tsx`, `frontend/components/ChatShell.tsx`
- Create: `frontend/components/ChatShell.test.tsx`
- Modify: `frontend/app/page.tsx`, `frontend/app/globals.css` (shell/header/rail/thread layout)

**Interfaces:**
- Consumes: `useChat` (Task 10), `Composer` (Task 11), `Welcome`, `Message`, `TypingDots`, `LinkCard`, `Disclaimer`, `Orb`, `ThemeToggle`.
- Produces: `<ChatShell/>` — full chat mode: header (menu ≤md · mark · wordmark · New chat), responsive drawer/rail (New chat · Call the professor [disabled until Plan 3] · history placeholder · footer: ReadAloudSwitch [visual-only until Plan 2] · ThemeToggle · Guides link), thread with empty state, sticky composer, auto-scroll on new content. `ReadAloudSwitch` is a controlled switch persisted to `np-readaloud` but with no speaking behaviour yet (Plan 2 wires it).

- [ ] **Step 1: Write `ChatShell.test.tsx`**
```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatShell } from "./ChatShell";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });
beforeEach(() => localStorage.clear());

function streamResponse(text: string) {
  const enc = new TextEncoder();
  return new Response(new ReadableStream({ start(c) { c.enqueue(enc.encode(text)); c.close(); } }),
    { status: 200, headers: { "X-Session-Id": "s1" } });
}

describe("ChatShell", () => {
  it("shows the welcome empty state, then a sent message and streamed reply", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(streamResponse("**Hi** there."));
    render(<ChatShell />);
    expect(screen.getByText(/living longer/i)).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("hello")).toBeInTheDocument();
    expect(await screen.findByText("Hi")).toBeInTheDocument();
    expect(screen.queryByText(/living longer/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run components/ChatShell.test.tsx`
Expected: FAIL — cannot find module `./ChatShell`.

- [ ] **Step 3: Write `ReadAloudSwitch.tsx`**
```tsx
"use client";
import { useEffect, useState } from "react";
export function ReadAloudSwitch() {
  const [on, setOn] = useState(false);
  useEffect(() => { try { setOn(localStorage.getItem("np-readaloud") === "1"); } catch {} }, []);
  function toggle() { const next = !on; setOn(next); try { localStorage.setItem("np-readaloud", next ? "1" : "0"); } catch {} }
  return (
    <button type="button" role="switch" aria-checked={on} onClick={toggle} className="switch-row">
      <span>Read answers aloud</span>
      <span className={"switch" + (on ? " on" : "")} aria-hidden="true"><span className="knob" /></span>
    </button>
  );
}
```
(Behaviour beyond persistence is wired in Plan 2.)

- [ ] **Step 4: Write `Header.tsx`, `SideNav.tsx`, `ChatShell.tsx`**

`Header.tsx` — menu button (`onMenu`, hidden ≥lg via CSS), the 3-slash mark, wordmark, and a New chat icon button (`onNewChat`). `SideNav.tsx` — the drawer/rail body: New chat (primary), Call the professor (secondary, `disabled` until Plan 3), a History placeholder region, and a footer with `<ReadAloudSwitch/>`, `<ThemeToggle/>`, and a Guides link to `/guides`. `ChatShell.tsx`:
```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@/lib/useChat";
import { Header } from "./Header";
import { SideNav } from "./SideNav";
import { Disclaimer } from "./Disclaimer";
import { Welcome } from "./Welcome";
import { Message } from "./Message";
import { TypingDots } from "./TypingDots";
import { LinkCard } from "./LinkCard";
import { Composer } from "./Composer";

const GUIDE_TITLES: Record<string, string> = {
  "better-sleep": "How to Sleep Better, Naturally",
  "why-am-i-always-tired": "Why Am I Always Tired?",
  "what-supplements-to-take": "What Supplements Should You Actually Take?",
  "skincare": "Skincare That Actually Works",
  "hair-loss": "Hair Loss and Hair Growth",
  "testosterone": "Low Testosterone: Signs & What Helps",
  "menopause": "Menopause & Perimenopause",
};

export function ChatShell() {
  const { messages, busy, started, send, newChat } = useChat();
  const [drawer, setDrawer] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages]);

  return (
    <div className="app">
      <Header onMenu={() => setDrawer(true)} onNewChat={newChat} />
      <SideNav open={drawer} onClose={() => setDrawer(false)} onNewChat={newChat} />
      <div className="scroll" ref={scrollRef}>
        <Disclaimer />
        <div className="thread">
          {!started && <Welcome onChip={send} />}
          {messages.map((m, i) => (
            m.role === "bot" && m.html === ""
              ? <Message key={i} role="bot"><TypingDots /></Message>
              : <Message key={i} role={m.role} html={m.html} />
          ))}
          {messages.map((m, i) => m.guideSlugs.map((s) => (
            GUIDE_TITLES[s] ? <div className="thread-cards" key={`${i}-${s}`}><LinkCard href={`/guides/${s}`} title={GUIDE_TITLES[s]!} subtitle="My Longevity Hub guide" /></div> : null
          )))}
        </div>
      </div>
      <Composer busy={busy} onSend={send} />
    </div>
  );
}
```
(The guide-card placement here is interim; Plan 4 replaces `GUIDE_TITLES` with the guide catalog and renders cards inside their bot bubble. Leaving `onCall` off `Composer` keeps the key disabled until Plan 3.)

- [ ] **Step 5: Point `app/page.tsx` at the shell**
```tsx
import { ChatShell } from "@/components/ChatShell";
export default function Page() { return <ChatShell />; }
```

- [ ] **Step 6: Append shell/header/rail/thread CSS to `globals.css`** — `.app` (flex column, 100dvh), `.hero`/header (translucent, sticky), `.scroll`, `.thread` (centred, max-width), the drawer (off-canvas ≤md) and rail (persistent ≥lg via `@media (min-width:1024px)`), `.switch-row`/`.switch`/`.knob`. Base these on the themed `index.html` + `CHAT_VOICE_MODES.md` §3.2 rail layout.

- [ ] **Step 7: Run the full suite + build**

Run: `cd frontend && npm run test:run && npm run typecheck && npm run build`
Expected: all tests pass; typecheck clean; build succeeds.

- [ ] **Step 8: Manual verification against a running backend**

Run (two terminals): `backend/.venv/bin/uvicorn app.main:app --port 8000` (from `backend/`) and `cd frontend && BACKEND_URL=http://localhost:8000 npm run dev`. Open `http://localhost:3000`, send a message, confirm streaming, markdown, a guide card if the reply drops one, theme toggle (light default, persists), and mobile (375px) + desktop (rail ≥1024px) layouts.

- [ ] **Step 9: Commit**
```bash
git add frontend/components frontend/app/page.tsx frontend/app/globals.css
git commit -m "feat(frontend): chat shell with header, responsive rail/drawer and thread"
```

---

## Self-review — spec coverage (Phase 1 scope)

- Scaffold + stack (spec §3, §4): Tasks 1–2. ✓
- BFF chat stream + `X-Session-Id`, server-only `BACKEND_URL` (§5): Task 7. ✓
- Iris tokens + light/dark, no-flash, toggle in drawer/rail (§ decisions 4, §12 dark): Tasks 2, 3, 12. ✓
- Markdown incl. tier/brand/guide tokens + XSS (§6, §13): Task 6. ✓
- Streaming chat, chips, link cards, persistence, error copy (§8, §9, §11): Tasks 8, 10, 12. ✓
- Composer morphing key (§2.2) — visual + send now; call action deferred to Plan 3 (seam via `onCall`). ✓ (documented deferral, not a placeholder)
- Read-aloud switch placement (§2.3) — present + persisted; speaking behaviour is Plan 2. ✓ (documented deferral)
- Testing plan chat units (§13): every lib module + key components have Vitest tests. ✓

Deferred to later plans (by design): mic/liveSocket/voiceMachine/autoEnd/VoiceStage (Plan 3), TTS/STT + `/api/tts`,`/api/stt` (Plan 2), guides content/routes (Plan 4). These are named seams, not placeholders.

## Phase roadmap (written as their own plans when reached)

- **Plan 2 — Read-aloud & dictation:** `lib/mic.ts`, `lib/tts.ts`, `/api/tts`, `/api/stt`, `useReadAloud`, `useDictation`, wire `ReadAloudSwitch` + the composer mic.
- **Plan 3 — Voice-call mode:** `lib/liveSocket.ts`, `lib/voiceMachine.ts`, `lib/autoEnd.ts`, `useVoiceCall`, `VoiceStage` + `TalkButton`, orb states, tap/hold/latch + Space, wakeLock, pushState/Back, `CallReceipt`, wire `Composer.onCall`.
- **Plan 4 — Guides:** `content/guides/*` (typed), guide catalog, `app/guides/[slug]/page.tsx` + index, Iris article template, SEO metadata, replace `GUIDE_TITLES` with the catalog.
