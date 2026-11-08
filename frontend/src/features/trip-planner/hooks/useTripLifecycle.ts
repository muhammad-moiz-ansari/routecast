import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  heartbeat,
  readAnalysis,
  refreshTrip,
  stopTrip,
} from "../../../api/trips";
import { ApiError } from "../../../api/client";
import { usePageActivity } from "../../../hooks/usePageActivity";
export function useTripLifecycle(id: string | undefined) {
  const identity = useRef(id);
  identity.current = id;
  const active = usePageActivity();
  const client = useQueryClient();
  const [cooldown, setCooldown] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [stopping, setStopping] = useState(false);
  const query = useQuery({
    queryKey: ["analysis", id],
    queryFn: ({ signal }) => readAnalysis(id!, signal),
    enabled: (q) => !!id && active && !stopping && !q.state.data?.stopped,
    // Completed active trips still poll to discover server-scheduled reassessments.
    refetchInterval: (q) =>
      active && !stopping && !q.state.data?.stopped && !q.state.error
        ? 15000
        : false,
  });
  const stopped = !!query.data?.stopped || stopping;
  const latest = useRef(query.data);
  latest.current = query.data;
  useEffect(() => {
    setStopping(false);
    setCooldown(0);
  }, [id]);
  useEffect(() => {
    if (!id || !active || stopped || !query.data || query.error) return;
    // Query caching prevents StrictMode remounts from sending a second immediate heartbeat.
    const beat = () =>
      client
        .fetchQuery({
          queryKey: ["heartbeat", id],
          queryFn: ({ signal }) => heartbeat(id, signal),
          staleTime: 45000,
          retry: false,
        })
        .catch(() => undefined);
    void beat();
    const timer = setInterval(() => void beat(), 60000);
    return () => {
      clearInterval(timer);
      void client.cancelQueries({ queryKey: ["heartbeat", id] });
    };
  }, [id, active, stopped, !!query.data, !!query.error, client]);
  useEffect(() => {
    if (active) return;
    void client.cancelQueries({ queryKey: ["analysis", id] });
    void client.cancelQueries({ queryKey: ["corridor", id] });
    void client.cancelQueries({ queryKey: ["pending-routes", id] });
  }, [active, id, client]);
  useEffect(() => {
    if (!cooldown || !active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [cooldown, active]);
  const refresh = useMutation({
    mutationFn: () => refreshTrip(id!),
    onMutate: () => ({ id }),
    onSuccess: async (_result, _variables, context) => {
      if (context?.id !== identity.current) return;
      setCooldown(Date.now() + 60000);
      setNow(Date.now());
      await query.refetch();
    },
    onError: (e, _variables, context) => {
      if (context?.id !== identity.current) return;
      if (e instanceof ApiError && e.detail.retry_after_seconds) {
        setCooldown(Date.now() + e.detail.retry_after_seconds * 1000);
        setNow(Date.now());
      }
    },
  });
  const stop = useMutation({
    mutationFn: () => stopTrip(id!),
    onMutate: () => ({ id }),
    onSuccess: async (_result, _variables, context) => {
      if (context?.id !== identity.current) return;
      setStopping(true);
      await client.cancelQueries({ queryKey: ["corridor", id] });
      client.setQueryData(
        ["analysis", id],
        latest.current
          ? { ...latest.current, stopped: true, status: "stopped" }
          : undefined,
      );
      await query.refetch();
    },
  });
  return {
    query,
    active,
    stopped,
    refresh,
    stop,
    cooldownSeconds: Math.max(0, Math.ceil((cooldown - now) / 1000)),
  };
}
