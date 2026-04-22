# MBTA Green Line Transit Tracker

Real-time transit dashboard that tracks inbound Green Line trains (B/C/D/E) and recommends which stop to walk to based on live predictions and walking time.

## Quick Start

```bash
npm run dev      # start dev server
npm run build    # typecheck + production build
npm run lint     # eslint
```

Requires `.env` with `VITE_MAPBOX_TOKEN`, `VITE_MBTA_API_KEY` (optional but recommended for rate limits), `VITE_HOME_LAT`, `VITE_HOME_LNG`.

## Tech Stack

- **Vite + React 19 + TypeScript 6** — scaffold and build
- **Deck.gl 9** — WebGL map layers (IconLayer, PathLayer, ScatterplotLayer)
- **Mapbox GL JS** via `react-map-gl` — basemap (streets + dark mode)
- **Zustand** — global state with devtools middleware (inspect at `window.__ZUSTAND_DEVTOOLS__` or Redux DevTools extension)
- **MBTA V3 API** — predictions, vehicles, stops, alerts, shapes (REST + SSE)
- **Mapbox Directions API** — walking times and route geometry

## Architecture

### Data Flow

```
MBTA API ──→ useStops ──→ activeStops + childToParent ──→ Store
MBTA SSE ──→ usePredictions ──→ predictions ──→ Store
MBTA SSE ──→ useVehicles ──→ trains ──→ Store
MBTA API ──→ useAlerts (5min poll) ──→ alerts ──→ Store
Mapbox   ──→ useWalkTimes (debounced) ──→ walkTimes + walkRoutes ──→ Store

Store ──→ useRecommendation (derived, 15s tick) ──→ UI
Store ──→ App (DeckGL layers) ──→ Map
Store ──→ PredictionPanel / RecommendationPanel ──→ Overlays
```

### Key Design Decisions

**SSE for predictions and vehicles, polling for alerts.** Predictions and vehicle positions change every few seconds — SSE gives sub-second updates without polling overhead. Alerts change rarely, so 5-minute polling is sufficient and simpler.

**Child-to-parent stop mapping.** MBTA's stop hierarchy is a major complexity driver. Parent stops (`place-cool`) represent stations, child stops (`70220`) represent platforms. The API's `filter[route]` returns parent stops, but predictions reference child stops. We fetch with `include=child_stops` and maintain a `childToParent` mapping in the store to normalize prediction stop IDs back to parent IDs. This mapping must be populated before predictions are fetched — `usePredictions` guards on `hasChildMap`.

**Closest stop per route.** Rather than hardcoding stops, `useStops` calculates the nearest station per Green Line branch using haversine distance from the home location. When home moves, stops recalculate, SSE streams reconnect to new stop IDs, and walk times re-fetch.

**Mapbox Directions for walk times.** Early versions used haversine distance with a detour factor, but this was inaccurate (straight-line vs actual walking path). Mapbox Directions API gives real walking times and route geometry. Debounced 800ms to avoid hammering the API during home relocation.

**Recommendation ranking: shortest walk among catchable.** A train is "catchable" if its ETA >= walk time to that stop. Among catchable options, we pick the shortest walk (not largest buffer) because a 13-min walk with 2-min buffer beats a 25-min walk with 5-min buffer. Falls back to showing uncatchable trains with context when nothing is catchable.

**Per-route train icons via separate SVGs.** Deck.gl IconLayer renders into WebGL texture atlases, not DOM — CSS can't style them. `getColor` tint multiplies against pixel values, which muddles multi-colored icons. Separate SVGs per route give exact color control. Alternative: monochrome white icon + getColor tint.

**Click-to-place home location.** DeckGL's canvas overlay intercepts all pointer events, making traditional Mapbox marker dragging unreliable. The "Move Home" button + crosshair click-to-place pattern works cleanly with DeckGL's event model.

## File Map

```
src/
├── App.tsx                 # Main component, DeckGL layers, HomePanel
├── main.tsx                # React entry point
├── types.ts                # Prediction, Stop, Train, Alert interfaces
├── store.ts                # Zustand store (all shared state)
├── useStops.ts             # Fetch stops, find closest per route, child→parent map
├── usePredictions.ts       # SSE stream for arrival predictions
├── useVehicles.ts          # SSE stream for train positions
├── useAlerts.ts            # Poll service alerts every 5min
├── useRouteShapes.ts       # Fetch + decode route polylines
├── useWalkTimes.ts         # Mapbox Directions walking API
├── useRecommendation.ts    # Recommendation engine (derived state)
├── PredictionPanel.tsx     # Top-left overlay: per-stop predictions + alerts
└── RecommendationPanel.tsx # Bottom-left overlay: ranked stop recommendations
public/
├── home-icon.svg           # Blue location pin
├── train-icon-green-{b,c,d,e}.svg  # Per-route pastel train icons
└── train-icon.svg          # Legacy (unused, kept for fallback)
```

## Error Handling

**Strategy: graceful degradation.** No single API failure should crash the app or block other data streams.

| Layer | Pattern | Behavior on failure |
|-------|---------|-------------------|
| SSE event handlers | `try/catch` with silent ignore | Malformed SSE message skipped, stream continues |
| SSE connection | `es.onerror = () => {}` | Browser EventSource auto-reconnects with backoff |
| Initial fetches | `.catch(console.error)` | Logged, UI shows empty state until next successful fetch |
| Per-route fetches | `Promise.all` + per-item `.catch(() => null/[])` | One route failing doesn't block others |
| Walk time API | `.catch(() => null)` per stop, debounced | Failed stop shows "..." in UI, others still calculate |
| Missing data | `??` / nullish coalescing throughout | Null vehicleId, arrivalTime, bearing all have safe fallbacks |

**What is NOT handled (improvement opportunities):**
- No retry logic beyond SSE auto-reconnect — if the initial fetch fails, data stays empty until page refresh
- No user-visible error states (toasts, banners) — failures are silent except in console
- No offline detection — if network drops, SSE reconnects but no UI indicator
- API rate limiting (MBTA returns 429) — no backoff strategy on fetch endpoints
- Mapbox token expiry — would silently fail with no map tiles

## Optimization Opportunities

**Performance:**
- `useRecommendation` recalculates every 15s via `setInterval` tick — could use `requestAnimationFrame` or only recalc when predictions actually change
- Each `useStore` selector in App.tsx causes re-render on any selected slice change — the `layers` array is rebuilt every render. Could memoize individual layers
- Walk routes PathLayer uses `getColor` as a function (per-object evaluation) — could pre-compute colors into the data array for better GPU performance
- Route shapes are fetched on every mount — could cache in localStorage since they rarely change

**Features:**
- Direction filtering: currently shows all directions. Could filter to inbound-only if user preference is set
- Multiple home locations / saved locations
- Trip planning: "I need to be at X by Y" → work backwards from destination
- Historical accuracy: track prediction accuracy over time
- Push notifications via service worker when buffer drops below threshold

**Reliability:**
- Add retry with exponential backoff on initial fetches
- Show connection status indicator (SSE connected/reconnecting/disconnected)
- Add error boundary around panels so a rendering error doesn't blank the whole app
- Validate API responses with zod or similar before parsing
- Handle MBTA API maintenance windows (they return HTML error pages, not JSON)
