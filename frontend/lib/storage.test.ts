import { describe, it, expect, beforeEach } from "vitest";
import { loadHistory, saveHistory, loadSession, saveSession, clearChat, loadReadAloud, saveReadAloud } from "./storage";

beforeEach(() => localStorage.clear());

describe("storage", () => {
  it("returns [] history when empty or corrupt", () => {
    expect(loadHistory()).toEqual([]);
    localStorage.setItem("np-history", "{not json");
    expect(loadHistory()).toEqual([]);
  });
  it("round-trips and caps history at 40", () => {
    const turns = Array.from({ length: 50 }, (_, i) => ({ role: "user" as const, text: `m${i}` }));
    saveHistory(turns);
    const back = loadHistory();
    expect(back).toHaveLength(40);
    expect(back[0]!.text).toBe("m10");
  });
  it("round-trips session and clears both history and session", () => {
    saveSession("sid-1");
    saveHistory([{ role: "user", text: "hi" }]);
    expect(loadSession()).toBe("sid-1");
    clearChat();
    expect(loadSession()).toBeNull();
    expect(loadHistory()).toEqual([]);
  });
});

describe("read-aloud pref", () => {
  it("defaults off and round-trips", () => {
    expect(loadReadAloud()).toBe(false);
    saveReadAloud(true);
    expect(loadReadAloud()).toBe(true);
    saveReadAloud(false);
    expect(loadReadAloud()).toBe(false);
  });
});
