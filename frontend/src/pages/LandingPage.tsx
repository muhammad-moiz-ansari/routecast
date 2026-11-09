import { HeroRouteScene } from "../components/landing/HeroRouteScene";
import { SpecularLink } from "../components/ui/SpecularAction";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Route, ArrowUpRight, ArrowRight } from "lucide-react";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import "../styles/landing.css";
import { HoloCard } from "../components/ui/HoloCard";
import { AnimatedDisclosure } from "../components/ui/AnimatedDisclosure";
import {
  WorkflowPreview,
  ForecastPreview,
} from "../components/landing/LandingExamples";
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
  const [mobile, setMobile] = useState(
    () => matchMedia("(max-width: 600px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(max-width: 600px)");
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) setMenu(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
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
          inert={mobile && !menu}
          aria-hidden={mobile && !menu ? true : undefined}
        >
          <div className="site-nav-content">
            <a href="#how-it-works" onClick={() => setMenu(false)}>
              How it works
            </a>
            <a href="#weather-insight" onClick={() => setMenu(false)}>
              Weather insight
            </a>
            <a href="#methodology" onClick={() => setMenu(false)}>
              Methodology
            </a>
            <SpecularLink
              to="/plan"
              className="mobile-plan"
              onClick={() => setMenu(false)}
            >
              Plan a route →
            </SpecularLink>
          </div>
        </nav>
        <div className="site-actions">
          <ThemeToggle />
          <SpecularLink to="/plan" className="landing-button header-plan">
            Plan a route <ArrowUpRight size={18} />
          </SpecularLink>
          <button
            className="menu-button"
            ref={trigger}
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-controls="site-navigation"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <span className="hamburger-lines" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
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
              <SpecularLink to="/plan" className="landing-button">
                Plan a route <ArrowUpRight size={20} />
              </SpecularLink>
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
          <HeroRouteScene />
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
          <AnimatedDisclosure
            className="methodology-details"
            question="View methodology and limitations"
          >
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
          </AnimatedDisclosure>
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
          <SpecularLink className="landing-button" to="/plan">
            Open route planner <ArrowUpRight size={20} />
          </SpecularLink>
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
