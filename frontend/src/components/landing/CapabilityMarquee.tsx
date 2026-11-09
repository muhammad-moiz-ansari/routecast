import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Pause, Play } from "lucide-react";
import { HoloCard } from "../ui/HoloCard";

const capabilities = [
  "Up to 3 route options",
  "Arrival-time weather checks",
  "Cargo-aware risk rules",
  "0–48 hour forecast exploration",
];

export function CapabilityMarquee() {
  const host = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const animation = useRef<gsap.core.Tween | null>(null);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting && !document.hidden),
    );
    observer.observe(host.current!);
    const visibility = () =>
      setVisible(
        !document.hidden &&
          !!host.current &&
          host.current.getBoundingClientRect().bottom > 0 &&
          host.current.getBoundingClientRect().top < innerHeight,
      );
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", change);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (reduced) return;
    const context = gsap.context(() => {
      // Two identical groups make -50% to 0 a seamless left-to-right loop at every viewport width.
      animation.current = gsap.fromTo(
        track.current,
        { xPercent: -50 },
        { xPercent: 0, duration: 36, ease: "none", repeat: -1, paused: true },
      );
    }, host);
    return () => {
      context.revert();
      animation.current = null;
    };
  }, [reduced]);
  useEffect(() => {
    animation.current?.paused(paused || hover || !visible);
  }, [paused, hover, visible, reduced]);
  return (
    <section
      ref={host}
      className="capability-strip capability-marquee"
      aria-label="Planner capabilities"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="capability-window">
        <div className="capability-track" ref={track}>
          {[0, 1].map((copy) => (
            <ul
              className="capability-group"
              key={copy}
              aria-hidden={copy === 1 ? true : undefined}
              inert={copy === 1}
            >
              {capabilities.map((text, i) => (
                <li key={text}>
                  <HoloCard className="capability-card">
                    <span>0{i + 1}</span>
                    {text}
                  </HoloCard>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      {!reduced && (
        <button
          type="button"
          className="capability-motion"
          aria-label={
            paused
              ? "Resume capability scrolling"
              : "Pause capability scrolling"
          }
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
      )}
    </section>
  );
}
