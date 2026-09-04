import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Page from "./page";

describe("guides index", () => {
  it("links to all 15 guides", () => {
    render(<Page />);
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/guides/"));
    expect(links).toHaveLength(15);
    expect(screen.getByRole("link", { name: /Sleep Better/i })).toHaveAttribute("href", "/guides/better-sleep");
  });
});
