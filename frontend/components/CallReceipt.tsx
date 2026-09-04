import { LinkCard } from "./LinkCard";
import type { CallReceipt as Receipt } from "@/lib/storage";

export function CallReceipt({ receipt }: { receipt: Receipt }) {
  return (
    <div className="call-receipt">
      <div className="cr-divider" role="separator">
        <span>Voice call · {receipt.mins} min</span>
      </div>
      {receipt.cards.map((c, i) => (
        <div className="thread-cards" key={i}>
          <LinkCard href={c.url} title={c.title} subtitle={c.subtitle} />
        </div>
      ))}
    </div>
  );
}
