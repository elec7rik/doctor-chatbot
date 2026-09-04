import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatShell } from "./ChatShell";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});
beforeEach(() => localStorage.clear());

function streamResponse(text: string) {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(text));
        c.close();
      },
    }),
    { status: 200, headers: { "X-Session-Id": "s1" } },
  );
}

describe("ChatShell", () => {
  it("shows the welcome empty state, then a sent message and streamed reply", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(streamResponse("**Hi** there."));
    render(<ChatShell />);
    expect(screen.getByText(/living longer/i)).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("hello")).toBeInTheDocument();
    expect(await screen.findByText("Hi")).toBeInTheDocument();
    expect(screen.queryByText(/living longer/i)).not.toBeInTheDocument();
  });
});
