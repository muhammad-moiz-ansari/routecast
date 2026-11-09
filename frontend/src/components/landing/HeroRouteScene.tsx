import { useEffect, useRef, useState } from "react";
import { MapPin, Pause, Play, CloudSun, Truck } from "lucide-react";
import "../../styles/landing.css";
export function HeroRouteScene({
  defaultPaused = false,
}: {
  defaultPaused?: boolean;
}) {
  const host = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(defaultPaused);
  const [active, setActive] = useState(true);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    // One playing state pauses CSS motion without a React update on every frame.
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) =>
      setActive(entry.isIntersecting && !document.hidden),
    );
    observer?.observe(host.current!);
    const visibility = () =>
      setActive(
        !document.hidden &&
          !!host.current &&
          host.current.getBoundingClientRect().bottom > 0 &&
          host.current.getBoundingClientRect().top < innerHeight,
      );
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer?.disconnect();
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <figure
      ref={host}
      className={`hero-scene ${paused || !active || reduced ? "scene-paused" : ""}`}
      aria-label="Schematic illustration of three routes through forecast conditions"
    >
      <div className="scene-top">
        <span>
          <MapPin size={14} /> ROUTE STUDY / 01
        </span>
        <button
          aria-label={paused ? "Resume illustration" : "Pause illustration"}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
      </div>
      <svg
        viewBox="0 0 640 480"
        role="img"
        aria-label="Blue route B crosses illustrated weather bands; alternatives A and C remain visible"
      >
        <defs>
          <pattern
            id="grid"
            width="36"
            height="36"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M36 0H0V36"
              fill="none"
              stroke="currentColor"
              opacity=".08"
            />
          </pattern>
          <radialGradient id="weather-blue">
            <stop stopColor="#38bdf8" stopOpacity=".65" />
            <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="weather-warm">
            <stop stopColor="#edb659" stopOpacity=".55" />
            <stop offset="1" stopColor="#edb659" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="640" height="480" fill="url(#grid)" />
        <g
          className="scene-roads"
          fill="none"
          stroke="currentColor"
          opacity=".12"
          strokeWidth="3"
        >
          <path d="M-20 170Q220 50 640 210M30 420Q270 170 650 290M140 -30L330 510M420 -20L490 490" />
          <path
            d="M-40 330Q150 180 220 340T680 380"
            strokeWidth="16"
            stroke="#38bdf8"
          />
        </g>
        <g className="weather-float">
          <ellipse
            cx="290"
            cy="220"
            rx="240"
            ry="170"
            fill="url(#weather-blue)"
          />
          <ellipse
            cx="490"
            cy="140"
            rx="150"
            ry="150"
            fill="url(#weather-warm)"
          />
        </g>
        <g fill="none" strokeLinecap="round">
          <path
            d="M95 390Q110 80 540 80"
            stroke="var(--control-border)"
            strokeWidth="3"
            strokeDasharray="7 9"
          />
          <path
            d="M95 390Q450 420 540 80"
            stroke="var(--teal)"
            strokeWidth="3"
          />
          <path
            d="M95 390C230 375 160 200 330 235S450 140 540 80"
            stroke="var(--surface)"
            strokeWidth="15"
          />
          <path
            className="hero-route"
            d="M95 390C230 375 160 200 330 235S450 140 540 80"
            stroke="var(--primary)"
            strokeWidth="7"
          />
        </g>
        {[
          [95, 390],
          [240, 254],
          [392, 230],
          [540, 80],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r="10"
              fill="var(--surface)"
              stroke="var(--primary)"
              strokeWidth="4"
            />
          </g>
        ))}
        <g fill="var(--text-muted)" fontFamily="Arial" fontSize="14">
          <text x="125" y="120">
            A
          </text>
          <text x="350" y="213" fill="var(--primary)" fontWeight="bold">
            B
          </text>
          <text x="458" y="350">
            C
          </text>
          <text x="40" y="442">
            DEPARTURE
          </text>
          <text x="500" y="50">
            DESTINATION
          </text>
        </g>
        <g className="moving-truck">
          <rect
            x="-17"
            y="-13"
            width="34"
            height="26"
            rx="8"
            fill="var(--primary)"
          />
          <path d="M-7 -5L7 0L-7 5Z" fill="var(--on-primary)" />
        </g>
      </svg>
      <div className="scene-summary">
        <CloudSun size={32} />
        <div>
          <strong>Weather at arrival</strong>
          <span>Forecasts matched to checkpoint ETAs</span>
        </div>
      </div>
      <figcaption>
        Illustrative route preview · no live vehicle tracking
      </figcaption>
    </figure>
  );
}
