import { describe, it, expect } from "vitest";
import { LiveMessageSchema } from "./schemas";

describe("LiveMessageSchema", () => {
  it("accepts a card with a brand", () => {
    const r = LiveMessageSchema.safeParse({ type: "card", url: "https://x.co", title: "T", subtitle: "S", brand: "my-peptides" });
    expect(r.success).toBe(true);
  });
  it("accepts user and bot transcription frames", () => {
    expect(LiveMessageSchema.safeParse({ type: "user", text: "hi" }).success).toBe(true);
    expect(LiveMessageSchema.safeParse({ type: "bot", text: "hello" }).success).toBe(true);
  });
  it("accepts info and error", () => {
    expect(LiveMessageSchema.safeParse({ type: "info", text: "call-time-limit" }).success).toBe(true);
    expect(LiveMessageSchema.safeParse({ type: "error", text: "rate_limited" }).success).toBe(true);
  });
  it("rejects an unknown type and a card missing url", () => {
    expect(LiveMessageSchema.safeParse({ type: "nope" }).success).toBe(false);
    expect(LiveMessageSchema.safeParse({ type: "card", title: "T" }).success).toBe(false);
  });
});
