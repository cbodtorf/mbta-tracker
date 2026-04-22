# MBTA Transit Tracker — Spec

## Concept
A personal transit dashboard that tracks inbound Green Line trains 
at two stops near home — Harvard Ave (B branch) and Coolidge Corner 
(C branch) — and recommends which stop to walk to in order to catch 
the next train. Sends a Slack alert when it's time to leave.

Built with real-time MBTA data, Deck.gl, and Mapbox. Demonstrates 
live geospatial data pipelines and multi-entity state management 
for a HavocAI interview.

## Tech Stack
- Vite + React + TypeScript
- Deck.gl (ScatterplotLayer, IconLayer, PathLayer)
- Mapbox GL JS (satellite or streets basemap)
- MBTA V3 API (REST + Server-Sent Events for real-time predictions)
- Zustand (app state)
- Tailwind CSS (UI)
- Slack Incoming Webhooks (alerts)

## Key Data Sources

### MBTA V3 API (no API key required for basic use)
- Predictions endpoint: 
  `GET /predictions?filter[stop]=place-harvardave,place-cool&filter[direction_id]=1&filter[route]=Green-B,Green-C`
- Vehicles endpoint (train positions):
  `GET /vehicles?filter[route]=Green-B,Green-C`
- Both support Server-Sent Events (SSE) for push updates — 
  prefer this over polling

### Stop Coordinates (for map + walk time calc)
- Harvard Ave (Green-B): 42.3503, -71.1313
- Coolidge Corner (Green-C): 42.3424, -71.1213
- Home coords: to be set in .env

## Core Features

### 1. Live Map
- Mapbox streets basemap centered on Brookline/Allston
- Your home location pinned
- Both stops pinned with walking distance labels
- Inbound trains rendered as moving icons on the actual track,
  updated in real time via MBTA SSE stream
- Train cards showing: route, vehicle ID, current status, 
  minutes until arrival at each stop

### 2. Stop Recommendation Engine
For each stop, calculate:
  - Walk time from home (straight-line or fixed estimate in minutes)
  - Next train arrival time (from MBTA predictions)
  - Buffer = arrival time - walk time
  
Recommend the stop where buffer is largest (most time to spare).
If both buffers are under 3 minutes, flag as "leave now" state.

### 3. Slack Alert
- User sets a target departure time (or "alert me when I need to leave")
- When the best stop's buffer hits 3 minutes, fire a Slack 
  Incoming Webhook message:
  `"🚨 Leave now → Harvard Ave. Green-B arrives in 6 min. 
    You have a 3-min walk."`
- Delivered via a lightweight Netlify/Vercel serverless function 
  to keep the Slack webhook secret off the client

## App State (Zustand)

```ts
{
  trains: Train[]          // live vehicle positions + predictions
  stops: Stop[]            // Harvard Ave + Coolidge Corner, static
  recommendation: {
    stopId: string
    bufferMinutes: number
    trainArrivesIn: number
  } | null
  alertArmed: boolean      // user has enabled the leave alert
  alertFired: boolean      // prevent duplicate Slack messages
}
```

## 10-Day Build Plan

### Days 1–2 — Foundation
Vite + React + TypeScript. Mapbox streets basemap centered on 
Brookline. Pin home location and both stops as static markers 
via Deck.gl IconLayer. No live data yet — just confirm the map 
renders correctly and stops are in the right place.

### Days 3–4 — Live Train Data
Connect to MBTA SSE stream for predictions at both stops 
(inbound, Green-B and Green-C). Parse arrival times. Render 
a simple list of upcoming trains per stop. No map rendering 
of trains yet.

### Days 5–6 — Train Positions on Map
Connect to MBTA vehicles SSE stream. Render moving train icons 
on the map using Deck.gl ScatterplotLayer or IconLayer. Trains 
should update position in real time as MBTA pushes updates.

### Days 7–8 — Recommendation Engine + UI
Calculate walk time and buffer for each stop. Display a clear 
recommendation panel: which stop to walk to, how long you have, 
next train ETA. Highlight urgency visually (green → yellow → red) 
as buffer shrinks.

### Days 9–10 — Slack Alert + Deploy
Add "Arm Alert" toggle. When armed and buffer hits 3 minutes, 
POST to a Vercel serverless function that forwards to Slack 
Incoming Webhook. Deploy full app to Vercel. Add a .env.example 
documenting required tokens (Mapbox, Slack webhook URL, home coords).

## Environment Variables
VITE_MAPBOX_TOKEN=
VITE_HOME_LAT=
VITE_HOME_LNG=
VITE_WALK_TIME_HARVARD_AVE_MINS=
VITE_WALK_TIME_COOLIDGE_CORNER_MINS=
SLACK_WEBHOOK_URL=        # server-side only, not exposed to client

## First Claude Code Prompt
Read SPEC.md. Let's do spec-driven development.
Start with Days 1–2: scaffold a Vite + React + TypeScript project 
with Deck.gl and Mapbox rendering a streets basemap centered on 
35 Russell St. Brookline, MA. Pin two stops — Harvard Ave and Coolidge Corner — 
as static markers. Ask me for my Mapbox token before writing 
any config files.