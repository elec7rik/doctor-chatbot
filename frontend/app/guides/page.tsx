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
