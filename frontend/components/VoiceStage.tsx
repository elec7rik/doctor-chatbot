"use client";
import { useEffect, useRef } from "react";
import type { VoiceView } from "@/lib/voiceMachine";
import type { CallCard } from "@/lib/storage";
import { Orb } from "./Orb";
import { LinkCard } from "./LinkCard";
import { TalkButton } from "./TalkButton";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function VoiceStage({
  view,
  elapsed,
  cards,
  note,
  hint,
  talkRef,
  orbRef,
  onClose,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: {
  view: VoiceView;
  elapsed: number;
  cards: CallCard[];
  note: string;
  hint: string;
  talkRef: React.Ref<HTMLButtonElement>;
  orbRef: React.Ref<HTMLDivElement>;
  onClose: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);

  return (
    <div className="voice-stage" role="dialog" aria-modal="true" aria-label="Call with the professor">
      <div className="vs-bar">
        <span className="vs-timer" aria-hidden="true">{fmt(elapsed)}</span>
        <button ref={closeRef} type="button" className="vs-x" aria-label="End call" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>
      <p className="vs-disclaimer">General information only — not medical advice. In an emergency call 999 or NHS 111.</p>

      <div className="vs-middle">
        <Orb refEl={orbRef} state={view.orb} desaturated={view.desaturated} frozen={view.frozen} className="stage-orb" />
        <p className="vs-status" aria-live="polite">{view.status}</p>
        <div className="vs-cards">
          {note && <div className="voice-note">{note}</div>}
          {/* Only the latest guide card stays on the stage so it matches the current turn;
              the full set is still kept for the post-call receipt. */}
          {cards.slice(-1).map((c) => (
            <LinkCard key={c.url} href={c.url} title={c.title} subtitle={c.subtitle} />
          ))}
        </div>
      </div>

      <div className="vs-foot">
        <TalkButton view={view} talkRef={talkRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} />
        <p className="vs-hint" aria-live="polite">{hint}</p>
        <button type="button" className="vs-type" onClick={onClose}>Type instead</button>
      </div>
    </div>
  );
}
