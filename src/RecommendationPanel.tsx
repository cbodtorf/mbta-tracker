import { useRecommendation, type StopRecommendation } from "./useRecommendation";

function urgencyColor(buffer: number | null): string {
  if (buffer === null) return "#6b7280"; // gray
  if (buffer < 3) return "#ef4444"; // red
  if (buffer < 6) return "#eab308"; // yellow
  return "#22c55e"; // green
}

function urgencyBg(buffer: number | null): string {
  if (buffer === null) return "rgba(107,114,128,0.15)";
  if (buffer < 3) return "rgba(239,68,68,0.15)";
  if (buffer < 6) return "rgba(234,179,8,0.12)";
  return "rgba(34,197,94,0.12)";
}

function StopCard({ rec, isBest }: { rec: StopRecommendation; isBest: boolean }) {
  const border = isBest
    ? `2px solid ${urgencyColor(rec.bufferMinutes)}`
    : "1px solid rgba(255,255,255,0.1)";

  return (
    <div
      style={{
        background: urgencyBg(rec.bufferMinutes),
        border,
        borderRadius: 6,
        padding: "10px 12px",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color: "#fff" }}>
          {isBest && "→ "}
          {rec.stopName}
        </span>
        <span
          style={{
            background: "#00843d",
            color: "#fff",
            borderRadius: 3,
            padding: "1px 5px",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {rec.route}
        </span>
      </div>
      {!rec.catchable && rec.nextTrainArrivesIn !== null && (
        <div style={{ fontSize: 11, color: "#f87171", marginBottom: 4 }}>
          Next train in {rec.nextTrainArrivesIn}m — can't make it (need {rec.walkMinutes ?? "?"}m walk)
        </div>
      )}
      <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
        <span>
          Walk: <strong>{rec.walkMinutes !== null ? `${rec.walkMinutes}m` : "..."}</strong>
        </span>
        <span>
          {rec.catchable ? "Train" : "Next catchable"}:{" "}
          <strong>
            {rec.trainArrivesIn !== null ? `${rec.trainArrivesIn}m` : "—"}
          </strong>
        </span>
        <span style={{ color: urgencyColor(rec.bufferMinutes) }}>
          Buffer:{" "}
          <strong>
            {rec.bufferMinutes !== null ? `${rec.bufferMinutes}m` : "—"}
          </strong>
        </span>
      </div>
    </div>
  );
}

export default function RecommendationPanel() {
  const { best, all, leaveNow } = useRecommendation();

  return (
    <div style={panelStyle}>
      {leaveNow && (
        <div style={leaveNowStyle}>LEAVE NOW</div>
      )}
      {best ? (
        <div style={{ marginBottom: 8, color: "#fff", fontWeight: 600, fontSize: 14 }}>
          Walk to {best.stopName} — {best.bufferMinutes}m buffer
        </div>
      ) : (
        <div style={{ marginBottom: 8, color: "#9ca3af", fontSize: 14 }}>
          No trains available
        </div>
      )}
      {[...all]
        .sort((a, b) => {
          if (a.catchable !== b.catchable) return a.catchable ? -1 : 1;
          return (a.walkMinutes ?? Infinity) - (b.walkMinutes ?? Infinity);
        })
        .map((rec) => (
        <StopCard
          key={rec.stopId}
          rec={rec}
          isBest={best?.stopId === rec.stopId}
        />
      ))}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 12,
  left: 12,
  zIndex: 1,
  background: "rgba(20, 20, 30, 0.92)",
  borderRadius: 8,
  padding: "14px 16px",
  minWidth: 260,
  maxWidth: 320,
  fontFamily: "system-ui, sans-serif",
  fontSize: 14,
  color: "#ccc",
  backdropFilter: "blur(8px)",
};

const leaveNowStyle: React.CSSProperties = {
  background: "#dc2626",
  color: "#fff",
  fontWeight: 800,
  fontSize: 16,
  textAlign: "center",
  padding: "6px 0",
  borderRadius: 4,
  marginBottom: 10,
  letterSpacing: 1,
  animation: "pulse 1.5s infinite",
};
