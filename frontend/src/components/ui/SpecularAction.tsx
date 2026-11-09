import { type PointerEvent, type ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";
import "../../styles/specular.css";

// Pointer-lit rim inspired by the requested reference; no shader or idle animation.
function light(e: PointerEvent<HTMLElement>) {
  if (
    e.pointerType === "touch" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty(
    "--shine-x",
    `${Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))}%`,
  );
  e.currentTarget.style.setProperty(
    "--shine-y",
    `${Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100))}%`,
  );
}
export function SpecularLink({
  className = "",
  children,
  ...props
}: LinkProps) {
  return (
    <Link
      {...props}
      className={`specular-cta ${className}`}
      onPointerMove={light}
    >
      <span className="specular-label">{children}</span>
    </Link>
  );
}
export function SpecularButton({
  className = "",
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type={type}
      className={`specular-cta ${className}`}
      onPointerMove={light}
    >
      <span className="specular-label">{children}</span>
    </button>
  );
}
