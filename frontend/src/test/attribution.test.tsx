import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { WeatherAttribution } from "../components/ui/WeatherAttribution";
it("credits the recorded weather provider and defaults to Open-Meteo", () => {
  const view = render(<WeatherAttribution provider="pirate-weather" />);
  expect(screen.getByRole("link", { name: "Pirate Weather" })).toHaveAttribute(
    "href",
    "https://pirateweather.net/",
  );
  expect(screen.queryByRole("link", { name: "Open-Meteo" })).toBeNull();
  view.rerender(<WeatherAttribution />);
  expect(screen.getByRole("link", { name: "Open-Meteo" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "CC BY 4.0" })).toBeInTheDocument();
});
