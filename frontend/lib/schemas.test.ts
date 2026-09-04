import { describe, it, expect } from "vitest";
import { TurnSchema, ChatRequestSchema, LiveMessageSchema } from "./schemas";

describe("schemas", () => {
  it("accepts a valid turn and rejects a bad role", () => {
    expect(TurnSchema.safeParse({ role: "user", text: "hi" }).success).toBe(true);
    expect(TurnSchema.safeParse({ role: "bot", text: "hi" }).success).toBe(false);
  });
  it("requires a non-empty message in ChatRequest", () => {
    expect(ChatRequestSchema.safeParse({ message: "" }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ message: "ok", history: [{ role: "model", text: "y" }] }).success).toBe(true);
  });
  it("parses a card live-message", () => {
    const m = LiveMessageSchema.safeParse({ type: "card", url: "/guides/x", title: "X" });
    expect(m.success).toBe(true);
  });
});
