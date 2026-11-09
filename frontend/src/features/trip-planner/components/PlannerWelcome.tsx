import { ArrowRight, MapPin, CloudSun, Route } from "lucide-react";
import { HeroRouteScene } from "../../../components/landing/HeroRouteScene";

export function PlannerWelcome() {
  return (
    <div className="planner-welcome">
      <div className="welcome-copy">
        <p className="landing-eyebrow">
          <span />A CLEARER ROAD AHEAD
        </p>
        <h2>
          Your route.
          <br />
          <em>A clearer forecast.</em>
        </h2>
        <p>
          Compare weather at arrival. Understand the exposure behind every
          route.
        </p>
        <div className="welcome-workflow" aria-label="Planning workflow">
          <span>
            <MapPin size={16} />
            Set your trip
          </span>
          <ArrowRight size={14} />
          <span>
            <CloudSun size={16} />
            Check conditions
          </span>
          <ArrowRight size={14} />
          <span>
            <Route size={16} />
            Compare routes
          </span>
        </div>
      </div>
      <div className="welcome-illustration">
        <HeroRouteScene />
      </div>
      <div className="welcome-caption">
        <span>Weather at arrival</span>
        <p>
          Route recommendations use checkpoint arrival forecasts. Explore the
          separate 0–48 hour forecast once your comparison is ready.
        </p>
      </div>
    </div>
  );
}
