import { useCallback, useMemo } from "react";
import Map from "react-map-gl/mapbox";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import "mapbox-gl/dist/mapbox-gl.css";

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

function App() {
  const layers = useMemo(
    () => [
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
    ],
    []
  );

  const getTooltip = useCallback(
    ({ object }: { object?: StopMarker | typeof HOME_MARKER }) => {
      if (!object) return null;
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
    </div>
  );
}

export default App;
