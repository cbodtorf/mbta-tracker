import { useEffect, useRef } from "react";
import { useStore } from "./store";
import type { Train } from "./types";

const MBTA_BASE = "https://api-v3.mbta.com";
const API_KEY = import.meta.env.VITE_MBTA_API_KEY as string | undefined;

function parseVehicle(item: any): Train {
  const attrs = item.attributes;
  const rels = item.relationships;
  return {
    vehicleId: item.id,
    routeId: rels?.route?.data?.id ?? "",
    latitude: attrs.latitude,
    longitude: attrs.longitude,
    bearing: attrs.bearing ?? 0,
    currentStatus: attrs.current_status ?? "",
    updatedAt: attrs.updated_at ?? "",
  };
}

export function useVehicles() {
  const { setTrains, updateTrain, removeTrain } = useStore();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      "filter[route]": "Green-B,Green-C",
    });
    if (API_KEY) params.set("api_key", API_KEY);

    const url = `${MBTA_BASE}/vehicles?${params}`;

    // Initial fetch
    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        const vehicles = (json.data ?? []).map(parseVehicle);
        setTrains(vehicles);
      })
      .catch(console.error);

    // SSE stream
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("reset", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setTrains((data ?? []).map(parseVehicle));
      } catch {
        // ignore
      }
    });

    es.addEventListener("add", (e: MessageEvent) => {
      try {
        updateTrain(parseVehicle(JSON.parse(e.data)));
      } catch {
        // ignore
      }
    });

    es.addEventListener("update", (e: MessageEvent) => {
      try {
        updateTrain(parseVehicle(JSON.parse(e.data)));
      } catch {
        // ignore
      }
    });

    es.addEventListener("remove", (e: MessageEvent) => {
      try {
        const item = JSON.parse(e.data);
        removeTrain(item.id);
      } catch {
        // ignore
      }
    });

    es.onerror = () => {
      // auto-reconnects
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [setTrains, updateTrain, removeTrain]);
}
