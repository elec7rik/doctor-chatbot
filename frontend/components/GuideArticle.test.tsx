import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GuideArticle } from "./GuideArticle";
import { getGuide } from "@/lib/guides";

describe("GuideArticle", () => {
  const guide = getGuide("peptides-101")!;
  it("renders the article fragment inside an Iris .guide wrapper", () => {
    const { container } = render(<GuideArticle guide={guide} />);
    expect(container.querySelector(".guide")).toBeTruthy();
    expect(container.querySelector("article.guide-body")).toBeTruthy();
    expect(screen.getByText(/Research Peptides 101/)).toBeInTheDocument();
  });
  it("offers a way back to chat and to the index", () => {
    render(<GuideArticle guide={guide} />);
    expect(screen.getByRole("link", { name: /Ask the professor/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /All guides/i })).toHaveAttribute("href", "/guides");
  });
  it("injects the JSON-LD structured data", () => {
    const { container } = render(<GuideArticle guide={guide} />);
    const ld = container.querySelector('script[type="application/ld+json"]');
    expect(ld?.textContent).toContain("Article");
  });
});
