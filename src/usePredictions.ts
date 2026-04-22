import { useEffect, useRef } from "react";
import { useStore, CHILD_TO_PARENT_STOP } from "./store";
import type { Prediction } from "./types";

const MBTA_BASE = "https://api-v3.mbta.com";
const API_KEY = import.meta.env.VITE_MBTA_API_KEY as string | undefined;

function parsePrediction(item: any): Prediction {
  const attrs = item.attributes;
  const rels = item.relationships;
  const rawStopId = rels?.stop?.data?.id ?? "";
  return {
    id: item.id,
    routeId: rels?.route?.data?.id ?? "",
    stopId: CHILD_TO_PARENT_STOP[rawStopId] ?? rawStopId,
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
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      "filter[stop]": "place-harvd,place-cool",
      "filter[direction_id]": "1",
      "filter[route]": "Green-B,Green-C",
      sort: "arrival_time",
    });
    if (API_KEY) params.set("api_key", API_KEY);

    const url = `${MBTA_BASE}/predictions?${params}`;

    // Initial fetch for full state
    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        const preds = (json.data ?? []).map(parsePrediction);
        setPredictions(preds);
      })
      .catch(console.error);

    // SSE stream for live updates
    const sseUrl = `${url}&sort=arrival_time`;
    const es = new EventSource(sseUrl);
    esRef.current = es;

    es.addEventListener("reset", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setPredictions((data ?? []).map(parsePrediction));
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("add", (e: MessageEvent) => {
      try {
        const item = JSON.parse(e.data);
        updatePrediction(parsePrediction(item));
      } catch {
        // ignore
      }
    });

    es.addEventListener("update", (e: MessageEvent) => {
      try {
        const item = JSON.parse(e.data);
        updatePrediction(parsePrediction(item));
      } catch {
        // ignore
      }
    });

    es.addEventListener("remove", (e: MessageEvent) => {
      try {
        const item = JSON.parse(e.data);
        removePrediction(item.id);
      } catch {
        // ignore
      }
    });

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [setPredictions, updatePrediction, removePrediction]);
}
