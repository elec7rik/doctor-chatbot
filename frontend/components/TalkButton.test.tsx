import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { TalkButton } from "./TalkButton";
import { view } from "@/lib/voiceMachine";

const props = (v: ReturnType<typeof view>) => ({
  view: v, talkRef: createRef<HTMLButtonElement>(),
  onPointerDown: vi.fn(), onPointerUp: vi.fn(), onPointerCancel: vi.fn(),
});

describe("TalkButton", () => {
  it("shows the phase label and disables when the view says so", () => {
    render(<TalkButton {...props(view({ phase: "connecting", latched: false, note: "", errorText: "" }, false))} />);
    expect(screen.getByRole("button", { name: "Tap to talk" })).toBeDisabled();
  });
  it("is absent when the view hides the button", () => {
    render(<TalkButton {...props(view({ phase: "ended", latched: false, note: "", errorText: "" }, false))} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
