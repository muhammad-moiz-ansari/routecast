from common.enums import RiskCategory as R
from services.checkpoint.models import CheckpointRequest
from services.risk.models import RiskRequest, RouteRiskSummary
from services.trip.models import TripResponse
from services.weather.models import ForecastRequest

from .models import RecommendationExplanation, RecommendationResult
from .recommendation_repo import RecommendationRepo


class RecommendationService(RecommendationRepo):
    def __init__(self, checkpoint, weather, risk):
        self.checkpoint, self.weather, self.risk = checkpoint, weather, risk

    def recommend(self, trip: TripResponse) -> RecommendationResult:
        """Compute a read-only projection; selection and stored snapshots remain unchanged."""
        if trip.route_options is None:
            pending = trip.status == "routing"
            return RecommendationResult(
                state="PENDING" if pending else "NO_ELIGIBLE_ROUTE",
                analysis_version=trip.analysis_version,
                explanation=RecommendationExplanation(
                    code="routes_pending" if pending else "routes_unavailable",
                    message="Route options are pending."
                    if pending
                    else "No route options are available.",
                ),
            )
        checkpoints = [
            self.checkpoint.generate(
                CheckpointRequest(
                    route=r,
                    departure_at=trip.departure_at,
                    spacing_miles=trip.checkpoint_spacing_miles,
                    analysis_version=trip.route_options.analysis_version,
                )
            )
            for r in trip.route_options.routes
        ]
        weather = self.weather.assess(ForecastRequest(routes=checkpoints), fetch=False)
        summaries = []
        for route, cp in zip(trip.route_options.routes, checkpoints):
            matching = (
                weather.checkpoints
                if weather.analysis_versions.get(route.id) == cp.analysis_version
                else []
            )
            summaries.append(
                self.risk.assess(
                    RiskRequest(
                        route=cp,
                        weather=matching,
                        cargo_load_lb=trip.cargo_load_lb,
                        duration_seconds=route.duration_seconds,
                    )
                )
            )
        return self.rank(summaries, trip.route_options.analysis_version)

    def rank(self, routes: list[RouteRiskSummary], analysis_version: int) -> RecommendationResult:
        """Rank unrounded metrics: Severe miles, High miles, average, duration, stable ID."""
        if any(r.analysis_version != analysis_version for r in routes):
            raise ValueError("Analysis versions must agree")

        def key(r):
            return (
                r.miles_by_category[R.SEVERE],
                r.miles_by_category[R.HIGH],
                r.average_risk,
                r.duration_seconds,
                r.route_id,
            )

        eligible = sorted([r for r in routes if r.eligible and r.average_risk is not None], key=key)
        notices = []
        if any(
            "incomplete_forecast" in r.eligibility_reasons
            or "stale_or_missing_forecast" in r.eligibility_reasons
            for r in routes
        ):
            notices.append(
                "Some alternatives are unassessed or stale; "
                "comparison covers fully assessed eligible routes only."
            )
        if not eligible:
            blocked = bool(routes) and all("no_travel" in r.eligibility_reasons for r in routes)
            state = "NO_ELIGIBLE_ROUTE" if blocked or not routes else "INCOMPLETE_DATA"
            explanation = RecommendationExplanation(
                code="all_routes_blocked" if blocked else "no_eligible_route",
                message="No route is recommended under the current conditions.",
            )
            return RecommendationResult(
                state=state,
                analysis_version=analysis_version,
                routes=routes,
                explanation=explanation,
                notices=notices,
            )
        code = "only_eligible_route"
        message = "Only one route is fully assessed and eligible under the supplied rules."
        if len(eligible) > 1:
            labels = [
                ("fewer_severe_miles", "fewer Severe miles"),
                ("fewer_high_miles", "fewer High miles"),
                ("lower_average_risk", "lower distance-weighted average risk"),
                ("shorter_travel_time", "shorter estimated travel time"),
                ("stable_route_id", "the stable route identifier tie-break"),
            ]
            for a, b, (metric, wording) in zip(key(eligible[0]), key(eligible[1]), labels):
                if a != b:
                    code, message = (
                        metric,
                        f"Preferred over route {eligible[1].route_id} by {wording}.",
                    )
                    break
        return RecommendationResult(
            state="RECOMMENDED",
            analysis_version=analysis_version,
            recommended_route_id=eligible[0].route_id,
            ranked_route_ids=[r.route_id for r in eligible],
            routes=routes,
            explanation=RecommendationExplanation(code=code, message=message),
            notices=notices,
        )
