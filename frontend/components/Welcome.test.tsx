import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Welcome } from "./Welcome";

describe("Welcome", () => {
  it("fires onChip with the chip text", async () => {
    const onChip = vi.fn();
    render(<Welcome onChip={onChip} />);
    await userEvent.click(screen.getByRole("button", { name: "Does NMN actually work?" }));
    expect(onChip).toHaveBeenCalledWith("Does NMN actually work?");
  });
});
