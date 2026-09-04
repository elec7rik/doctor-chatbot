// Nutty Professor — eval harness for VERTEX AI (no API key; uses gcloud auth).
// Mirrors how my-peptides-backend calls Vertex, so we test on the real prod path.
//
// Prereqs:
//   1) gcloud CLI installed and authenticated:  gcloud auth login
//      (and for SDKs later:  gcloud auth application-default login)
//   2) A GCP project with the Vertex AI API enabled, and your account granted
//      the "Vertex AI User" role on it.
//   3) The model available in the region (stock gemini-2.5-flash in europe-west4).
//
// Config (.env or shell):
//   GCP_PROJECT_ID   (required)         e.g. my-peptides-staging  (or a dedicated project)
//   GCP_REGION       (default europe-west4)   match where the model lives
//   GEMINI_MODEL     (default gemini-2.5-flash)  stock model id, OR a full endpoint path
//                    projects/<p>/locations/<r>/endpoints/<id> for a fine-tuned endpoint
//
// Usage:  node eval/run-tests-vertex.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

(function loadEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const PROJECT = process.env.GCP_PROJECT_ID;
const REGION = process.env.GCP_REGION || 'europe-west4';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const USE_TOOLS = process.env.GROUND === '1'; // Google Search grounding off by default (matches prod)

if (!PROJECT) {
  console.log('\n⚠  No GCP_PROJECT_ID set.\n');
  console.log('  Add to ' + join(ROOT, '.env') + ':');
  console.log('     GCP_PROJECT_ID=your-project        # e.g. my-peptides-staging');
  console.log('     GCP_REGION=europe-west4            # optional (default)');
  console.log('     GEMINI_MODEL=gemini-2.5-flash      # optional (default)\n');
  process.exit(1);
}

// Access token from gcloud (no key file). Expires ~1h — fine for one run.
let TOKEN;
try {
  TOKEN = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
} catch (e) {
  console.log('\n⚠  Could not get a gcloud access token.\n');
  console.log('  Install the gcloud CLI, then:');
  console.log('     gcloud auth login');
  console.log('     gcloud config set project ' + PROJECT);
  console.log('     gcloud services enable aiplatform.googleapis.com\n');
  process.exit(1);
}

const rawPrompt = readFileSync(join(ROOT, 'prompts', 'system-instructions.md'), 'utf8');
const SYSTEM = rawPrompt.split('\n').filter((l) => !/^#(?!#)/.test(l)).join('\n').trim();
const tests = JSON.parse(readFileSync(join(__dirname, 'tests.json'), 'utf8'));

// MODEL may be a bare model id (publishers/google/models/<id>) or a full endpoint path.
const modelPath = MODEL.startsWith('projects/')
  ? MODEL
  : `projects/${PROJECT}/locations/${REGION}/publishers/google/models/${MODEL}`;
const ENDPOINT = `https://${REGION}-aiplatform.googleapis.com/v1/${modelPath}:generateContent`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(question, useTools = USE_TOOLS) {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: question }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }, // raised from prod's 1024: gemini-2.5-flash's thinking tokens eat the budget and our answers run longer
  };
  if (useTools) body.tools = [{ googleSearch: {} }];

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    if (useTools && /tool|search|INVALID_ARGUMENT|not supported/i.test(t)) return ask(question, false);
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 240).replace(/\s+/g, ' ')}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('').trim() || '(no text returned)';
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(__dirname, 'results');
mkdirSync(outDir, { recursive: true });

const out = [`# Nutty Professor — Vertex eval run`, `- when: ${stamp}`, `- project: ${PROJECT}`, `- region: ${REGION}`, `- model: ${MODEL}`, ''];
let ok = 0, fail = 0;

console.log(`\nRunning ${tests.length} tests on Vertex (${MODEL} @ ${REGION}, project ${PROJECT}) ...\n`);
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
  await sleep(800);
}

const runFile = join(outDir, `vertex-${stamp}.md`);
writeFileSync(runFile, out.join('\n'));
writeFileSync(join(outDir, 'latest-vertex.md'), out.join('\n'));
console.log(`\nDone: ${ok} ok, ${fail} error(s).`);
console.log(`Results: ${runFile}`);
