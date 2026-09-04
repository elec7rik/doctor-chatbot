import { describe, it, expect, beforeEach } from "vitest";
import { loadHistory, saveHistory, loadSession, saveSession, clearChat, loadReadAloud, saveReadAloud, loadReceipts, saveReceipt, buildReceipt, clearReceipts } from "./storage";

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
  it("round-trips session and clears both plus receipts", () => {
    saveSession("sid-1");
    saveHistory([{ role: "user", text: "hi" }]);
    saveReceipt({ at: 0, mins: 1, cards: [], ts: 1 });
    expect(loadSession()).toBe("sid-1");
    clearChat();
    expect(loadSession()).toBeNull();
    expect(loadHistory()).toEqual([]);
    expect(loadReceipts()).toEqual([]);
  });
});

describe("call receipts", () => {
  it("buildReceipt returns null under 5s with no cards, else N min", () => {
    expect(buildReceipt(0, 3000, [])).toBeNull();
    expect(buildReceipt(2, 120000, [])).toMatchObject({ at: 2, mins: 2 });
    expect(buildReceipt(0, 1000, [{ url: "u", title: "t" }])).toMatchObject({ mins: 1 });
  });
  it("saveReceipt round-trips and clearReceipts empties", () => {
    saveReceipt({ at: 1, mins: 2, cards: [], ts: 1 });
    expect(loadReceipts()).toHaveLength(1);
    clearReceipts();
    expect(loadReceipts()).toEqual([]);
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
