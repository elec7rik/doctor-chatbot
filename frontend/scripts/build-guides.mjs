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
