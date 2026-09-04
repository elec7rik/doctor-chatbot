import { describe, it, expect } from "vitest";
import { guideTitle } from "@/content/guides/catalog";

// Guards the DRY fix: every slug the backend can emit now resolves to a card title.
describe("guide card titles", () => {
  it("resolves slugs that the old 7-entry map dropped", () => {
    for (const slug of ["weight-loss", "immunity", "gut-health", "longevity-basics",
                         "muscle-growth", "injury-recovery", "stress-focus", "what-supplements-to-take"]) {
      expect(guideTitle(slug)).toBeTruthy();
    }
  });
});
