import { describe, it, expect, beforeEach } from "vitest";
import { resolveInitialTheme, applyTheme, getStoredTheme } from "./theme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("theme", () => {
  it("defaults to light when nothing is stored", () => {
    expect(resolveInitialTheme()).toBe("light");
  });
  it("honours a stored dark choice", () => {
    localStorage.setItem("np-theme", "dark");
    expect(resolveInitialTheme()).toBe("dark");
  });
  it("applyTheme sets the attribute and persists", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(getStoredTheme()).toBe("dark");
  });
});
