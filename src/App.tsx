import { useCallback, useState } from "react";
import Map from "react-map-gl/mapbox";
import DeckGL from "@deck.gl/react";
import { IconLayer, PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import "mapbox-gl/dist/mapbox-gl.css";
import { usePredictions } from "./usePredictions";
import { useVehicles } from "./useVehicles";
import { useAlerts } from "./useAlerts";
import { useStore } from "./store";
import { useStops } from "./useStops";
import type { Train } from "./types";
import { useRouteShapes, type RouteShape } from "./useRouteShapes";
import { useWalkTimes } from "./useWalkTimes";
import PredictionPanel from "./PredictionPanel";
import RecommendationPanel from "./RecommendationPanel";
import { useSlackAlert } from "./useSlackAlert";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

interface StopMarker {
  name: string;
  coordinates: [number, number];
  color: [number, number, number];
}

const ROUTE_COLORS: Record<string, [number, number, number]> = {
  "Green-B": [120, 200, 155],
  "Green-C": [80, 190, 180],
  "Green-D": [150, 210, 130],
  "Green-E": [100, 185, 145],
};

const WALK_COLORS: Record<string, [number, number, number, number]> = {
  "Green-B": [170, 140, 210, 200],
  "Green-C": [130, 160, 220, 200],
  "Green-D": [180, 155, 195, 200],
  "Green-E": [145, 145, 210, 200],
};


function App() {
  useStops();
  useWalkTimes();
  usePredictions();
  useVehicles();
  useAlerts();
  useSlackAlert();

  const home = useStore((s) => s.home);
  const setHome = useStore((s) => s.setHome);
  const alertArmed = useStore((s) => s.alertArmed);
  const setAlertArmed = useStore((s) => s.setAlertArmed);
  const alertFired = useStore((s) => s.alertFired);
  const trains = useStore((s) => s.trains);
  const predictions = useStore((s) => s.predictions);
  const activeStops = useStore((s) => s.activeStops);
  const routeShapes = useRouteShapes();

  const stopMarkers: StopMarker[] = activeStops.map((s) => ({
    name: `${s.name} (${s.route})`,
    coordinates: s.coordinates,
    color: ROUTE_COLORS[s.route] ?? [0, 150, 60],
  }));

  const walkRoutes = useStore((s) => s.walkRoutes);
  const [picking, setPicking] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const layers = [
    new PathLayer<RouteShape>({
      id: "route-lines",
      data: routeShapes,
      getPath: (d: RouteShape) => d.path,
      getColor: (d: RouteShape) => ROUTE_COLORS[d.routeId] ?? [200, 200, 200],
      getWidth: 4,
      widthMinPixels: 2,
      widthMaxPixels: 6,
      getDashArray: [8, 4],
      dashJustified: true,
      extensions: [new PathStyleExtension({ dash: true })],
    } as any),
    new PathLayer({
      id: "walk-routes",
      data: walkRoutes,
      getPath: (d: any) => d.path,
      getColor: (d: any) => {
        const stop = activeStops.find((s) => s.id === d.stopId);
        return WALK_COLORS[stop?.route ?? ""] ?? [160, 150, 210, 200];
      },
      getWidth: 3,
      widthMinPixels: 2,
      widthMaxPixels: 5,
      getDashArray: [4, 3],
      dashJustified: true,
      extensions: [new PathStyleExtension({ dash: true })],
    } as any),
    new IconLayer({
      id: "home",
      data: [{ coordinates: home }],
      getPosition: (d: any) => d.coordinates,
      getIcon: () => ({
        url: "/home-icon.svg",
        width: 48,
        height: 48,
        anchorY: 48,
      }),
      getSize: 40,
      sizeMinPixels: 28,
      sizeMaxPixels: 48,
      pickable: true,
    }),
    new ScatterplotLayer<StopMarker>({
      id: "stops",
      data: stopMarkers,
      getPosition: (d) => d.coordinates,
      getFillColor: (d) => d.color,
      getRadius: 40,
      radiusMinPixels: 8,
      radiusMaxPixels: 20,
      pickable: true,
    }),
    new IconLayer<Train>({
      id: "trains",
      data: trains,
      getPosition: (d) => [d.longitude, d.latitude],
      getIcon: (d) => ({
        url: `/train-icon-${d.routeId.toLowerCase()}.svg`,
        width: 64,
        height: 64,
        anchorY: 32,
      }),
      getSize: 36,
      sizeMinPixels: 24,
      sizeMaxPixels: 48,
      getAngle: (d) => -d.bearing,
      pickable: true,
      transitions: {
        getPosition: 1000,
        getAngle: 1000,
      },
    }),
  ];

  const getTooltip = useCallback(
    ({ object, layer }: { object?: any; layer?: any }) => {
      if (!object) return null;
      if (layer?.id === "home") return null;
      if (object.vehicleId) {
        const vehiclePreds = predictions
          .filter((p) => p.vehicleId === object.vehicleId && p.arrivalTime)
          .map((p) => {
            const stop = activeStops.find((s) => s.id === p.stopId);
            const mins = Math.round(
              (new Date(p.arrivalTime!).getTime() - Date.now()) / 60_000
            );
            return { stopName: stop?.name ?? p.stopId, mins };
          })
          .filter((p) => p.mins > 0)
          .sort((a, b) => a.mins - b.mins);

        const etas = vehiclePreds
          .map((p) => `${p.stopName}: ${p.mins} min`)
          .join("\n");

        return {
          text: `${object.routeId} — ${object.vehicleId}\n${object.currentStatus}${etas ? "\n" + etas : ""}`,
        };
      }
      return { text: object.name };
    },
    [predictions, activeStops]
  );

  const onClick = useCallback(
    (info: any) => {
      if (picking && info.coordinate) {
        setHome([info.coordinate[0], info.coordinate[1]]);
        setPicking(false);
        return true;
      }
      return false;
    },
    [picking, setHome]
  );

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <DeckGL
        initialViewState={{
          longitude: home[0],
          latitude: home[1],
          zoom: 14,
          pitch: 0,
          bearing: 0,
        }}
        controller={true}
        layers={layers}
        getTooltip={picking ? undefined : getTooltip}
        onClick={onClick}
        getCursor={() => (picking ? "crosshair" : "auto")}
      >
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle={darkMode
            ? "mapbox://styles/mapbox/dark-v11"
            : "mapbox://styles/mapbox/streets-v12"
          }
        />
      </DeckGL>
      <PredictionPanel />
      <RecommendationPanel />
      <HomePanel
        home={home}
        picking={picking}
        onPickStart={() => setPicking(true)}
        onCancel={() => setPicking(false)}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
        alertArmed={alertArmed}
        alertFired={alertFired}
        onToggleAlert={() => setAlertArmed(!alertArmed)}
      />
    </div>
  );
}

