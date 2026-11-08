import { z } from "zod";
import { departureInstant } from "../../utils/time";
const location = z
  .object({
    id: z.string(),
    label: z.string(),
    coordinate: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
  })
  .nullable()
  .refine((v) => Boolean(v), "Select a location from the search results.");
export const plannerSchema = z
  .object({
    origin: location,
    destination: location,
    departure: z.string().min(1, "Choose a departure date and time."),
    timezone: z.string().min(1, "Enter an IANA timezone."),
    cargo: z
      .string()
      .refine(
        (v) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0,
        "Enter a finite cargo load of zero or more pounds.",
      ),
    spacing: z.enum(["10", "25", "50"]),
  })
  .superRefine((v, ctx) => {
    try {
      if (Date.parse(departureInstant(v.departure, v.timezone)) <= Date.now())
        ctx.addIssue({
          code: "custom",
          path: ["departure"],
          message: "Choose a future departure.",
        });
    } catch {
      ctx.addIssue({
        code: "custom",
        path: ["departure"],
        message:
          "Check the local date, time and timezone. Repeated or skipped daylight-saving times require another departure time.",
      });
    }
    if (
      v.origin &&
      v.destination &&
      JSON.stringify(v.origin.coordinate) ===
        JSON.stringify(v.destination.coordinate)
    )
      ctx.addIssue({
        code: "custom",
        path: ["destination"],
        message: "Origin and destination must differ.",
      });
  });
export type PlannerValues = z.infer<typeof plannerSchema>;
