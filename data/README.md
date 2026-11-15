# AstroPulse data

All crew data is **simulated**. Bone baselines and bone-change evidence come from **real NASA data**.

## Regenerate

```bash
python3 scripts/process_nasa_dxa.py        # bed-rest DXA -> data/nasa/dxa_bedrest_*
python3 scripts/process_nasa_screening.py  # screening DXA -> data/nasa/dxa_screening_*
python3 scripts/process_nasa_c3.py         # 60-day bed rest DXA -> data/nasa/c3_bedrest_*
python3 scripts/process_nasa_spine.py      # 60-day bed rest spine by phase -> data/nasa/spine_bedrest_*
python3 scripts/generate_mission.py    # -> data/*.json (fixed seed 42: everyone gets identical data)
python3 scripts/generate_spine.py      # -> data/spine.json (run after generate_mission; seed 7)
```

Standard library only, no installs.

## Files

| File | What it is | Size |
| --- | --- | --- |
| `raw/MR035G_AG_PILOT_DXA/` | Real NASA download: MR035G Artificial Gravity pilot bed-rest study, DXA bone scans (15 participants, pre and ~30 days post) | 15 participants x 9 scan types |
| `raw/MR035G_AG_PILOT_DXA_SCREEN/` | Real NASA download: same study, one screening bone scan per healthy volunteer before selection | 15 volunteers |
| `nasa/dxa_screening_subjects.csv` | One row per screened volunteer: spine and hip bone density + T-scores | 15 rows |
| `nasa/dxa_screening_reference.json` | Healthy-adult reference: mean, SD, range of spine and hip bone density ("is my pre-flight bone normal?") | 5 measures |
| `raw/MR035G_C3_DXA_WHOLE_BODY/` | Real NASA download: Campaign 3, whole-body DXA before, during and after ~60-day bed rest, plus 6-month and 1-year follow-ups | 32 participants |
| `nasa/c3_bedrest_timeline.csv` | One row per participant per scan session: phase, bed-rest day, whole-body + pelvis bone density, lean mass, % change from pre | 114 rows |
| `nasa/c3_bedrest_summary.json` | Mean % change at end of bed rest, after getting up, 6 months, 1 year; pelvis loss per 30 days | 4 phases |
| `nasa/dxa_bedrest_subjects.csv` | One row per participant: pre/post bone density (g/cm²) and % change per body site, triplicate scans averaged | 15 rows |
| `nasa/dxa_bedrest_summary.json` | Mean % change per site + caveats; used for the "Why?" panel and as evidence for the bone forecast | 7 sites |
| `nasa/spine_bedrest_timeline.csv` | One row per participant per phase: lumbar + thoracic spine density (from whole-body scans), % change | 114 rows |
| `nasa/spine_bedrest_phases.json` | Average spine density per phase: ground, end of bed rest, after, 6 months, 1 year (all people and same-people averages) | 5 phases |
| `spine.json` | Simulated spine tracking per crew: ground DXA, monthly in-flight ultrasound, urine NTx every 14 days, blood every 30 days, weekly back pain/posture, the test schedule with cost | 3 crew |
| `crew.json` | 3 simulated crew (Maya, Leo, Sam) with baselines; pre-flight bone values are real participants' pre-bed-rest scans | 3 |
| `daily.json` | One row per crew member per day, days 1–180 (`measured: false` after day 140 = forecast period) | 540 |
| `environment.json` | Daily cabin CO2, radiation dose, cumulative dose, solar-event flag | 180 |
| `stream_emergency.json` | Leo's per-minute wearable feed, mission day 152, for the Red Alert demo | 120 |
| `events.json` | The story events planted in the data | 5 |
| `rules.json` | Per indicator: how to measure, why it changes in space, hazards, limits, actions, source | 9 indicators |
| `triage.json` | Prototype emergency protocols (not NASA checklists) | 3 scenarios |

## `daily.json` fields

`crew_id, day, bp_sys, bp_dia, hr_rest, hrv, spo2_min, glucose, temp, sleep_h, mood, stress, symptoms[], ex_resist_min, ex_cardio_min, water_ml, bone_pct_est, measured`
Maya day 140 also has `bp_time` and `bp_rejected` (the slipped-cuff reading).

## Key values for the demo

- Maya day 140: BP 148/95 (rejected first reading 168/104), sleep 5.4 h, headache, bone 98.15% of pre-flight
- Maya bone forecast at landing (day 180), current pace: 97.27% → loss 2.7% > 2.5% watch level
- Radiation cumulative: 279 mSv at day 140, 352 mSv at day 180 (600 mSv career limit)
- Leo stream minute 75: HR 132, SpO2 88% → Red Alert

## Spine tab (`spine.json`)

- Pre-flight spine value per crew = real pilot participant's dedicated L1–L4 scan. Everything after is simulated.
- Loss model: 1.0 %/month with no exercise, 0.3 %/month at the 150 min/week target (assumption, based on NASA ~1 %/month lumbar spine, LeBlanc 2000 / Lang 2004).
- Recovery after landing: exponential, half-life 276 days (Sibonga 2007 fit). Real recovery is often incomplete (Gabel 2022).
- Maya day 140: spine −2.1%, forecast at landing −2.9% at current pace (watch level −2.5%), −2.5% on target; urine NTx up; back pain up. Sam: vitamin D 29.4 ng/mL (low). Leo: no alerts.
- In-flight ultrasound = REMS-type (radiation-free, FDA-cleared for spine BMD on Earth; **not yet flown**). This is our proposal.

## Real NASA evidence in one line each

- Healthy reference (screening, n=15): spine 1.054 g/cm², total hip 1.095 g/cm²
- 30-day bed rest (n=15): pelvis -0.83%
- 60-day bed rest spine (same people): ground 1.142 → end of bed rest 1.126 g/cm² (−1.3%, n=14); back near baseline after (+0.2%, n=25)
- 60-day bed rest (n=31): pelvis -0.83% per 30 days; at end of bed rest pelvis -1.7%, lean mass -4.5%; pelvis back near baseline at 6 months (+0.3%) and 1 year (-0.3%)

## NASA data caveats (say these if asked)

- MR035G is **bed rest**, an Earth analog for microgravity, not spaceflight.
- Some participants used countermeasures (e.g. artificial gravity); group splits are not in these files, so means combine groups.
- Campaign 3 participant C3C_7352 is excluded: NASA's own ID Check column marks those scans 'WRONG ORDER'.
- Model constants marked `"verify": true` in `rules.json` must be checked against the NASA HRP / CSA resources before the pitch.
