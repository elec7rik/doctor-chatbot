import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { VoiceStage } from "./VoiceStage";
import { view } from "@/lib/voiceMachine";

const base = {
  elapsed: 134, cards: [], note: "", hint: "",
  talkRef: createRef<HTMLButtonElement>(), orbRef: createRef<HTMLDivElement>(),
  onClose: vi.fn(), onPointerDown: vi.fn(), onPointerUp: vi.fn(), onPointerCancel: vi.fn(),
};

describe("VoiceStage", () => {
  it("is a modal dialog with a live status and formatted timer", () => {
    render(<VoiceStage {...base} view={view({ phase: "listening", latched: false, note: "", errorText: "" }, false)} />);
    expect(screen.getByRole("dialog", { name: /call with the professor/i })).toBeInTheDocument();
    expect(screen.getByText("02:14")).toBeInTheDocument();
    expect(screen.getByText("Listening…", { selector: ".vs-status" })).toBeInTheDocument();
  });
  it("renders a guardrail voice-note and dropped cards", () => {
    render(
      <VoiceStage
        {...base}
        note="Please call 999 now."
        cards={[{ url: "https://x.co", title: "Peptides 101", subtitle: "My Peptides" }]}
        view={view({ phase: "guardrail", latched: false, note: "", errorText: "" }, false)}
      />,
    );
    expect(screen.getByText("Please call 999 now.")).toBeInTheDocument();
    expect(screen.getByText("Peptides 101")).toBeInTheDocument();
  });
});
