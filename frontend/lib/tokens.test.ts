import { describe, it, expect } from "vitest";
import { IRIS } from "./tokens";

describe("IRIS ramp", () => {
  it("exposes the sanctioned accent stops as hex", () => {
    expect(IRIS[600]).toBe("#5B4BD6");
    expect(IRIS[400]).toBe("#8A5CF0");
    expect(Object.keys(IRIS)).toHaveLength(9);
  });
});
