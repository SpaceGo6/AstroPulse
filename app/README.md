# AstroPulse app (React + Vite)

Offline tablet app for the NASA Space Apps 2026 challenge "Create Health Monitoring Software for Astronauts on Space Missions".

## Run it

```bash
cd app
npm install
npm run dev        # copies ../data/*.json into public/data, then opens http://localhost:5173
npm test           # engine tests against the generated mission data
npm run build      # static build in dist/ (works from any static host, no server)
```

If the data changes, regenerate it first: `python3 scripts/process_nasa_dxa.py`, `process_nasa_screening.py`, `process_nasa_c3.py`, `generate_mission.py` (from the repo root).

## Demo flow (Maya, mission day 140)

1. **Today**: 3 to watch (blood pressure, sleep, bone forecast).
2. **Start check-in** → Save the pre-filled 168/104 → **Re-measure** screen → *Re-measure now* → 148/95 confirmed → *See what this means*.
3. **Trends**: 30-day chart vs her personal space baseline + 3-step action plan + "Why? Show NASA sources".
4. **Forecast**: drag the time-jump slider; bone at landing, current pace vs on exercise target; real NASA bed-rest evidence.
5. **Watchdog live · offline** pill → plays Leo's feed; at minute 75 the Red Alert triage opens.
   Crew sync demo: open the app in a second tab first; the alert appears there too (BroadcastChannel, no network).
6. **Body**: clickable body map with live status per area.
7. **Audit**: *Daily records* table (one row per mission day, readings colour-coded by status, click today to see its audited events, Export CSV) and *Event log*: every reading, re-measure, engine decision, alert and triage action, chained with SHA-256. *Verify integrity*, *Export for flight surgeon* (JSON), and *Tamper demo* (edits an old entry → the chain breaks and shows where; *Undo demo edit* restores it).

Use the crew selector (bottom of the sidebar) to switch to Leo or Sam (healthy comparison).

## Code map

| Path | What it is |
| --- | --- |
| `src/engine/engine.js` | Pure functions: personal baseline, status (Normal/Watch/Act), re-measure check, bone + radiation forecast, watchdog |
| `src/engine/indicators.js` | The 8 indicators and how to read them from `daily.json` |
| `src/engine/engine.test.js` | Tests: Maya BP + sleep Watch, 168 → re-measure, 148 → OK, bone Watch, Sam normal, watchdog fires at minute 75 |
| `src/data/DataContext.jsx` | Loads the bundled JSON once; holds crew, mission day, today's check-in (localStorage) |
| `src/sync/channel.js` | BroadcastChannel stand-in for the onboard hub |
| `src/audit/audit.js` | Tamper-evident audit trail: `makeEntry` (hash-chained, append-only) and `verifyChain` |
| `src/audit/sha256.js` | Offline SHA-256 (no network, no HTTPS needed); tested against standard vectors |
| `src/pages/*` | Today, CheckIn, Remeasure, Trends, Forecast, BodyMap, Alert |
| `src/components/*` | Sidebar layout, icons, status chips |

Engine rules: baseline = 14 days ending 5 days before today; Watch = beyond 2 SD for 3 days in a row (sleep: under 6 h for 3 nights); Act = hard limit from `rules.json`; re-measure = jump > 3 SD of usual day-to-day change; bone forecast = monthly loss rate scaled by last-28-day exercise adherence.

All crew data is simulated. Prototype, not a medical device.
