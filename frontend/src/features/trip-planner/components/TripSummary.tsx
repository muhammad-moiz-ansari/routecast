import { MapPin, Pencil, Truck, Clock3 } from "lucide-react";
import type { PlannerValues } from "../schemas";
export function TripSummary({
  values,
  onEdit,
}: {
  values: PlannerValues;
  onEdit: () => void;
}) {
  return (
    <div className="trip-summary">
      <div className="summary-top">
        <span className="eyebrow">YOUR TRIP</span>
        <button onClick={onEdit}>
          <Pencil size={14} />
          Edit trip
        </button>
      </div>
      <h2 id="planner-title">Your route comparison</h2>
      <div className="summary-journey">
        <MapPin size={18} />
        <strong>{values.origin?.label ?? "Loading origin…"}</strong>
        <span>↓</span>
        <MapPin size={18} />
        <strong>{values.destination?.label ?? "Loading destination…"}</strong>
      </div>
      <details className="trip-input-details">
        <summary>Departure, cargo & spacing</summary>
        <p>
          <Clock3 size={14} />
          {values.departure.replace("T", " · ") || "Departure loading"}
        </p>
        <p>{values.timezone}</p>
        <p>
          <Truck size={14} />
          {values.cargo || "—"} lb cargo · {values.spacing} mi spacing
        </p>
      </details>
    </div>
  );
}
