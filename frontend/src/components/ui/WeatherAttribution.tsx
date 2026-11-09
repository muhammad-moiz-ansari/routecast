/** Credits the provider recorded with the forecast; older results without one used Open-Meteo. */
export function WeatherAttribution({ provider }: { provider?: string }) {
  if (provider === "pirate-weather")
    return (
      <small className="weather-attribution">
        Weather data by <a href="https://pirateweather.net/">Pirate Weather</a>.
        Units converted; risk and corridor displays derived by RouteCast.
      </small>
    );
  return (
    <small className="weather-attribution">
      Weather data by <a href="https://open-meteo.com/">Open-Meteo</a> ·{" "}
      <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
      Units converted; risk and corridor displays derived by RouteCast.
    </small>
  );
}
