/** The iris ramp — the one accent. Mirrors design/preview.html :root. */
export const IRIS = {
  50: "#F1F0FE",
  100: "#E5E2FC",
  200: "#D0CAF8",
  300: "#B3A9F5",
  400: "#8A5CF0",
  500: "#6D5DE8",
  600: "#5B4BD6",
  700: "#4B3AC9",
  800: "#38299B",
} as const;

export type IrisStop = keyof typeof IRIS;
