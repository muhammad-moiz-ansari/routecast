import { useEffect, useState } from "react";
export function usePageActivity() {
  const [active, setActive] = useState(!document.hidden && navigator.onLine);
  useEffect(() => {
    const update = () => setActive(!document.hidden && navigator.onLine);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return active;
}
