import { useEffect, useRef } from "react";
import { useStore } from "./store";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
const DEBOUNCE_MS = 800;

export function useWalkTimes() {
  const home = useStore((s) => s.home);
  const activeStops = useStore((s) => s.activeStops);
  const setWalkTimes = useStore((s) => s.setWalkTimes);
  const setWalkRoutes = useStore((s) => s.setWalkRoutes);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (activeStops.length === 0) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const origin = `${home[0]},${home[1]}`;

      Promise.all(
        activeStops.map((stop) => {
          const dest = `${stop.coordinates[0]},${stop.coordinates[1]}`;
          const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${origin};${dest}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;

          return fetch(url)
            .then((res) => res.json())
            .then((json) => {
              const route = json.routes?.[0];
              if (!route) return null;
              const coords: [number, number][] =
                route.geometry?.coordinates ?? [];
              return {
                stopId: stop.id,
                minutes: Math.round(route.duration / 60),
                path: coords,
              };
            })
            .catch(() => null);
        })
      ).then((results) => {
        const times: Record<string, number> = {};
        const routes: { stopId: string; path: [number, number][] }[] = [];
        for (const r of results) {
          if (r) {
            times[r.stopId] = r.minutes;
            routes.push({ stopId: r.stopId, path: r.path });
          }
        }
        setWalkTimes(times);
        setWalkRoutes(routes);
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [home, activeStops, setWalkTimes, setWalkRoutes]);
}
