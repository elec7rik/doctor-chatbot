export type Theme = "light" | "dark";
const KEY = "np-theme";

export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

export function resolveInitialTheme(): Theme {
  return getStoredTheme() ?? "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
}

/** Runs before paint in <head> to avoid a flash; default light. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("np-theme");document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"light");}catch(e){document.documentElement.setAttribute("data-theme","light");}`;
