import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Minimal hook mocks so ChatShell renders a fixed thread.
vi.mock("@/lib/useChat", () => ({
  useChat: () => ({
    messages: [
      { role: "user", html: "do supplements work?", guideSlugs: [] },
      { role: "bot", html: "<p>Some supplements have strong evidence.</p>", guideSlugs: ["what-supplements-to-take"] },
      { role: "user", html: "how can i lose 3 lbs in a month", guideSlugs: [] },
      { role: "bot", html: "<p>Losing 3 lbs is achievable.</p>", guideSlugs: ["weight-loss"] },
    ],
    busy: false, started: true, send: vi.fn(), newChat: vi.fn(),
  }),
}));
vi.mock("@/lib/useReadAloud", () => ({
  useReadAloud: () => ({ on: false, toggle: vi.fn(), speakReply: vi.fn(), stop: vi.fn() }),
}));
vi.mock("@/lib/useVoiceCall", () => ({
  useVoiceCall: () => ({
    active: false, view: {}, elapsed: 0, cards: [], note: "", hint: "",
    startCall: vi.fn(), endCall: vi.fn(), talkRef: { current: null }, orbRef: { current: null },
    onPointerDown: vi.fn(), onPointerUp: vi.fn(), onPointerCancel: vi.fn(),
  }),
}));
vi.mock("@/lib/storage", () => ({ loadReceipts: () => [] }));

import { ChatShell } from "./ChatShell";

describe("ChatShell guide-card anchoring", () => {
  it("renders each guide card directly after the message that produced it", () => {
    render(<ChatShell />);
    const supplementsCard = screen.getByRole("link", { name: /What Supplements Should You Actually Take/i });
    const laterUserMsg = screen.getByText(/how can i lose 3 lbs/i);
    // The supplements card must come BEFORE the next (weight-loss) question — not piled at the bottom.
    const rel = supplementsCard.compareDocumentPosition(laterUserMsg);
    expect(rel & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
