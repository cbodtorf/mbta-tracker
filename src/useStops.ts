import { useEffect, useMemo, useState } from "react";
import { useStore, ROUTES } from "./store";
import type { Stop } from "./types";

const MBTA_BASE = "https://api-v3.mbta.com";
const API_KEY = import.meta.env.VITE_MBTA_API_KEY as string | undefined;

export interface MbtaStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  route: string;
  childIds: string[];
}

function distanceKm(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function useStops() {
  const [allStops, setAllStops] = useState<MbtaStop[]>([]);
  const home = useStore((s) => s.home);
  const setActiveStops = useStore((s) => s.setActiveStops);
  const setChildToParent = useStore((s) => s.setChildToParent);

  useEffect(() => {
    Promise.all(
      ROUTES.map((route) => {
        const params = new URLSearchParams({
          "filter[route]": route,
          include: "child_stops",
        });
        if (API_KEY) params.set("api_key", API_KEY);

        return fetch(`${MBTA_BASE}/stops?${params}`)
          .then((r) => r.json())
          .then((json) => {
            const parentItems = json.data ?? [];
            const childItems = json.included ?? [];

            // Build parent→childIds map from included children
            const childMap = new Map<string, string[]>();
            for (const child of childItems) {
              const parentId =
                child.relationships?.parent_station?.data?.id;
              if (parentId) {
                const list = childMap.get(parentId) ?? [];
                list.push(child.id);
                childMap.set(parentId, list);
              }
            }

            return parentItems.map((item: any) => ({
              id: item.id,
              name: item.attributes.name,
              lat: item.attributes.latitude,
              lng: item.attributes.longitude,
              route,
              childIds: childMap.get(item.id) ?? [],
            })) as MbtaStop[];
          })
          .catch(() => [] as MbtaStop[]);
      })
    )
      .then((results) => setAllStops(results.flat()))
      .catch(console.error);
  }, []);

  // Pick closest stop per route
  const activeStops = useMemo(() => {
    if (allStops.length === 0) return [];

    const closest: Stop[] = [];
    for (const route of ROUTES) {
      const routeStops = allStops.filter((s) => s.route === route);
      if (routeStops.length === 0) continue;

      const nearest = routeStops.reduce((a, b) =>
        distanceKm(home, [a.lng, a.lat]) <= distanceKm(home, [b.lng, b.lat])
          ? a
          : b
      );

      closest.push({
        id: nearest.id,
        name: nearest.name,
        coordinates: [nearest.lng, nearest.lat],
        route: nearest.route,
      });
    }

    return closest;
  }, [home, allStops]);

  // Build child→parent map
  const childToParent = useMemo(() => {
    const map: Record<string, string> = {};
    for (const stop of allStops) {
      map[stop.id] = stop.id;
      for (const childId of stop.childIds) {
        map[childId] = stop.id;
      }
    }
    return map;
  }, [allStops]);

  // Push to store
  useEffect(() => {
    if (activeStops.length > 0 && Object.keys(childToParent).length > 0) {
      setActiveStops(activeStops);
      setChildToParent(childToParent);
    }
  }, [activeStops, childToParent, setActiveStops, setChildToParent]);

  return { allStops, activeStops };
}
