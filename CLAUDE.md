# MBTA Green Line Transit Tracker

Real-time transit dashboard that tracks inbound Green Line trains (B/C/D/E) and recommends which stop to walk to based on live predictions and walking time. Sends Slack alerts when it's time to leave.

## Development Guidelines

**Always run `npm run build` (not just `tsc --noEmit`) before considering a change done.** The build is stricter — it catches implicit `any` from `as any` casts, Set spread type issues, and React 19's stricter `useRef` signature.

**Keep this CLAUDE.md updated when:**
- Adding or removing files (update File Map)
- Adding new layers, hooks, or store slices (update Architecture / Data Flow)
- Changing error handling patterns (update Error Handling table)
- Adding new external API calls or env vars (update Tech Stack / Quick Start)
- Making design decisions worth documenting (update Key Design Decisions)

**Deck.gl typing quirks:**
- `PathStyleExtension` adds `getDashArray` and `dashJustified` props that don't exist in PathLayer's type defs. Use `as any` on the props object but add explicit parameter types to callback functions (e.g. `(d: RouteShape) =>`) since `as any` loses type inference.
- `TextLayer` props like `outlineWidth`, `outlineColor`, `fontWeight` also need `as any`.
- React 19 requires `useRef<T>(undefined)` instead of `useRef<T>()`.

**Variable ordering matters:** hooks and derived state must be defined before anything that references them. `const` in the same function scope uses temporal dead zones — referencing `best` before `useRecommendation()` is called will throw at runtime even though `tsc --noEmit` may not catch it.

## Quick Start

```bash
npm run dev      # start dev server
npm run build    # typecheck + production build (ALWAYS run this)
npm run lint     # eslint
```

Requires `.env` — see `.env.example` for all variables:
- `VITE_MAPBOX_TOKEN` — required, Mapbox GL + Directions API
- `VITE_MBTA_API_KEY` — optional, recommended for rate limits
- `VITE_HOME_LAT` / `VITE_HOME_LNG` — default home location
- `SLACK_WEBHOOK_URL` — server-side only, for Vercel serverless function

## Deploy

Configured for Vercel (`vercel.json`). The `api/slack.ts` serverless function proxies Slack webhook calls to keep the URL server-side.

```bash
npx vercel                    # deploy preview
npx vercel --prod             # deploy production
```

Set `SLACK_WEBHOOK_URL` in Vercel environment variables (not prefixed with `VITE_`).

## Tech Stack

- **Vite + React 19 + TypeScript 6** — scaffold and build
- **Deck.gl 9** — WebGL map layers (IconLayer, PathLayer, ScatterplotLayer, TextLayer)
- **Mapbox GL JS** via `react-map-gl` — basemap (streets-v12 light / dark-v11 dark mode)
- **Zustand** — global state with devtools middleware (Redux DevTools extension)
- **MBTA V3 API** — predictions, vehicles, stops, alerts, shapes (REST + SSE)
- **Mapbox Directions API** — walking times and route geometry
- **Vercel** — hosting + serverless function for Slack webhook proxy

## Architecture

### Data Flow

```
MBTA API ──→ useStops ──→ activeStops + childToParent ──→ Store
MBTA SSE ──→ usePredictions ──→ predictions ──→ Store
MBTA SSE ──→ useVehicles ──→ trains ──→ Store
MBTA API ──→ useAlerts (5min poll) ──→ alerts ──→ Store
Mapbox   ──→ useWalkTimes (debounced) ──→ walkTimes + walkRoutes ──→ Store

Store ──→ useRecommendation (derived, 15s tick) ──→ best/all/leaveNow
Store ──→ useSlackAlert (fires when armed + leaveNow) ──→ /api/slack ──→ Slack

Store + useRecommendation ──→ App (DeckGL layers) ──→ Map
Store ──→ PredictionPanel / RecommendationPanel ──→ Overlays
```

### Map Layers (render order, bottom to top)

1. **route-lines** — PathLayer, dashed, per-route pastel green
2. **walk-routes** — PathLayer, dashed, per-route lavender (recommended path: bright cyan, wider)
3. **home** — IconLayer, blue location pin SVG
4. **stop-highlights** — ScatterplotLayer, glowing cyan ring behind recommended stop
5. **stops** — ScatterplotLayer, per-route pastel green dots
6. **walk-labels** — TextLayer, stop name + walk time at midpoint of each walk path (recommended: brighter, larger)
7. **trains** — IconLayer, per-route pastel SVGs with bearing rotation + position transitions

### Color System

**Route lines and stop dots** — distinct pastel greens:
| Route | RGB | Hex |
|-------|-----|-----|
| Green-B | 120, 200, 155 | `#78c89b` (mint) |
| Green-C | 80, 190, 180 | `#50beb4` (teal) |
| Green-D | 150, 210, 130 | `#96d282` (lime-sage) |
| Green-E | 100, 185, 145 | `#64b991` (sea green) |

**Walk paths** — lavender/periwinkle, keyed to destination route:
| Route | RGBA |
|-------|------|
| Green-B | 170, 140, 210, 200 |
| Green-C | 130, 160, 220, 200 |
| Green-D | 180, 155, 195, 200 |
| Green-E | 145, 145, 210, 200 |

