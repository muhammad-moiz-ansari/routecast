from math import isclose

from common.enums import RiskCategory as R
from common.units import meters_to_miles
from config.risk_rules import BOUNDS, LOAD_NO_TRAVEL_LB, LOAD_SEVERE_LB, ORDER

from .models import CheckpointRisk, IntervalRisk, RiskReason, RiskRequest, RouteRiskSummary
from .risk_repo import RiskRepo


def category_for(variable, value):
    """Use continuous boundaries; rain/snow exact upper limits remain Severe."""
    a, b, c, d = BOUNDS[variable]
    if value < a:
        return R.LOW, f"< {a}"
    if value < b:
        return R.MODERATE, f">= {a} and < {b}"
    if value < c:
        return R.HIGH, f">= {b} and < {c}"
    # Wind >=55 is blocked, but rain >1 and snow >3 are strictly greater.
    if value < d or (variable != "wind_mph" and value == d):
        return R.SEVERE, f">= {c} and {'<' if variable == 'wind_mph' else '<='} {d}"
    return R.NO_TRAVEL, f"{' >' if variable != 'wind_mph' else '>='} {d}"


def worst(categories):
    known = [c for c in categories if c != R.UNKNOWN]
    hazard = max(known, key=ORDER.index) if known else R.LOW
    return R.UNKNOWN if hazard == R.LOW and R.UNKNOWN in categories else hazard


class RiskService(RiskRepo):
    def assess(self, request: RiskRequest) -> RouteRiskSummary:
        """Preserve known hazards, exclude incomplete/stale routes, and reconcile actual miles."""
        weather = {(w.route_id, w.checkpoint_id): w for w in request.weather}
        risks = []
        for cp in request.route.checkpoints:
            w = weather.get((request.route.route_id, cp.id))
            if w is not None and w.arrival_at != cp.arrival_at:
                w = None
            values = {name: getattr(w, name, None) for name in BOUNDS}
            complete = bool(
                w
                and w.coverage == "complete"
                and w.arrival_at == cp.arrival_at
                and all(v is not None for v in values.values())
            )
            reasons = []
            categories = []
            for name, value in values.items():
                if value is None:
                    continue
                category, threshold = category_for(name, value)
                categories.append(category)
                reasons.append(
                    RiskReason(
                        code=f"{name}_{category.value}",
                        observed_value=value,
                        threshold=threshold,
                        units="mph" if name == "wind_mph" else "in/hour",
                        message=f"{name} {value} meets {threshold}: {category.value}.",
                    )
                )
            wind = values["wind_mph"]
            override = None
            if wind is not None:
                # Cargo comparisons are strictly greater: exact 30k/40k do not qualify.
                if 45 <= wind < 55 and request.cargo_load_lb > LOAD_NO_TRAVEL_LB:
                    override = (
                        R.NO_TRAVEL,
                        "wind_load_no_travel",
                        "45 <= wind < 55; cargo > 30000",
                    )
                elif 35 <= wind < 45 and request.cargo_load_lb > LOAD_SEVERE_LB:
                    override = (R.SEVERE, "wind_load_severe", "35 <= wind < 45; cargo > 40000")
            if override:
                category, code, threshold = override
                categories.append(category)
                reasons.append(
                    RiskReason(
                        code=code,
                        observed_value=wind,
                        units="mph",
                        cargo_load_lb=request.cargo_load_lb,
                        threshold=threshold,
                        message=f"Cargo load override: {threshold} -> {category.value}.",
                    )
                )
            if not complete:
                categories.append(R.UNKNOWN)
            risks.append(
                CheckpointRisk(
                    checkpoint_id=cp.id,
                    category=worst(categories),
                    coverage_complete=complete,
                    fresh=bool(w and w.freshness == "fresh"),
                    reasons=reasons,
                )
            )
        by_id = {c.checkpoint_id: c for c in risks}
        intervals = []
        miles = {c: 0.0 for c in R}
        unassessed = 0.0
        for interval in request.route.intervals:
            left, right = by_id[interval.start_checkpoint_id], by_id[interval.end_checkpoint_id]
            # Worst endpoint is a conservative sampled interval estimate, not continuous proof.
            category = worst([left.category, right.category])
            complete = left.coverage_complete and right.coverage_complete
            distance = interval.distance_miles
            miles[category] += distance
            if not complete:
                unassessed += distance
            intervals.append(
                IntervalRisk(
                    start_checkpoint_id=left.checkpoint_id,
                    end_checkpoint_id=right.checkpoint_id,
                    distance_miles=distance,
                    category=category,
                    coverage_complete=complete,
                )
            )
        total = meters_to_miles(request.route.route_distance_meters)
        if not isclose(sum(miles.values()), total, rel_tol=1e-9, abs_tol=1e-8):
            raise ValueError("Interval mileage does not reconcile with route distance")
        reasons = []
        if not risks or not all(c.coverage_complete for c in risks):
            reasons.append("incomplete_forecast")
        if not risks or not all(c.fresh for c in risks):
            reasons.append("stale_or_missing_forecast")
        if any(c.category == R.NO_TRAVEL for c in risks):
            reasons.append("no_travel")
        average = None
        if not reasons:
            average = sum(miles[c] * i for i, c in enumerate(ORDER[:4])) / total
        return RouteRiskSummary(
            route_id=request.route.route_id,
            analysis_version=request.route.analysis_version,
            duration_seconds=request.duration_seconds,
            total_miles=total,
            checkpoints=risks,
            intervals=intervals,
            miles_by_category=miles,
            unassessed_miles=unassessed,
            average_risk=average,
            eligible=not reasons,
            eligibility_reasons=reasons,
        )
