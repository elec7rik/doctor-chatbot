import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadAloudSwitch } from "./ReadAloudSwitch";

describe("ReadAloudSwitch", () => {
  it("reflects checked and fires onChange", async () => {
    const onChange = vi.fn();
    render(<ReadAloudSwitch checked={false} onChange={onChange} />);
    const sw = screen.getByRole("switch", { name: /read answers aloud/i });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalled();
  });
});
