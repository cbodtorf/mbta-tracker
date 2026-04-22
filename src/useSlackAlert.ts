import { useEffect, useRef } from "react";
import { useStore } from "./store";
import { useRecommendation } from "./useRecommendation";

export function useSlackAlert() {
  const { best, leaveNow } = useRecommendation();
  const alertArmed = useStore((s) => s.alertArmed);
  const alertFired = useStore((s) => s.alertFired);
  const setAlertFired = useStore((s) => s.setAlertFired);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!alertArmed || alertFired || !leaveNow || !best || pendingRef.current) return;

    pendingRef.current = true;

    const text =
      `\u{1F6A8} Leave now \u2192 ${best.stopName}. ` +
      `${best.route} arrives in ${best.trainArrivesIn} min. ` +
      `You have a ${best.walkMinutes}min walk.`;

    fetch("/api/slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((res) => {
        if (res.ok) setAlertFired(true);
        else console.error("Slack alert failed:", res.status);
      })
      .catch(console.error)
      .finally(() => {
        pendingRef.current = false;
      });
  }, [alertArmed, alertFired, leaveNow, best, setAlertFired]);
}
