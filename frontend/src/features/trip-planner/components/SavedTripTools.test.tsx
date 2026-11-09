import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { SavedTripTools } from "./SavedTripTools";
import { readSavedTrips, saveTrip } from "../../../api/trips";

vi.mock("../../../api/trips", () => ({
  readSavedTrips: vi.fn(),
  saveTrip: vi.fn(),
}));
const trip = {
  id: "stored-trip",
  title: "Lahore → Faisalabad",
  saved_at: "2026-11-10T12:00:00Z",
  departure_at: "2026-11-11T12:00:00Z",
  timezone: "Asia/Karachi",
  status: "complete",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readSavedTrips).mockResolvedValue({
    items: [trip],
    next_offset: null,
  });
  vi.mocked(saveTrip).mockResolvedValue(trip);
});
function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}
function setup(id?: string) {
  const opened = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <SavedTripTools tripId={id} title={trip.title} onOpenTrip={opened} />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), opened };
}
it("disables saving an unsubmitted trip and requests bookmarks only when opened", async () => {
  const { user } = setup();
  expect(screen.getByRole("button", { name: "Save Trip" })).toBeDisabled();
  expect(readSavedTrips).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "My Trips" }));
  expect(await screen.findByRole("link", { name: /Lahore/ })).toBeVisible();
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(saveTrip).not.toHaveBeenCalled();
});
it("saves once and opens the stored trip without submitting another analysis", async () => {
  const { user, opened } = setup(trip.id);
  await user.click(screen.getByRole("button", { name: "Save Trip" }));
  expect(
    await screen.findByRole("button", { name: "Trip saved" }),
  ).toBeDisabled();
  expect(saveTrip).toHaveBeenCalledExactlyOnceWith(trip.id, trip.title);
  await user.click(screen.getByRole("button", { name: "My Trips" }));
  await user.click(await screen.findByRole("link", { name: /Lahore/ }));
  expect(screen.getByTestId("location")).toHaveTextContent(
    "/trips/stored-trip",
  );
  expect(opened).toHaveBeenCalledOnce();
});
it("shows empty and failure states with a retry", async () => {
  vi.mocked(readSavedTrips)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({ items: [], next_offset: null });
  const { user } = setup();
  await user.click(screen.getByRole("button", { name: "My Trips" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(
    await screen.findByText(/Your next journey starts here/),
  ).toBeVisible();
});
it("keeps saving available after a failed save", async () => {
  vi.mocked(saveTrip).mockRejectedValueOnce(new Error("offline"));
  const { user } = setup(trip.id);
  await user.click(screen.getByRole("button", { name: "Save Trip" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
  expect(screen.getByRole("button", { name: "Save Trip" })).toBeEnabled();
});
