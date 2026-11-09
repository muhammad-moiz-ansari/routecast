import { lazy, Suspense, useEffect } from "react";
import { Outlet, Link, useLocation, type RouteObject } from "react-router-dom";
import { ThemeProvider } from "./ThemeProvider";
import { LandingPage } from "../pages/LandingPage";
// Keep trip queries and the geographic renderer out of the landing module graph.
const Planner = lazy(() => import("./App").then((m) => ({ default: m.App })));
function Shell() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title =
      pathname === "/"
        ? "RouteCast · Weather-aware truck routing"
        : "RouteCast · Route planner";
  }, [pathname]);
  return (
    <ThemeProvider>
      <Suspense
        fallback={
          <main className="loading-page" role="status">
            Opening route planner…
          </main>
        }
      >
        <Outlet />
      </Suspense>
    </ThemeProvider>
  );
}
export const routes: RouteObject[] = [
  {
    element: <Shell />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/plan", element: <Planner /> },
      { path: "/trips/:id", element: <Planner /> },
      {
        path: "*",
        element: (
          <main className="loading-page">
            <h1>That route wasn't found.</h1>
            <p>
              Return to <Link to="/">RouteCast home</Link> or{" "}
              <Link to="/plan">plan a route</Link>.
            </p>
          </main>
        ),
      },
    ],
  },
];
