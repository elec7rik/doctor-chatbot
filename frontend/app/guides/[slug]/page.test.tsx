import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Page, { generateStaticParams, generateMetadata } from "./page";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

describe("guide detail route", () => {
  it("generateStaticParams lists all 15 slugs", async () => {
    const params = await generateStaticParams();
    expect(params).toHaveLength(15);
    expect(params).toContainEqual({ slug: "better-sleep" });
  });
  it("generateMetadata returns per-page SEO", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "peptides-101" }) });
    expect(String(meta.title)).toMatch(/Peptides 101/);
    expect(meta.description).toBeTruthy();
  });
  it("renders a known guide", async () => {
    render(await Page({ params: Promise.resolve({ slug: "better-sleep" }) }));
    expect(screen.getByRole("link", { name: /All guides/i })).toBeInTheDocument();
  });
  it("calls notFound on an unknown slug", async () => {
    await expect(Page({ params: Promise.resolve({ slug: "nope" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
