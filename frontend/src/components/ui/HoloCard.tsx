import { type PointerEvent, type ReactNode } from "react";

// Lightweight foil/tilt inspired by React Bits; no shader, idle loop or React frame updates.
export function HoloCard({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "figure";
}) {
  const move = ({
    currentTarget: card,
    clientX,
    clientY,
    pointerType,
  }: PointerEvent<HTMLElement>) => {
    if (
      pointerType === "touch" ||
      !matchMedia("(hover: hover) and (pointer: fine)").matches ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const box = card.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - box.left) / box.width));
    const y = Math.max(0, Math.min(1, (clientY - box.top) / box.height));
    card.style.setProperty("--foil-x", `${x * 100}%`);
    card.style.setProperty("--foil-y", `${y * 100}%`);
    card.style.setProperty("--tilt-x", `${(0.5 - y) * 4}deg`);
    card.style.setProperty("--tilt-y", `${(x - 0.5) * 4}deg`);
  };
  const reset = ({ currentTarget: card }: PointerEvent<HTMLElement>) => {
    card.style.removeProperty("--tilt-x");
    card.style.removeProperty("--tilt-y");
    card.style.removeProperty("--foil-x");
    card.style.removeProperty("--foil-y");
  };
  return (
    <Tag
      className={`holo-surface ${className}`}
      onPointerMove={move}
      onPointerLeave={reset}
      onPointerCancel={reset}
    >
      {children}
    </Tag>
  );
}
