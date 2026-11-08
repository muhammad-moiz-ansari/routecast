import { Temporal } from "@js-temporal/polyfill";
export function departureInstant(local: string, zone: string): string {
  // Reject ambiguous/repeated and skipped wall times, preserving the intended departure.
  return Temporal.PlainDateTime.from(local)
    .toZonedDateTime(zone, { disambiguation: "reject" })
    .toInstant()
    .toString();
}
export const systemZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
