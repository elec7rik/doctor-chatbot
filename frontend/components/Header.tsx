"use client";
import { Mark } from "./Mark";

export function Header({ onMenu, onNewChat }: { onMenu: () => void; onNewChat: () => void }) {
  return (
    <header className="hero">
      <div className="hero-row">
        <button className="icon-btn menu-btn" type="button" aria-label="Open menu" onClick={onMenu}>
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Mark />
        <span className="wordmark">My Longevity Hub</span>
        <span className="spacer" />
        <button className="icon-btn" type="button" aria-label="New chat" title="Start a new conversation" onClick={onNewChat}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </header>
  );
}
