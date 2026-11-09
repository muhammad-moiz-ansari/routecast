import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Check, FolderOpen, X, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { readSavedTrips, saveTrip } from "../../../api/trips";
import { ApiError } from "../../../api/client";
import "./SavedTripTools.css";

function savedTripsFailure(error: Error) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403)
      return "Your session could not be verified. Try again to reconnect.";
    if (error.status === 404 || error.status === 422)
      return "Saved trips are unavailable on this server. Please try again later.";
    if (error.status >= 500)
      return "The server could not load your saved trips. Please try again.";
  }
  return "Could not load your trips. Please try again.";
}

/** Browser-session bookmarks reuse persisted results instead of submitting trips again. */
export function SavedTripTools({
  tripId,
  title,
  onOpenTrip,
}: {
  tripId?: string;
  title: string;
  onOpenTrip?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () => saveTrip(tripId!, title.slice(0, 200)),
    onSuccess: () => client.invalidateQueries({ queryKey: ["saved-trips"] }),
  });
  const saved = useQuery({
    queryKey: ["saved-trips", offset],
    queryFn: ({ signal }) => readSavedTrips(offset, signal),
    enabled: open,
    staleTime: 0,
    retry: false,
  });
  return (
    <div className="saved-trip-tools">
      <div className="saved-trip-actions">
        <button
          type="button"
          disabled={!tripId || save.isPending || save.isSuccess}
          onClick={() => save.mutate()}
        >
          {save.isSuccess ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Bookmark size={16} aria-hidden="true" />
          )}
          {save.isPending
            ? "Saving…"
            : save.isSuccess
              ? "Trip saved"
              : "Save Trip"}
        </button>
        <Dialog.Root
          open={open}
          onOpenChange={(value) => {
            setOpen(value);
            if (value) setOffset(0);
          }}
        >
          <Dialog.Trigger>
            <FolderOpen size={16} aria-hidden="true" />
            My Trips
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="overlay" />
            <Dialog.Content className="dialog saved-trips-dialog">
              <span className="eyebrow">YOUR JOURNEYS</span>
              <Dialog.Title>My Trips</Dialog.Title>
              <Dialog.Description>
                Saved in this browser session. Clearing cookies, an expired
                session, or switching browsers or devices loses access.
              </Dialog.Description>
              <Dialog.Close className="close" aria-label="Close My Trips">
                <X />
              </Dialog.Close>
              {saved.isPending && <p role="status">Loading saved trips…</p>}
              {saved.isError && (
                <div role="alert">
                  <p>{savedTripsFailure(saved.error)}</p>
                  <button type="button" onClick={() => saved.refetch()}>
                    Try again
                  </button>
                </div>
              )}
              {saved.data && !saved.isError && (
                <>
                  {saved.data.items.length === 0 ? (
                    <p className="saved-trips-empty">
                      Your next journey starts here. Plan a trip, then select
                      Save Trip to keep it.
                    </p>
                  ) : (
                    <ul className="saved-trips-list">
                      {saved.data.items.map((trip) => (
                        <li key={trip.id}>
                          <Link
                            to={`/trips/${encodeURIComponent(trip.id)}`}
                            onClick={() => {
                              setOpen(false);
                              onOpenTrip?.(trip.id);
                            }}
                          >
                            <span>
                              <strong>{trip.title}</strong>
                              <small>
                                {new Date(trip.departure_at).toLocaleString(
                                  undefined,
                                  {
                                    timeZone: trip.timezone,
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  },
                                )}{" "}
                                · {trip.timezone}
                              </small>
                              <small>{trip.status.replaceAll("_", " ")}</small>
                            </span>
                            <ArrowUpRight size={18} aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="saved-trips-pagination">
                    <button
                      type="button"
                      disabled={offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - 20))}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={saved.data.next_offset === null}
                      onClick={() => setOffset(saved.data!.next_offset!)}
                    >
                      Next
                    </button>
                  </div>
                  <p className="saved-trips-note">
                    Opening a trip loads stored results. Review forecast
                    freshness before travelling.
                  </p>
                </>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      {save.isError && (
        <p role="alert">Could not save this trip. Please try again.</p>
      )}
      {save.isSuccess && (
        <span className="sr-only" role="status">
          Trip saved to My Trips.
        </span>
      )}
    </div>
  );
}
