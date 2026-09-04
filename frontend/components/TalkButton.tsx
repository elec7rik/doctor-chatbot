"use client";
import clsx from "clsx";
import type { VoiceView } from "@/lib/voiceMachine";

export function TalkButton({
  view,
  talkRef,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: {
  view: VoiceView;
  talkRef: React.Ref<HTMLButtonElement>;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: () => void;
}) {
  if (view.buttonHidden) return null;
  return (
    <button
      ref={talkRef}
      type="button"
      className={clsx("talk-btn", view.buttonActive && "on", view.showLevel && "leveled")}
      disabled={view.buttonDisabled}
      aria-label={view.buttonLabel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="talk-dot" aria-hidden="true" />
      <span className="talk-label">{view.buttonLabel}</span>
    </button>
  );
}
