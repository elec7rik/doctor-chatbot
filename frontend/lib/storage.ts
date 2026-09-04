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
