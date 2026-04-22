import { useEffect, useMemo, useState } from "react";
import { useStore, STOPS } from "./store";

const WALK_TIMES: Record<string, number> = {
  "place-harvd": parseFloat(
    import.meta.env.VITE_WALK_TIME_HARVARD_AVE_MINS ?? "7"
  ),
  "place-cool": parseFloat(
    import.meta.env.VITE_WALK_TIME_COOLIDGE_CORNER_MINS ?? "12"
  ),
};

export interface StopRecommendation {
  stopId: string;
  stopName: string;
  route: string;
  walkMinutes: number;
  trainArrivesIn: number | null; // minutes from now
  bufferMinutes: number | null; // arrival - walk time
}

export interface Recommendation {
  best: StopRecommendation | null;
  all: StopRecommendation[];
  leaveNow: boolean;
}

export function useRecommendation(): Recommendation {
  const predictions = useStore((s) => s.predictions);
  const alerts = useStore((s) => s.alerts);

  // Tick every 15s so Date.now() stays fresh
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    void tick; // dependency
    const now = Date.now();

    const stopRecs: StopRecommendation[] = STOPS.map((stop) => {
      const walkMin = WALK_TIMES[stop.id] ?? 10;

      // Check if route has service-disrupting alert
      const hasDisruption = alerts.some(
        (a) =>
          a.routeIds.includes(stop.route) &&
          ["SHUTTLE", "SUSPENSION", "NO_SERVICE"].includes(a.effect)
      );

      if (hasDisruption) {
        return {
          stopId: stop.id,
          stopName: stop.name,
          route: stop.route,
          walkMinutes: walkMin,
          trainArrivesIn: null,
          bufferMinutes: null,
        };
      }

      // Find next future arrival
      const futurePreds = predictions
        .filter((p) => p.stopId === stop.id && p.arrivalTime)
        .map((p) => ({
          ...p,
          arrivesIn: (new Date(p.arrivalTime!).getTime() - now) / 60_000,
        }))
        .filter((p) => p.arrivesIn > 0)
        .sort((a, b) => a.arrivesIn - b.arrivesIn);

      const next = futurePreds[0];
      if (!next) {
        return {
          stopId: stop.id,
          stopName: stop.name,
          route: stop.route,
          walkMinutes: walkMin,
          trainArrivesIn: null,
          bufferMinutes: null,
        };
      }

      const arrivesIn = Math.round(next.arrivesIn);
      const buffer = Math.round(next.arrivesIn - walkMin);

      return {
        stopId: stop.id,
        stopName: stop.name,
        route: stop.route,
        walkMinutes: walkMin,
        trainArrivesIn: arrivesIn,
        bufferMinutes: buffer,
      };
    });

    // Pick best: largest buffer among stops with data
    const withBuffer = stopRecs.filter((r) => r.bufferMinutes !== null);
    const best =
      withBuffer.length > 0
        ? withBuffer.reduce((a, b) =>
            a.bufferMinutes! >= b.bufferMinutes! ? a : b
          )
        : null;

    const leaveNow =
      withBuffer.length > 0 && withBuffer.every((r) => r.bufferMinutes! < 3);

    return { best, all: stopRecs, leaveNow };
  }, [predictions, alerts, tick]);
}
