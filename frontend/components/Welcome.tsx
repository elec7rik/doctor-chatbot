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
      <div className="big">
        Straight answers on <span className="kw">living longer</span>, better.
      </div>
      <p>Fasting, sleep, supplements, peptides, recovery, energy — the honest version, no hype.</p>
      <div className="chips">
        {CHIPS.map((c) => (
          <button key={c} className="chip" type="button" onClick={() => onChip(c)}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