function HomePanel({
  home,
  picking,
  onPickStart,
  onCancel,
  darkMode,
  onToggleDark,
  alertArmed,
  alertFired,
  onToggleAlert,
}: {
  home: [number, number];
  picking: boolean;
  onPickStart: () => void;
  onCancel: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
  alertArmed: boolean;
  alertFired: boolean;
  onToggleAlert: () => void;
}) {
  return (
    <div style={homePanelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>
          Home
        </div>
        <button
          onClick={onToggleDark}
          style={{
            background: "none",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 14,
            cursor: "pointer",
            color: "#fff",
          }}
          title={darkMode ? "Light mode" : "Dark mode"}
        >
          {darkMode ? "\u2600" : "\u263E"}
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#aaa", marginBottom: 8 }}>
        {home[1].toFixed(4)}, {home[0].toFixed(4)}
      </div>
      {picking ? (
        <div>
          <div style={{ fontSize: 12, color: "#facc15", marginBottom: 6 }}>
            Click map to set location
          </div>
          <button onClick={onCancel} style={btnStyle("#6b7280")}>
            Cancel
          </button>
        </div>
      ) : (
        <>
          <button onClick={onPickStart} style={btnStyle("#3b82f6")}>
            Move Home
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 10,
              paddingTop: 8,
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <button
              onClick={onToggleAlert}
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                border: "none",
                background: alertArmed ? "#22c55e" : "#4b5563",
                position: "relative",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  left: alertArmed ? 18 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  background: "#fff",
                  transition: "left 0.2s",
                }}
              />
            </button>
            <span style={{ fontSize: 11, color: "#ccc" }}>
              {alertFired ? "Alert sent!" : alertArmed ? "Alert armed" : "Slack alert"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

const homePanelStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  zIndex: 1,
  background: "rgba(20, 20, 30, 0.92)",
  borderRadius: 8,
  padding: "10px 14px",
  fontFamily: "system-ui, sans-serif",
  backdropFilter: "blur(8px)",
};

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}

export default App;
