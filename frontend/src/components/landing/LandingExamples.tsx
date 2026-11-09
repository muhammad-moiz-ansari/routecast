import {
  MapPin,
  Clock3,
  Truck,
  Check,
  Wind,
  Ban,
  CircleHelp,
} from "lucide-react";
import { useState } from "react";
import { HoloCard } from "../ui/HoloCard";

const stepTitles = [
  "Set your trip",
  "See conditions ahead",
  "Compare your options",
];
export function WorkflowPreview({ step }: { step: number }) {
  return (
    <HoloCard className="step-visual">
      <div className="workflow-heading">
        <span className="visual-label">ILLUSTRATIVE WORKFLOW</span>
        <span className="example-badge">0{step + 1} / 03</span>
      </div>
      <div key={step} className="workflow-content">
        <h3>{stepTitles[step]}</h3>
        {step === 0 ? (
          <>
            <div className="example-locations">
              <div>
                <MapPin size={20} />
                <span>
                  <small>FROM</small>
                  <strong>Warehouse A</strong>
                </span>
              </div>
              <span className="example-connector" />
              <div>
                <MapPin size={20} />
                <span>
                  <small>TO</small>
                  <strong>Depot B</strong>
                </span>
              </div>
            </div>
            <div className="example-inputs">
              <div>
                <Clock3 size={18} />
                <span>
                  Departure<strong>10:00 AM</strong>
                </span>
              </div>
              <div>
                <Truck size={18} />
                <span>
                  Cargo load<strong>42,000 lb</strong>
                </span>
              </div>
            </div>
            <p className="example-note">
              Choose exact locations, then set departure time and cargo.
            </p>
          </>
        ) : step === 1 ? (
          <>
            <div
              className="checkpoint-journey"
              aria-label="Example checkpoint arrival forecasts"
            >
              {[
                ["10:00", "18 mph", "Low"],
                ["10:45", "37 mph", "Severe"],
                ["11:30", "18 mph", "Low"],
              ].map(([time, wind, risk], i) => (
                <div key={time}>
                  <span
                    className={`checkpoint-dot ${i === 1 ? "example-severe" : ""}`}
                  >
                    {i + 1}
                  </span>
                  <strong>{time}</strong>
                  <span>
                    <Wind size={14} />
                    {wind}
                  </span>
                  <small>{risk}</small>
                </div>
              ))}
            </div>
            <p className="example-note">
              Forecasts follow checkpoint arrival times. In this example, 37 mph
              wind and 42,000 lb cargo trigger Severe.
            </p>
          </>
        ) : (
          <>
            <div className="example-routes">
              <div>
                <span className="route-letter">A</span>
                <span>
                  <strong>Route A</strong>
                  <small>Excluded by a No Travel segment</small>
                </span>
                <Ban size={19} />
              </div>
              <div className="example-eligible">
                <span className="route-letter">B</span>
                <span>
                  <strong>
                    Route B <span className="example-choice">Eligible</span>
                  </strong>
                  <small>Fully assessed · Compare exposure</small>
                </span>
                <Check size={19} />
              </div>
              <div>
                <span className="route-letter">C</span>
                <span>
                  <strong>Route C</strong>
                  <small>Incomplete forecast coverage</small>
                </span>
                <CircleHelp size={19} />
              </div>
            </div>
            <p className="example-note">
              Eligibility comes first. Compare Severe miles, High miles, average
              risk, then travel time.
            </p>
          </>
        )}
      </div>
      <small className="example-caption">
        Authored example · No live trip or forecast data
      </small>
    </HoloCard>
  );
}