**Recommendation highlight** — bright cyan `[100, 200, 255]` for recommended walk path, stop ring, and label.

**Train icons** — per-route SVGs matching route pastel colors. Separate SVGs because Deck.gl IconLayer renders into WebGL texture atlases (not DOM), and `getColor` tint multiplies against pixel values which muddles multi-colored icons.

### Key Design Decisions

**SSE for predictions and vehicles, polling for alerts.** Predictions and vehicle positions change every few seconds — SSE gives sub-second updates without polling overhead. Alerts change rarely, so 5-minute polling is sufficient and simpler.

**Child-to-parent stop mapping.** MBTA's stop hierarchy is a major complexity driver. Parent stops (`place-cool`) represent stations, child stops (`70220`) represent platforms. The API's `filter[route]` returns parent stops, but predictions reference child stops. We fetch with `include=child_stops` and maintain a `childToParent` mapping in the store to normalize prediction stop IDs back to parent IDs. This mapping must be populated before predictions are fetched — `usePredictions` guards on `hasChildMap`.

**Closest stop per route.** Rather than hardcoding stops, `useStops` calculates the nearest station per Green Line branch using haversine distance from the home location. When home moves, stops recalculate, SSE streams reconnect to new stop IDs, and walk times re-fetch.

**Mapbox Directions for walk times.** Early versions used haversine distance with a detour factor, but this was inaccurate (straight-line vs actual walking path). Mapbox Directions API gives real walking times and route geometry. Debounced 800ms to avoid hammering the API during home relocation.

**Recommendation ranking: shortest walk among catchable.** A train is "catchable" if its ETA >= walk time to that stop. Among catchable options, we pick the shortest walk (not largest buffer) because a 13-min walk with 2-min buffer beats a 25-min walk with 5-min buffer. Falls back to showing uncatchable trains with context when nothing is catchable.

**Click-to-place home location.** DeckGL's canvas overlay intercepts all pointer events, making traditional Mapbox marker dragging unreliable. The "Move Home" button + crosshair click-to-place pattern works cleanly with DeckGL's event model.

**Slack alert via serverless proxy.** The webhook URL is a secret that shouldn't be in client code. `api/slack.ts` is a Vercel serverless function that reads `SLACK_WEBHOOK_URL` from server-side env and forwards the message. The client POSTs to `/api/slack` with `{ text }`. Alert fires once per arm cycle — `alertFired` prevents duplicates, and re-arming resets the flag.

## File Map

```
src/
├── App.tsx                 # Main component, DeckGL layers, HomePanel, dark mode
├── main.tsx                # React entry point
├── types.ts                # Prediction, Stop, Train, Alert interfaces
├── store.ts                # Zustand store (all shared state + alertArmed/alertFired)
├── useStops.ts             # Fetch stops, find closest per route, child→parent map
├── usePredictions.ts       # SSE stream for arrival predictions
├── useVehicles.ts          # SSE stream for train positions
├── useAlerts.ts            # Poll service alerts every 5min
├── useRouteShapes.ts       # Fetch + decode route polylines
├── useWalkTimes.ts         # Mapbox Directions walking API
├── useRecommendation.ts    # Recommendation engine (derived state)
├── useSlackAlert.ts        # Fires Slack webhook when armed + leaveNow
├── PredictionPanel.tsx     # Top-left overlay: per-stop predictions + alerts
└── RecommendationPanel.tsx # Bottom-left overlay: ranked stop recommendations
api/
└── slack.ts                # Vercel serverless function: Slack webhook proxy
public/
├── home-icon.svg           # Blue location pin with glow
├── train-icon-green-{b,c,d,e}.svg  # Per-route pastel train icons
└── train-icon.svg          # Legacy (unused, kept for fallback)
.env.example                # Documents all required/optional env vars
vercel.json                 # Vercel deploy config
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
| Slack alert | `.catch(console.error)` + `pendingRef` guard | Logged, no duplicate requests, can re-arm to retry |
| Missing data | `??` / nullish coalescing throughout | Null vehicleId, arrivalTime, bearing all have safe fallbacks |

**What is NOT handled (improvement opportunities):**
- No retry logic beyond SSE auto-reconnect — if the initial fetch fails, data stays empty until page refresh
- No user-visible error states (toasts, banners) — failures are silent except in console
- No offline detection — if network drops, SSE reconnects but no UI indicator
- API rate limiting (MBTA returns 429) — no backoff strategy on fetch endpoints
- Mapbox token expiry — would silently fail with no map tiles
- Slack webhook failure — logged but no user notification beyond "Alert sent!" not appearing

## Optimization Opportunities

**Performance:**
- `useRecommendation` recalculates every 15s via `setInterval` tick — could use `requestAnimationFrame` or only recalc when predictions actually change
- Each `useStore` selector in App.tsx causes re-render on any selected slice change — the `layers` array is rebuilt every render. Could memoize individual layers
- Walk routes PathLayer uses `getColor` as a function (per-object evaluation) — could pre-compute colors into the data array for better GPU performance
- Route shapes are fetched on every mount — could cache in localStorage since they rarely change
- TextLayer `walk-labels` rebuilds data array every render — could memoize

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
