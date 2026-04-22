import { useStore, STOPS } from "./store";

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

  return (
    <div style={panelStyle}>
      <h2 style={{ margin: "0 0 12px", fontSize: 16, color: "#fff" }}>
        Inbound Predictions
      </h2>
      {STOPS.map((stop) => {
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
          .slice(0, 4);

        return (
          <div key={stop.id} style={{ marginBottom: 16 }}>
            <div style={stopHeaderStyle}>
              <span style={routeBadgeStyle(stop.route)}>{stop.route}</span>
              <span>{stop.name}</span>
            </div>
            {routeAlerts.map((a) => (
              <div key={a.id} style={alertStyle}>
                <span style={alertBadgeStyle}>
                  {EFFECT_LABELS[a.effect] ?? a.effect}
                </span>
                <span>{a.header}</span>
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
  padding: "14px 16px",
  minWidth: 220,
  fontFamily: "system-ui, sans-serif",
  fontSize: 14,
  color: "#ccc",
  backdropFilter: "blur(8px)",
};

const stopHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 600,
  color: "#fff",
  marginBottom: 6,
};

function routeBadgeStyle(route: string): React.CSSProperties {
  return {
    background: route === "Green-B" ? "#00843d" : "#00843d",
    color: "#fff",
    borderRadius: 4,
    padding: "1px 6px",
    fontSize: 12,
    fontWeight: 700,
  };
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "3px 0",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

function etaStyle(mins: number | null): React.CSSProperties {
  let color = "#4ade80"; // green
  if (mins !== null && mins <= 3) color = "#f87171"; // red
  else if (mins !== null && mins <= 6) color = "#facc15"; // yellow
  return { fontWeight: 700, color };
}

const alertStyle: React.CSSProperties = {
  background: "rgba(248, 113, 113, 0.15)",
  border: "1px solid rgba(248, 113, 113, 0.4)",
  borderRadius: 4,
  padding: "4px 8px",
  marginBottom: 6,
  fontSize: 12,
  lineHeight: "1.4",
  color: "#fca5a5",
};

const alertBadgeStyle: React.CSSProperties = {
  background: "#dc2626",
  color: "#fff",
  borderRadius: 3,
  padding: "1px 5px",
  fontSize: 10,
  fontWeight: 700,
  marginRight: 6,
  textTransform: "uppercase",
};
