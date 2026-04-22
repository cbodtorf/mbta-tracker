import { useState } from "react";
import { useStore } from "./store";

function minutesUntil(isoTime: string | null): number | null {
  if (!isoTime) return null;
  const diff = (new Date(isoTime).getTime() - Date.now()) / 60_000;
  return Math.round(diff);
}

function formatMinutes(mins: number | null): string {
  if (mins === null) return "—";
  if (mins <= 0) return "Now";
  return `${mins} min`;
}

const EFFECT_LABELS: Record<string, string> = {
  SHUTTLE: "Shuttle Bus",
  SUSPENSION: "Suspended",
  DETOUR: "Detour",
  STOP_CLOSURE: "Stop Closed",
  NO_SERVICE: "No Service",
};

export default function PredictionPanel() {
  const predictions = useStore((s) => s.predictions);
  const alerts = useStore((s) => s.alerts);
  const STOPS = useStore((s) => s.activeStops);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div style={panelStyle}>
      <h2 style={{ margin: "0 0 8px", fontSize: 14, color: "#fff" }}>
        Predictions
      </h2>
      {STOPS.map((stop) => {
        const open = expanded[stop.id] ?? false;
        const routeAlerts = alerts.filter((a) =>
          a.routeIds.includes(stop.route)
        );
        const stopPreds = predictions
          .filter((p) => p.stopId === stop.id)
          .sort(
            (a, b) =>
              (new Date(a.arrivalTime ?? "").getTime() || Infinity) -
              (new Date(b.arrivalTime ?? "").getTime() || Infinity)
          )
          .slice(0, 6);

        const nextMins = stopPreds.length
          ? minutesUntil(stopPreds[0].arrivalTime)
          : null;

        return (
          <div key={stop.id} style={{ marginBottom: 4 }}>
            <button onClick={() => toggle(stop.id)} style={accordionBtnStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                <span style={routeBadgeStyle}>{stop.route}</span>
                <span>{stop.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {!open && nextMins !== null && (
                  <span style={etaStyle(nextMins)}>{formatMinutes(nextMins)}</span>
                )}
                <span style={{ fontSize: 10, color: "#888" }}>{open ? "▲" : "▼"}</span>
              </div>
            </button>
            {open && (
              <div style={accordionBodyStyle}>
                {routeAlerts.map((a) => (
                  <div key={a.id} style={alertStyle}>
                    <span style={alertBadgeStyle}>
                      {EFFECT_LABELS[a.effect] ?? a.effect}
                    </span>
                    <span style={alertTextStyle}>{a.header}</span>
                  </div>
                ))}
                {stopPreds.length === 0 ? (
                  <div style={rowStyle}>No predictions</div>
                ) : (
                  stopPreds.map((p) => {
                    const mins = minutesUntil(p.arrivalTime);
                    return (
                      <div key={p.id} style={rowStyle}>
                        <span style={{ flex: 1 }}>
                          {p.vehicleId ?? p.tripId.slice(-4)}
                        </span>
                        <span style={etaStyle(mins)}>{formatMinutes(mins)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  left: 12,
  zIndex: 1,
  background: "rgba(20, 20, 30, 0.9)",
  borderRadius: 8,
  padding: "10px 12px",
  width: 240,
  fontFamily: "system-ui, sans-serif",
  fontSize: 13,
  color: "#ccc",
  backdropFilter: "blur(8px)",
};

const accordionBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  background: "none",
  border: "none",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  padding: "6px 0",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};

const accordionBodyStyle: React.CSSProperties = {
  padding: "4px 0 8px",
};

const routeBadgeStyle: React.CSSProperties = {
  background: "#00843d",
  color: "#fff",
  borderRadius: 3,
  padding: "1px 5px",
  fontSize: 11,
  fontWeight: 700,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "2px 0",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
};

function etaStyle(mins: number | null): React.CSSProperties {
  let color = "#4ade80";
  if (mins !== null && mins <= 3) color = "#f87171";
  else if (mins !== null && mins <= 6) color = "#facc15";
  return { fontWeight: 700, color, fontSize: 13 };
}

const alertStyle: React.CSSProperties = {
  background: "rgba(248, 113, 113, 0.15)",
  border: "1px solid rgba(248, 113, 113, 0.4)",
  borderRadius: 4,
  padding: "4px 8px",
  marginBottom: 4,
  fontSize: 11,
  lineHeight: "1.4",
  color: "#fca5a5",
  display: "flex",
  alignItems: "flex-start",
  gap: 6,
};

const alertTextStyle: React.CSSProperties = {
  flex: 1,
  wordWrap: "break-word",
  overflowWrap: "break-word",
};

const alertBadgeStyle: React.CSSProperties = {
  background: "#dc2626",
  color: "#fff",
  borderRadius: 3,
  padding: "1px 5px",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  flexShrink: 0,
};
