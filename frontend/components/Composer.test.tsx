import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "./Composer";

// jsdom has no mediaDevices; stub it so the dictation mic renders as supported.
beforeEach(() => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn() },
  });
});
afterEach(() => {
  Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("Composer", () => {
  it("morphs the key: call when empty, send when there is text", async () => {
    const onSend = vi.fn();
    const onCall = vi.fn();
    render(<Composer busy={false} onSend={onSend} onCall={onCall} />);
    expect(screen.getByRole("button", { name: "Call the professor" })).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "hello");
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });
  it("sends on Enter and clears", async () => {
    const onSend = vi.fn();
    render(<Composer busy={false} onSend={onSend} />);
    const box = screen.getByRole("textbox");
    await userEvent.type(box, "hi there{Enter}");
    expect(onSend).toHaveBeenCalledWith("hi there");
    expect((box as HTMLTextAreaElement).value).toBe("");
  });
  it("renders an enabled dictation mic", () => {
    render(<Composer busy={false} onSend={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Speak your question" })).toBeEnabled();
  });
});
