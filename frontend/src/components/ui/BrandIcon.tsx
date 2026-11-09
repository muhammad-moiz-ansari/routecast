import { useTheme } from "../../app/ThemeProvider";

/** Use the supplied brand assets; nearby text supplies the accessible brand name. */
export function BrandIcon({
  size = 32,
  white = false,
}: {
  size?: number;
  white?: boolean;
}) {
  const { night } = useTheme();
  return (
    <img
      className="brand-icon"
      src={
        white
          ? "/favicon-white.png"
          : night
            ? "/favicon-dark.png"
            : "/favicon-light.png"
      }
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}
