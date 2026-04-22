import { useCallback } from "react";
import Map from "react-map-gl/mapbox";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import "mapbox-gl/dist/mapbox-gl.css";
import { usePredictions } from "./usePredictions";
import { useVehicles } from "./useVehicles";
import { useAlerts } from "./useAlerts";
import { useStore } from "./store";
import type { Train } from "./types";
import PredictionPanel from "./PredictionPanel";
import RecommendationPanel from "./RecommendationPanel";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

// 35 Russell St, Brookline, MA
const HOME: [number, number] = [
  parseFloat(import.meta.env.VITE_HOME_LNG),
  parseFloat(import.meta.env.VITE_HOME_LAT),
];

interface StopMarker {
  name: string;
  coordinates: [number, number];
  color: [number, number, number];
}

const STOPS: StopMarker[] = [
  {
    name: "Harvard Ave (Green-B)",
    coordinates: [-71.1313, 42.3503],
    color: [0, 128, 0],
  },
  {
    name: "Coolidge Corner (Green-C)",
    coordinates: [-71.1213, 42.3424],
    color: [0, 180, 0],
  },
];

const HOME_MARKER = {
  name: "Home",
  coordinates: HOME,
  color: [30, 100, 220] as [number, number, number],
};

const INITIAL_VIEW_STATE = {
  longitude: HOME[0],
  latitude: HOME[1],
  zoom: 14.5,
  pitch: 0,
  bearing: 0,
};

const ROUTE_COLORS: Record<string, [number, number, number]> = {
  "Green-B": [0, 150, 60],
  "Green-C": [0, 180, 100],
};

function App() {
  usePredictions();
  useVehicles();
  useAlerts();

  const trains = useStore((s) => s.trains);

  const layers = [
    new ScatterplotLayer<StopMarker>({
      id: "stops",
      data: STOPS,
      getPosition: (d) => d.coordinates,
      getFillColor: (d) => d.color,
      getRadius: 40,
      radiusMinPixels: 8,
      radiusMaxPixels: 20,
      pickable: true,
    }),
    new ScatterplotLayer({
      id: "home",
      data: [HOME_MARKER],
      getPosition: (d) => d.coordinates,
      getFillColor: (d) => d.color,
      getRadius: 30,
      radiusMinPixels: 6,
      radiusMaxPixels: 14,
      pickable: true,
    }),
    new ScatterplotLayer<Train>({
      id: "trains",
      data: trains,
      getPosition: (d) => [d.longitude, d.latitude],
      getFillColor: (d) => ROUTE_COLORS[d.routeId] ?? [200, 200, 200],
      getRadius: 60,
      radiusMinPixels: 6,
      radiusMaxPixels: 16,
      pickable: true,
      stroked: true,
      getLineColor: [255, 255, 255],
      getLineWidth: 2,
      lineWidthMinPixels: 2,
      transitions: {
        getPosition: 1000,
      },
    }),
  ];

  const getTooltip = useCallback(
    ({ object }: { object?: any }) => {
      if (!object) return null;
      if (object.vehicleId) {
        return {
          text: `${object.routeId} — ${object.vehicleId}\n${object.currentStatus}`,
        };
      }
      return { text: object.name };
    },
    []
  );

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        getTooltip={getTooltip}
      >
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        />
      </DeckGL>
      <PredictionPanel />
      <RecommendationPanel />
    </div>
  );
}

export default App;
