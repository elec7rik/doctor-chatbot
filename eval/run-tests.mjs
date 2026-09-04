// Nutty Professor — automated eval harness
// Runs eval/tests.json against the Gemini API using prompts/system-instructions.md
// as the system prompt, with Google Search grounding (to match AI Studio).
//
// Usage:  node eval/run-tests.mjs
// Needs:  GEMINI_API_KEY in the environment or in a local .env file (gitignored).
// Optional: GEMINI_MODEL (default: gemini-3.7-flash)
//
// The key is read from env/.env and sent to Google only via the x-goog-api-key
// header. It is never printed, logged, or written to results.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// --- load .env (simple parser; does not print values) ---
(function loadEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

if (!KEY) {
  console.log('\n⚠  No GEMINI_API_KEY found — nothing sent.\n');
  console.log('  1) Get a key:  Google AI Studio → "Get API key" (top-right).');
  console.log('  2) Create ' + join(ROOT, '.env') + ' with a single line:');
  console.log('        GEMINI_API_KEY=your_key_here');
  console.log('  3) Re-run:  node eval/run-tests.mjs\n');
  console.log('  (Do NOT paste the key into chat. .env is gitignored.)\n');
  process.exit(1);
}

// --- build the system prompt from the .md file, stripping single-# annotation lines ---
const rawPrompt = readFileSync(join(ROOT, 'prompts', 'system-instructions.md'), 'utf8');
const SYSTEM = rawPrompt
  .split('\n')
  .filter((l) => !/^#(?!#)/.test(l)) // drop "# annotation" + "# ----" lines, keep ## headers
  .join('\n')
  .trim();

const tests = JSON.parse(readFileSync(join(__dirname, 'tests.json'), 'utf8'));
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(question, useTools = true) {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: question }] }],
    generationConfig: { temperature: 0.7 },
  };
  if (useTools) body.tools = [{ google_search: {} }];

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (useTools && /tool|google_search|INVALID_ARGUMENT|not supported/i.test(errText)) {
      return ask(question, false); // retry without grounding tool
    }
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 240).replace(/\s+/g, ' ')}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('').trim() || '(no text returned)';
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(__dirname, 'results');
mkdirSync(outDir, { recursive: true });

const out = [`# Nutty Professor — eval run`, `- when: ${stamp}`, `- model: ${MODEL}`, ''];
let ok = 0,
  fail = 0;

console.log(`\nRunning ${tests.length} tests against ${MODEL} ...\n`);
for (const t of tests) {
  process.stdout.write(`  [${String(t.id).padStart(2)}] ${t.category.padEnd(10)} `);
  try {
    const answer = await ask(t.question);
    ok++;
    console.log(`ok  (${answer.length} chars)`);
    out.push(`\n---\n\n## ${t.id}. [${t.category}] ${t.question}\n`);
    out.push(`> **Expected:** ${t.expect}\n`);
    out.push('\n' + answer + '\n');
  } catch (e) {
    fail++;
    console.log(`ERROR  ${e.message}`);
    out.push(`\n---\n\n## ${t.id}. [${t.category}] ${t.question}\n`);
    out.push(`> **Expected:** ${t.expect}\n`);
    out.push(`\n**ERROR:** ${e.message}\n`);
  }
  await sleep(1500); // stay under free-tier rate limits
}

const runFile = join(outDir, `run-${stamp}.md`);
writeFileSync(runFile, out.join('\n'));
writeFileSync(join(outDir, 'latest.md'), out.join('\n'));

console.log(`\nDone: ${ok} ok, ${fail} error(s).`);
console.log(`Results: ${runFile}`);
console.log(`Latest:  ${join(outDir, 'latest.md')}`);
