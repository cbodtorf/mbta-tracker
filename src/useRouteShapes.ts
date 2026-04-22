import { useEffect, useState } from "react";

const MBTA_BASE = "https://api-v3.mbta.com";
const API_KEY = import.meta.env.VITE_MBTA_API_KEY as string | undefined;

export interface RouteShape {
  routeId: string;
  path: [number, number][]; // [lng, lat][]
}

/** Decode Google encoded polyline → [lat, lng][] then flip to [lng, lat][] */
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;

  while (i < encoded.length) {
    // latitude
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(i++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    // longitude
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(i++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / 1e5, lat / 1e5]);
  }

  return coords;
}

export function useRouteShapes(): RouteShape[] {
  const [shapes, setShapes] = useState<RouteShape[]>([]);

  useEffect(() => {
    const routes = ["Green-B", "Green-C", "Green-D", "Green-E"];

    Promise.all(
      routes.map((routeId) => {
        const params = new URLSearchParams({ "filter[route]": routeId });
        if (API_KEY) params.set("api_key", API_KEY);
        return fetch(`${MBTA_BASE}/shapes?${params}`)
          .then((res) => res.json())
          .then((json) => {
            // Pick the longest shape (most complete route)
            const items = json.data ?? [];
            if (items.length === 0) return null;
            const best = items.reduce((a: any, b: any) =>
              (a.attributes.polyline?.length ?? 0) >=
              (b.attributes.polyline?.length ?? 0)
                ? a
                : b
            );
            const path = decodePolyline(best.attributes.polyline);
            return { routeId, path } as RouteShape;
          })
          .catch(() => null);
      })
    ).then((results) => {
      setShapes(results.filter((r): r is RouteShape => r !== null));
    });
  }, []);

  return shapes;
}
