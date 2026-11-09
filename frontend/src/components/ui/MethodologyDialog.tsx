import * as Dialog from "@radix-ui/react-dialog";
import { HelpCircle, X } from "lucide-react";
export function MethodologyDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="methodology-trigger" aria-label="Methodology">
        <HelpCircle size={18} />
        <span>Methodology</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog">
          <Dialog.Title>How RouteCast compares routes</Dialog.Title>
          <Dialog.Description>
            Plan and check information while stopped. RouteCast is a planning
            assessment, not a certified navigation system.
          </Dialog.Description>
          <p>
            The backend requests up to three distinct truck routes, estimates
            checkpoint arrivals, then matches forecasts to those times. Fewer
            routes and missing forecasts are reported explicitly.
          </p>
          <p>
            Eligible routes are ranked by Severe miles, High miles, average
            risk, then travel time. Cargo load is separate from gross vehicle
            weight and dimensions.
          </p>
          <Dialog.Close className="close" aria-label="Close methodology">
            <X />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
