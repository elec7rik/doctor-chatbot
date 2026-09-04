import { z } from "zod";
import { TurnSchema, type Turn } from "./schemas";

const HKEY = "np-history";
const SKEY = "np-session";

export function loadHistory(): Turn[] {
  try {
    const raw = localStorage.getItem(HKEY);
    if (!raw) return [];
    const parsed = z.array(TurnSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function saveHistory(turns: Turn[]): void {
  try {
    localStorage.setItem(HKEY, JSON.stringify(turns.slice(-40)));
  } catch {
    /* ignore */
  }
}

export function loadSession(): string | null {
  try {
    return localStorage.getItem(SKEY);
  } catch {
    return null;
  }
}

export function saveSession(id: string): void {
  try {
    localStorage.setItem(SKEY, id);
  } catch {
    /* ignore */
  }
}

export function clearChat(): void {
  try {
    localStorage.removeItem(HKEY);
    localStorage.removeItem(SKEY);
    localStorage.removeItem(CKEY);
  } catch {
    /* ignore */
  }
}

const RKEY = "np-readaloud";
export function loadReadAloud(): boolean {
  try {
    return localStorage.getItem(RKEY) === "1";
  } catch {
    return false;
  }
}
export function saveReadAloud(on: boolean): void {
  try {
    localStorage.setItem(RKEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export interface CallCard { url: string; title: string; subtitle?: string }
export interface CallReceipt { at: number; mins: number; cards: CallCard[]; ts: number }
const CKEY = "np-receipts";

export function loadReceipts(): CallReceipt[] {
  try {
    const raw = localStorage.getItem(CKEY);
    if (!raw) return [];
    const p: unknown = JSON.parse(raw);
    return Array.isArray(p) ? (p as CallReceipt[]) : [];
  } catch {
    return [];
  }
}
export function saveReceipt(r: CallReceipt): void {
  try {
    const all = loadReceipts();
    all.push(r);
    localStorage.setItem(CKEY, JSON.stringify(all.slice(-20)));
  } catch {
    /* ignore */
  }
}
export function clearReceipts(): void {
  try { localStorage.removeItem(CKEY); } catch { /* ignore */ }
}
/** Null when the call was too short and dropped no cards (spec §6.4). */
export function buildReceipt(atIndex: number, elapsedMs: number, cards: CallCard[]): CallReceipt | null {
  if (elapsedMs < 5000 && cards.length === 0) return null;
  const mins = Math.max(1, Math.round(elapsedMs / 60000));
  return { at: atIndex, mins, cards, ts: Date.now() };
}
