import { describe, it, expect } from "vitest";
import { renderMarkdown, stripGuideTokens, extractGuideSlugs } from "./markdown";

describe("markdown", () => {
  it("escapes HTML in user input", () => {
    expect(renderMarkdown("<script>alert(1)</script>")).not.toContain("<script>");
    expect(renderMarkdown("<b>x</b>")).toContain("&lt;b&gt;");
  });
  it("renders bold, code and headings", () => {
    expect(renderMarkdown("**hi**")).toContain("<strong>hi</strong>");
    expect(renderMarkdown("`x`")).toContain("<code>x</code>");
    expect(renderMarkdown("# Head")).toContain("<h3>Head</h3>");
  });
  it("renders a tier badge", () => {
    expect(renderMarkdown("*Promising*")).toContain('class="tier"');
  });
  it("autolinks brand domains once", () => {
    const html = renderMarkdown("try my-peptides.co.uk today");
    expect(html).toContain('href="https://my-peptides.co.uk"');
  });
  it("renders bullet lists", () => {
    expect(renderMarkdown("- one\n- two")).toContain("<ul><li>one</li><li>two</li></ul>");
  });
  it("strips and extracts guide tokens", () => {
    expect(stripGuideTokens("hi [[guide:better-sleep]]")).toBe("hi");
    expect(extractGuideSlugs("a [[guide:hair-loss]] b [[guide:hair-loss]]")).toEqual(["hair-loss"]);
  });
});
