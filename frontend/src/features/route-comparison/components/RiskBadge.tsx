import type { RiskCategory } from "../../../api/contracts";
import { riskLabels, riskSymbols } from "../presentation";
import { riskPalette } from "../riskPalette";
import type { CSSProperties } from "react";
export function RiskBadge({ category }: { category: RiskCategory }) {
  return (
    <span
      className={`risk-badge risk-${category}`}
      style={
        {
          "--risk-fg": riskPalette[category].day[0],
          "--risk-bg": riskPalette[category].day[1],
          "--risk-night-fg": riskPalette[category].night[0],
          "--risk-night-bg": riskPalette[category].night[1],
        } as CSSProperties
      }
    >
      <span aria-hidden="true">{riskSymbols[category]}</span>
      {riskLabels[category]}
    </span>
  );
}
