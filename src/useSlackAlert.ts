import { useEffect, useRef } from "react";
import { useStore } from "./store";
import { useRecommendation } from "./useRecommendation";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function useSlackAlert() {
  const { best, leaveNow } = useRecommendation();
  const alertArmed = useStore((s) => s.alertArmed);
  const firedVehicleIds = useStore((s) => s.firedVehicleIds);
  const addFiredVehicleId = useStore((s) => s.addFiredVehicleId);
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!alertArmed || !leaveNow || !best || !best.vehicleId || !best.arrivalTime) return;

    const vid = best.vehicleId;
    if (firedVehicleIds.has(vid) || pendingRef.current.has(vid)) return;

    pendingRef.current.add(vid);

    const arrivalStr = formatTime(best.arrivalTime);
    const text =
      `\u{1F6A8} Leave now \u2192 ${best.stopName}\n` +
      `${best.route} (${vid}) arrives at ${arrivalStr} (${best.trainArrivesIn}min)\n` +
      `Walk time: ${best.walkMinutes}min \u00B7 Buffer: ${best.bufferMinutes}min`;

    fetch("/api/slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((res) => {
        if (res.ok) addFiredVehicleId(vid);
        else console.error("Slack alert failed:", res.status);
      })
      .catch(console.error)
      .finally(() => {
        pendingRef.current.delete(vid);
      });
  }, [alertArmed, leaveNow, best, firedVehicleIds, addFiredVehicleId]);
}
