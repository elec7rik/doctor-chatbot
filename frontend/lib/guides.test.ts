import { describe, it, expect } from "vitest";
import { allGuides, allGuideSlugs, getGuide } from "./guides";

describe("guides API", () => {
  it("exposes all 15 guides", () => {
    expect(allGuides()).toHaveLength(15);
    expect(allGuideSlugs()).toContain("peptides-101");
    expect(allGuideSlugs()).toContain("weight-loss"); // was missing from ChatShell's old map
  });
  it("getGuide returns a doc with html + seo meta", () => {
    const g = getGuide("peptides-101");
    expect(g?.html).toContain("Research Peptides 101");
    expect(g?.html).toContain("my-peptides.co.uk"); // funnel CTA preserved
    expect(g?.meta.description.length).toBeGreaterThan(0);
  });
  it("getGuide is undefined for an unknown slug", () => {
    expect(getGuide("not-a-guide")).toBeUndefined();
  });
});
