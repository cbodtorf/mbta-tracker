import { useEffect } from "react";
import { useStore, ROUTE_FILTER } from "./store";
import type { Alert } from "./types";

const MBTA_BASE = "https://api-v3.mbta.com";
const API_KEY = import.meta.env.VITE_MBTA_API_KEY as string | undefined;

const POLL_INTERVAL = 5 * 60_000; // 5 min — alerts don't change fast

function parseAlert(item: any): Alert {
  const attrs = item.attributes;
  const routeIds = (attrs.informed_entity ?? [])
    .map((e: any) => e.route)
    .filter((r: string | undefined): r is string => !!r);

  return {
    id: item.id,
    header: attrs.header ?? "",
    description: attrs.description ?? "",
    effect: attrs.effect ?? "",
    severity: attrs.severity ?? 0,
    routeIds: [...new Set(routeIds)] as string[],
    activePeriods: (attrs.active_period ?? []).map((p: any) => ({
      start: p.start,
      end: p.end,
    })),
  };
}

function isActive(alert: Alert): boolean {
  const now = Date.now();
  return alert.activePeriods.some((p) => {
    const start = new Date(p.start).getTime();
    const end = p.end ? new Date(p.end).getTime() : Infinity;
    return now >= start && now <= end;
  });
}

export function useAlerts() {
  const setAlerts = useStore((s) => s.setAlerts);

  useEffect(() => {
    const params = new URLSearchParams({
      "filter[route]": ROUTE_FILTER,
      "filter[activity]": "BOARD,EXIT,RIDE",
    });
    if (API_KEY) params.set("api_key", API_KEY);
    const url = `${MBTA_BASE}/alerts?${params}`;

    const fetchAlerts = () => {
      fetch(url)
        .then((res) => res.json())
        .then((json) => {
          const all = (json.data ?? []).map(parseAlert);
          setAlerts(all.filter(isActive));
        })
        .catch(console.error);
    };

    fetchAlerts();
    const id = setInterval(fetchAlerts, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [setAlerts]);
}
