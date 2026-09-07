import Link from "next/link";
import type { GuideDoc } from "@/lib/guides";

export function GuideArticle({ guide }: { guide: GuideDoc }) {
  return (
    <div className="guide">
      <header className="guide-top">
        <Link className="guide-back" href="/guides">← All guides</Link>
        <span className="guide-brand">My Longevity Hub</span>
        <Link className="guide-ask" href="/">Ask the professor →</Link>
      </header>
      <article className="guide-body" dangerouslySetInnerHTML={{ __html: guide.html }} />
      {guide.ldJson ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: guide.ldJson }} />
      ) : null}
    </div>
  );
}
