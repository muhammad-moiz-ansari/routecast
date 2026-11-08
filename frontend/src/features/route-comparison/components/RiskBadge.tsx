import type { RiskCategory } from "../../../api/contracts";
import { riskLabels, riskSymbols } from "../presentation";
export function RiskBadge({ category }: { category: RiskCategory }) {
  return (
    <span className={`risk-badge risk-${category}`}>
      <span aria-hidden="true">{riskSymbols[category]}</span>
      {riskLabels[category]}
    </span>
  );
}
