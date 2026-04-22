import { useEffect, useRef } from "react";
import { useStore, ROUTE_FILTER } from "./store";
import type { Prediction } from "./types";

const MBTA_BASE = "https://api-v3.mbta.com";
const API_KEY = import.meta.env.VITE_MBTA_API_KEY as string | undefined;

function parsePrediction(
  item: any,
  childToParent: Record<string, string>
): Prediction {
  const attrs = item.attributes;
  const rels = item.relationships;
  const rawStopId = rels?.stop?.data?.id ?? "";
  return {
    id: item.id,
    routeId: rels?.route?.data?.id ?? "",
    stopId: childToParent[rawStopId] ?? rawStopId,
    tripId: rels?.trip?.data?.id ?? "",
    vehicleId: rels?.vehicle?.data?.id ?? null,
    arrivalTime: attrs.arrival_time,
    departureTime: attrs.departure_time,
    directionId: attrs.direction_id,
    status: attrs.status,
  };
}

export function usePredictions() {
  const { setPredictions, updatePrediction, removePrediction } = useStore();
  const activeStops = useStore((s) => s.activeStops);
  const childToParent = useStore((s) => s.childToParent);
  const esRef = useRef<EventSource | null>(null);
  const childToParentRef = useRef(childToParent);
  childToParentRef.current = childToParent;

  const stopIds = activeStops.map((s) => s.id).join(",");
  const hasChildMap = Object.keys(childToParent).length > 0;

  useEffect(() => {
    if (!stopIds || !hasChildMap) return;

    const parse = (item: any) =>
      parsePrediction(item, childToParentRef.current);

    const params = new URLSearchParams({
      "filter[stop]": stopIds,
      "filter[route]": ROUTE_FILTER,
      sort: "arrival_time",
    });
    if (API_KEY) params.set("api_key", API_KEY);

    const url = `${MBTA_BASE}/predictions?${params}`;

    // Initial fetch
    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        setPredictions((json.data ?? []).map(parse));
      })
      .catch(console.error);

    // SSE stream
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("reset", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setPredictions((data ?? []).map(parse));
      } catch {
        // ignore
      }
    });

    es.addEventListener("add", (e: MessageEvent) => {
      try {
        updatePrediction(parse(JSON.parse(e.data)));
      } catch {
        // ignore
      }
    });

    es.addEventListener("update", (e: MessageEvent) => {
      try {
        updatePrediction(parse(JSON.parse(e.data)));
      } catch {
        // ignore
      }
    });

    es.addEventListener("remove", (e: MessageEvent) => {
      try {
        removePrediction(JSON.parse(e.data).id);
      } catch {
        // ignore
      }
    });

    es.onerror = () => {};

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [stopIds, hasChildMap, setPredictions, updatePrediction, removePrediction]);
}
