"use client";
import { Mark } from "./Mark";
import { ReadAloudSwitch } from "./ReadAloudSwitch";
import { ThemeToggle } from "./ThemeToggle";

export function SideNav({
  open,
  onClose,
  onNewChat,
  onCall,
}: {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onCall?: () => void;
}) {
  return (
    <>
      <div className={"sidenav-backdrop" + (open ? " open" : "")} onClick={onClose} aria-hidden="true" />
      <nav className={"sidenav" + (open ? " open" : "")} aria-label="Navigation">
        <div className="rail-lockup">
          <Mark />
          <span className="wordmark">My Longevity Hub</span>
        </div>
        <button
          className="nav-row primary"
          type="button"
          onClick={() => {
            onNewChat();
            onClose();
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New chat
        </button>
        <button
          className="nav-row"
          type="button"
          disabled={!onCall}
          onClick={onCall}
          title={onCall ? "Call the professor" : "Voice mode coming soon"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h2" />
            <path d="M7 8v8" />
            <path d="M11 5v14" />
            <path d="M15 8v8" />
            <path d="M19 12h2" />
          </svg>
          Call the professor
        </button>
        <div className="rail-history">Your recent chats will appear here.</div>
        <div className="rail-foot">
          <ReadAloudSwitch />
          <div className="rail-foot-links">
            <a className="rail-link" href="/guides">
              Guides
            </a>
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </>
  );
}
