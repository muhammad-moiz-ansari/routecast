import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Route,
  ArrowUpRight,
  Menu,
  X,
  Pause,
  Play,
  CloudSun,
  Truck,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import "../styles/landing.css";
import { HoloCard } from "../components/ui/HoloCard";
import { AnimatedDisclosure } from "../components/ui/AnimatedDisclosure";
import {
  WorkflowPreview,
  ForecastPreview,
} from "../components/landing/LandingExamples";
function RouteScene() {
  const host = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const [active, setActive] = useState(true);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    // One playing state pauses CSS motion without a React update on every frame.
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    const observer = new IntersectionObserver(([entry]) =>
      setActive(entry.isIntersecting && !document.hidden),
    );
    observer.observe(host.current!);
    const visibility = () =>
      setActive(
        !document.hidden &&
          !!host.current &&
          host.current.getBoundingClientRect().bottom > 0 &&
          host.current.getBoundingClientRect().top < innerHeight,
      );
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
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
const steps = [
  ["Set your trip", "Choose your locations, departure and cargo load."],
  [
    "See conditions ahead",
    "Check forecasts at estimated checkpoint arrival times.",
  ],
  [
    "Compare your options",
    "Understand the exposure behind each eligible route.",
  ],
];
const questions = [
  [
    "Does RouteCast always return three routes?",
    "Up to three distinct routes are requested. Provider coverage and available alternatives determine how many are returned.",
  ],
  [
    "Is forecast time the same as arrival time?",
    "No. Route assessment uses checkpoint arrival forecasts. The corridor timeline explores weather at a selected hour without changing the recommendation.",
  ],
  [
    "How does cargo load affect risk?",
    "The supplied rules apply strict load overrides to wind conditions. Cargo pounds are separate from gross vehicle weight or truck dimensions.",
  ],
  [
    "What if a forecast is missing?",
    "Missing or stale data is disclosed. It cannot establish Low risk or current eligibility; known hazards remain visible.",
  ],
  [
    "Is this live vehicle tracking?",
    "No. RouteCast plans trips and estimates arrivals. The moving marker above is an illustration, not GPS tracking.",
  ],
];
export function LandingPage() {
  const [menu, setMenu] = useState(false);
  const [step, setStep] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const content = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const animations: Animation[] = [];
    // Content is visible by default; reveal only once and cancel on preference changes.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          if (!media.matches)
            animations.push(
              entry.target.animate(
                [
                  { opacity: 0.65, transform: "translateY(12px)" },
                  { opacity: 1, transform: "translateY(0)" },
                ],
                { duration: 420, easing: "ease-out" },
              ),
            );
        }
      },
      { threshold: 0.1 },
    );
    content.current
      ?.querySelectorAll(".landing-section")
      .forEach((section) => observer.observe(section));
    const stop = () => {
      if (media.matches) animations.forEach((animation) => animation.cancel());
    };
    media.addEventListener("change", stop);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", stop);
      animations.forEach((animation) => animation.cancel());
    };
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        trigger.current?.focus();
      }
    };
    if (menu) {
      navigation.current?.querySelector("a")?.focus();
      document.addEventListener("keydown", close);
    }
    return () => document.removeEventListener("keydown", close);
  }, [menu]);
  return (
    <div className="landing">
      <a className="skip" href="#landing-main">
        Skip to content
      </a>
      <header className="site-header">
        <Link to="/" className="site-brand">
          <Route aria-hidden="true" />
          RouteCast
          <span className="brand-dot" />
        </Link>
        <nav
          id="site-navigation"
          ref={navigation}
          aria-label="Main navigation"
          className={menu ? "site-nav open" : "site-nav"}
        >
          <a href="#how-it-works" onClick={() => setMenu(false)}>
            How it works
          </a>
          <a href="#weather-insight" onClick={() => setMenu(false)}>
            Weather insight
          </a>
          <a href="#methodology" onClick={() => setMenu(false)}>
            Methodology
          </a>
          <Link
            to="/plan"
            className="mobile-plan"
            onClick={() => setMenu(false)}
          >
            Plan a route →
          </Link>
        </nav>
        <div className="site-actions">
          <ThemeToggle />
          <Link to="/plan" className="landing-button header-plan">
            Plan a route <ArrowUpRight size={18} />
          </Link>
          <button
            className="menu-button"
            ref={trigger}
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-controls="site-navigation"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="landing-main" ref={content}>
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="landing-eyebrow">
              <span /> WEATHER-AWARE TRUCK ROUTING
            </p>
            <h1>
              Know the weather.
              <br />
              <em>Choose your route.</em>
            </h1>
            <p className="hero-description">
              Compare truck routes using forecast conditions at your estimated
              arrival times, cargo load and travel time.
            </p>
            <div className="hero-actions">
              <Link to="/plan" className="landing-button">
                Plan a route <ArrowUpRight size={20} />
              </Link>
              <a href="#how-it-works" className="text-link">
                See how it works <ArrowRight size={17} />
              </a>
            </div>
            <p className="hero-fact">
              10 / 25 / 50 mile checkpoints
              <br />
              48-hour corridor forecast
            </p>
          </div>
          <RouteScene />
        </section>
        <section className="capability-strip" aria-label="Planner capabilities">
          {[
            "Up to 3 route options",
            "Arrival-time weather checks",
            "Cargo-aware risk rules",
            "0–48 hour forecast exploration",
          ].map((s, i) => (
            <HoloCard key={s} className="capability-card">
              <span>0{i + 1}</span>
              {s}
            </HoloCard>
          ))}
        </section>
        <section className="landing-section how-section" id="how-it-works">
          <div>
            <p className="landing-eyebrow">FROM DEPARTURE TO DECISION</p>
            <h2>
              A clearer journey.
              <br />
              Three simple steps.
            </h2>
            <div className="step-list">
              {steps.map(([title, text], i) => (
                <button
                  key={title}
                  aria-pressed={step === i}
                  onClick={() => setStep(i)}
                >
                  <span>0{i + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                  <ArrowUpRight size={20} />
                </button>
              ))}
            </div>
          </div>
          <WorkflowPreview step={step} />
        </section>
        <section
          id="weather-insight"
          className="weather-insight landing-section"
        >
          <div>
            <p className="landing-eyebrow">LOOK ALONG THE ROUTE</p>
            <h2>
              The forecast,
              <br />
              along your journey.
            </h2>
            <p>
              Weather at arrival answers what your checkpoints may encounter.
              The corridor view answers what the forecast looks like at a chosen
              hour. Explore both, with the difference always clear.
            </p>
            <Link className="text-link" to="/plan">
              Explore the planner <ArrowUpRight size={18} />
            </Link>
          </div>
          <ForecastPreview />
        </section>
        <section
          className="landing-section recommendation-story"
          id="methodology"
        >
          <div>
            <p className="landing-eyebrow">REASONS, NOT GUESSWORK</p>
            <h2>
              A recommendation
              <br />
              you can explain.
            </h2>
            <p>
              Fully assessed, fresh routes are compared under the supplied
              rules. No Travel and incomplete routes do not establish
              eligibility.
            </p>
          </div>
          <ol>
            {[
              "Fewer Severe miles",
              "Fewer High miles",
              "Lower average risk",
              "Shorter travel time",
            ].map((s, i) => (
              <li key={s}>
                <span>0{i + 1}</span>
                <h3>{s}</h3>
              </li>
            ))}
          </ol>
          <details className="methodology-details">
            <summary>View methodology and limitations</summary>
            <p>
              Wind, rain and snow use the supplied category boundaries. Wind
              from 35 to below 45 mph with cargo above 40,000 lb becomes Severe;
              wind from 45 to below 55 mph with cargo above 30,000 lb becomes No
              Travel. Known hazards remain visible when other forecast variables
              are missing.
            </p>
            <p>
              Checkpoint mileage uses conservative worst-endpoint intervals, and
              ETAs use maneuver timing or a labeled proportional fallback.
              Sampling and forecasts cannot guarantee conditions everywhere.
              Plan and review while stopped; this is not certified navigation or
              dispatch.
            </p>
          </details>
        </section>
        <section className="landing-section faq-section">
          <div>
            <p className="landing-eyebrow">A FEW THINGS TO KNOW</p>
            <h2>Before you head out.</h2>
          </div>
          <div>
            {questions.map(([q, a]) => (
              <AnimatedDisclosure key={q} question={q}>
                <p>{a}</p>
              </AnimatedDisclosure>
            ))}
          </div>
        </section>
        <section className="closing-cta">
          <Route size={36} />
          <h2>
            Plan with a clearer
            <br />
            view ahead.
          </h2>
          <Link className="landing-button" to="/plan">
            Open route planner <ArrowUpRight size={20} />
          </Link>
        </section>
      </main>
      <footer className="site-footer">
        <Link className="site-brand" to="/">
          <Route />
          RouteCast
        </Link>
        <nav aria-label="Footer navigation">
          <Link to="/plan">Planner</Link>
          <a href="#how-it-works">How it works</a>
          <a href="#methodology">Methodology</a>
          <a href="/THIRD_PARTY_NOTICES.txt">Software notices</a>
          <a href="/fonts/OFL.txt">Manrope font licence</a>
        </nav>
        <p>
          Plan and review while stopped. Forecasts and arrival times are
          estimates.
        </p>
      </footer>
    </div>
  );
}
