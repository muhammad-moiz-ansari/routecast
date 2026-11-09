import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
const ThemeContext = createContext<{
  night: boolean;
  toggle: () => void;
} | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Follow system changes until an explicit choice; preserve the existing storage key.
  const [choice, setChoice] = useState(
    () => localStorage.getItem("routecast-theme") ?? "system",
  );
  const [system, setSystem] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const night = choice === "night" || (choice !== "day" && system);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystem(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = night ? "night" : "day";
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon) {
      icon.type = "image/png";
      icon.href = night ? "/favicon-dark.png" : "/favicon-light.png";
    }
  }, [night]);
  const toggle = () => {
    const next = night ? "day" : "night";
    setChoice(next);
    localStorage.setItem("routecast-theme", next);
  };
  return (
    <ThemeContext.Provider value={{ night, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw Error("ThemeProvider is required");
  return value;
}
