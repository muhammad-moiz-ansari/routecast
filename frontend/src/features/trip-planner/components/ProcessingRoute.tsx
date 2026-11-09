/** Decorative route trail; status text and stages remain the accessible source of progress. */
export function ProcessingRoute() {
  const path =
    "M-40 310 C100 320 110 120 245 145 S380 350 485 245 S600 80 740 110";
  return (
    <svg
      className="processing-route"
      viewBox="0 0 700 420"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <path className="processing-route-track" d={path} />
      <path className="processing-route-glow" d={path} pathLength="1" />
      <path className="processing-route-trail" d={path} pathLength="1" />
    </svg>
  );
}
