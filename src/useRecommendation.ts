import { useEffect, useMemo, useState } from "react";
import { useStore } from "./store";

export interface StopRecommendation {
  stopId: string;
  stopName: string;
  route: string;
  walkMinutes: number | null;
  trainArrivesIn: number | null;
  bufferMinutes: number | null;
  nextTrainArrivesIn: number | null;
  catchable: boolean;
}

export interface Recommendation {
  best: StopRecommendation | null;
  all: StopRecommendation[];
  leaveNow: boolean;
}

export function useRecommendation(): Recommendation {
  const predictions = useStore((s) => s.predictions);
  const alerts = useStore((s) => s.alerts);
  const STOPS = useStore((s) => s.activeStops);
  const walkTimes = useStore((s) => s.walkTimes);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    void tick;
    const now = Date.now();

    const stopRecs: StopRecommendation[] = STOPS.map((stop) => {
      const walkMin = walkTimes[stop.id] ?? null;

      const hasDisruption = alerts.some(
        (a) =>
          a.routeIds.includes(stop.route) &&
          ["SHUTTLE", "SUSPENSION", "NO_SERVICE"].includes(a.effect)
      );

      const noData = {
        stopId: stop.id,
        stopName: stop.name,
        route: stop.route,
        walkMinutes: walkMin,
        trainArrivesIn: null,
        bufferMinutes: null,
        nextTrainArrivesIn: null,
        catchable: false,
      };

      if (hasDisruption || walkMin === null) return noData;

      const futurePreds = predictions
        .filter((p) => p.stopId === stop.id && p.arrivalTime)
        .map((p) => ({
          ...p,
          arrivesIn: (new Date(p.arrivalTime!).getTime() - now) / 60_000,
        }))
        .filter((p) => p.arrivesIn > 0)
        .sort((a, b) => a.arrivesIn - b.arrivesIn);

      if (futurePreds.length === 0) return noData;

      const nextTrain = futurePreds[0];
      const catchableTrain = futurePreds.find(
        (p) => p.arrivesIn - walkMin >= 0
      );

      return {
        stopId: stop.id,
        stopName: stop.name,
        route: stop.route,
        walkMinutes: walkMin,
        trainArrivesIn: catchableTrain
          ? Math.round(catchableTrain.arrivesIn)
          : null,
        bufferMinutes: catchableTrain
          ? Math.round(catchableTrain.arrivesIn - walkMin)
          : null,
        nextTrainArrivesIn: Math.round(nextTrain.arrivesIn),
        catchable: !!catchableTrain,
      };
    });

    const withData = stopRecs.filter((r) => r.bufferMinutes !== null);
    const catchable = withData.filter((r) => r.catchable);
    const pool = catchable.length > 0 ? catchable : withData;
    const best =
      pool.length > 0
        ? pool.reduce((a, b) =>
            (a.walkMinutes ?? Infinity) <= (b.walkMinutes ?? Infinity) ? a : b
          )
        : null;

    const leaveNow =
      best !== null && best.catchable && best.bufferMinutes !== null && best.bufferMinutes < 3;

    return { best, all: stopRecs, leaveNow };
  }, [predictions, alerts, STOPS, walkTimes, tick]);
}
