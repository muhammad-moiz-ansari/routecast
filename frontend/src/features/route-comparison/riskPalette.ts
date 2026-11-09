// One categorical palette for badges, mileage, map markers and the existing corridor renderer.
export const riskPalette = {
  low: {
    color: "#166534",
    day: ["#166534", "#ecfdf3"],
    night: ["#86efac", "#123323"],
  },
  moderate: {
    color: "#854d0e",
    day: ["#854d0e", "#fef9c3"],
    night: ["#fde68a", "#3d3318"],
  },
  high: {
    color: "#9a3412",
    day: ["#9a3412", "#fff0e5"],
    night: ["#fdba74", "#452a1a"],
  },
  severe: {
    color: "#b91c1c",
    day: ["#b91c1c", "#fef2f2"],
    night: ["#fca5a5", "#452125"],
  },
  no_travel: {
    color: "#6b21a8",
    day: ["#6b21a8", "#f3e8ff"],
    night: ["#e9d5ff", "#342142"],
  },
  unknown: {
    color: "#475569",
    day: ["#475569", "#eef2f6"],
    night: ["#cbd5e1", "#243346"],
  },
} as const;
export const riskColors = Object.fromEntries(
  Object.entries(riskPalette).map(([key, value]) => [key, value.color]),
) as Record<keyof typeof riskPalette, string>;
