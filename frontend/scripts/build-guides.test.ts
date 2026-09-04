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
