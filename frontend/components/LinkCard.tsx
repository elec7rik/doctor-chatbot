export function LinkCard({ href, title, subtitle }: { href: string; title: string; subtitle?: string }) {
  return (
    <a className="linkcard" href={href} target="_blank" rel="noopener">
      <span className="lc-ic" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1" />
          <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1" />
        </svg>
      </span>
      <span className="lc-body">
        <span className="lc-title">{title}</span>
        <span className="lc-sub">{(subtitle ? subtitle + " · " : "") + "Tap to open"}</span>
      </span>
      <span className="lc-go" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </span>
    </a>
  );
}