// Authored, geographically fixed examples share one wind scale; these never drive operational risk.
const frames = [
  {
    hour: 0,
    values: [18, 28, 34],
    note: "Winds build toward the destination",
    regions: [
      [100, 145, 170, 100, "#2e9fba"],
      [365, 80, 165, 110, "#dfb45b"],
    ],
  },
  {
    hour: 12,
    values: [24, 39, 46],
    note: "Stronger winds cross the middle and destination",
    regions: [
      [90, 150, 150, 105, "#2e9fba"],
      [260, 105, 140, 95, "#dfb45b"],
      [420, 65, 150, 105, "#e77f52"],
    ],
  },
  {
    hour: 24,
    values: [16, 26, 21],
    note: "Lighter winds return along the route",
    regions: [
      [100, 145, 160, 100, "#2e9fba"],
      [270, 100, 120, 90, "#63b6bb"],
      [425, 65, 140, 105, "#2e9fba"],
    ],
  },
] as const;
export function ForecastPreview() {
  const [selected, setSelected] = useState(0);
  const frame = frames[selected];
  return (
    <HoloCard as="figure" className="forecast-art">
      <div className="forecast-heading">
        <span className="visual-label">ILLUSTRATIVE WIND FIELD</span>
        <span className="example-badge">+{frame.hour}h</span>
      </div>
      <svg
        className="forecast-example-map"
        viewBox="0 0 500 235"
        role="img"
        aria-label={`Hour ${frame.hour} example wind: origin ${frame.values[0]}, midpoint ${frame.values[1]}, destination ${frame.values[2]} mph`}
      >
        <defs>
          <pattern
            id="forecast-grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M32 0H0V32"
              fill="none"
              stroke="currentColor"
              opacity=".08"
            />
          </pattern>
        </defs>
        <rect width="500" height="235" fill="url(#forecast-grid)" />
        {frames.map((f, i) => (
          <g
            key={f.hour}
            className="forecast-example-frame"
            style={{ opacity: selected === i ? 1 : 0 }}
            aria-hidden="true"
          >
            {f.regions.map(([x, y, rx, ry, color], j) => (
              <svg
                key={j}
                x={x - rx}
                y={y - ry}
                width={rx * 2}
                height={ry * 2}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <defs>
                  <radialGradient id={`wind-${i}-${j}`}>
                    <stop stopColor={color} stopOpacity=".72" />
                    <stop offset="1" stopColor={color} stopOpacity="0" />
                  </radialGradient>
                </defs>
                <rect width="100" height="100" fill={`url(#wind-${i}-${j})`} />
              </svg>
            ))}
          </g>
        ))}
        <path
          d="M50 180C145 180 105 70 240 115S350 150 450 55"
          fill="none"
          stroke="var(--surface)"
          strokeWidth="12"
        />
        <path
          d="M50 180C145 180 105 70 240 115S350 150 450 55"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="5"
        />
        {[
          [50, 180, "ORIGIN"],
          [240, 115, "MIDPOINT"],
          [450, 55, "DESTINATION"],
        ].map(([x, y, label], i) => (
          <g key={label} transform={`translate(${x} ${y})`}>
            <circle
              r="6"
              fill="var(--surface)"
              stroke="var(--primary)"
              strokeWidth="3"
            />
            <g transform={`translate(${i === 0 ? 38 : i === 2 ? -38 : 0} -31)`}>
              <rect
                x="-39"
                y="-15"
                width="78"
                height="27"
                rx="8"
                fill="var(--surface)"
                stroke="var(--border)"
              />
              <text
                textAnchor="middle"
                y="3"
                fill="var(--text)"
                fontSize="13"
                fontWeight="600"
              >
                {frame.values[i]} mph
              </text>
            </g>
            <text
              x={i === 0 ? 28 : i === 2 ? -24 : 0}
              y="25"
              textAnchor="middle"
              fill="var(--text)"
              fontSize="10"
              letterSpacing="1"
            >
              {label}
            </text>
          </g>
        ))}
      </svg>
      <div className="forecast-mobile-values" aria-hidden="true">
        {frame.values.map((value, i) => (
          <div key={i}>
            <small>{["Origin", "Midpoint", "Destination"][i]}</small>
            <strong>{value} mph</strong>
          </div>
        ))}
      </div>
      <div
        className="illustration-hours"
        aria-label="Illustrative forecast views"
      >
        {frames.map((f, i) => (
          <button
            key={f.hour}
            type="button"
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
          >
            Hour {f.hour}
          </button>
        ))}
      </div>
      <div className="forecast-narrative" aria-live="polite">
        <strong>Hour {frame.hour}</strong>
        <span>{frame.note}</span>
      </div>
      <div className="illustrative-legend">
        <i />
        <span>Wind · Fixed scale: 0 → 55+ mph</span>
      </div>
      <figcaption>Authored forecast example · Not live weather</figcaption>
    </HoloCard>
  );
}
