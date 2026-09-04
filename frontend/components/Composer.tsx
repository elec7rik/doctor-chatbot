"use client";
import { useRef, useState } from "react";
import { useDictation } from "@/lib/useDictation";

export function Composer({
  busy,
  onSend,
  onCall,
}: {
  busy: boolean;
  onSend: (t: string) => void;
  onCall?: () => void;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const hasText = value.trim().length > 0;
  const dictation = useDictation((t) => setValue((v) => (v.trim() ? v.trim() + " " + t : t)));

  function autosize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }
  function submit() {
    const t = value.trim();
    if (!t || busy) return;
    onSend(t);
    setValue("");
    requestAnimationFrame(autosize);
  }

  return (
    <div className="composer">
      <div className="box">
        <textarea
          ref={ref}
          className="field"
          rows={1}
          placeholder={dictation.processing ? "Working out what you said…" : "Ask the professor…"}
          autoComplete="off"
          value={value}
          disabled={busy}
          onChange={(e) => {
            setValue(e.target.value);
            autosize();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {dictation.supported && (
          <button
            className={"pill-btn mic" + (dictation.listening ? " recording" : "")}
            type="button"
            aria-label={dictation.listening ? "Stop dictation" : "Speak your question"}
            aria-pressed={dictation.listening}
            onClick={() => void dictation.toggle()}
          >
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <line x1="12" y1="18" x2="12" y2="21" />
            </svg>
          </button>
        )}
        {hasText ? (
          <button className="pill-btn send" type="button" aria-label="Send" onClick={submit}>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="6 11 12 5 18 11" />
            </svg>
          </button>
        ) : (
          <button
            className="pill-btn send"
            type="button"
            aria-label="Call the professor"
            disabled={!onCall}
            title={onCall ? "Call the professor" : "Voice mode coming soon"}
            onClick={onCall}
          >
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h2" />
              <path d="M7 8v8" />
              <path d="M11 5v14" />
              <path d="M15 8v8" />
              <path d="M19 12h2" />
            </svg>
          </button>
        )}
      </div>
      <p className="foot">Answers are AI-generated. The professor is an original character, not a real doctor.</p>
    </div>
  );
}
