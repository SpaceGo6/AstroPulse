"""Simulated spine-health tracking for each crew member (pre-flight, in-flight, post-flight).

Reads : data/crew.json   (each crew member's real pre-flight spine DXA value, from NASA MR035G participants)
        data/daily.json  (daily resistance-exercise minutes and symptoms)
Writes: data/spine.json

Everything after the pre-flight DXA value is SIMULATED, on a fixed schedule:
  ground (pre-flight) : DXA spine scan at L-180 and L-30 days          (X-ray, gold standard)
  in flight           : spine ultrasound (REMS-type) every 30 days      (no radiation)
                        urine bone-breakdown marker (NTx) every 14 days
                        blood panel (calcium, bone-formation marker BSAP, vitamin D) every 30 days
                        back pain (0-10) and posture check every day in the check-in, summarized weekly
  post-flight         : DXA at landing + 6 months + 1 year (projected here; measured in real life)

Loss model (labelled assumptions, documented in data/README.md):
  lumbar spine loses 1.0 %/month with no exercise (NASA: ~1 %/month, LeBlanc 2000 / Lang 2004)
  and 0.3 %/month at the full resistance-exercise target, scaled by daily adherence.
  Recovery after landing: exponential, half-life 276 days (Sibonga et al. 2007 fit), never above pre-flight.
Run: python3 scripts/generate_spine.py   (standard library only, seed 7)
"""
import json
import math
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
SEED = 7
LOSS_NO_EX, LOSS_FULL_EX = 1.0, 0.3          # % per month, lumbar spine
TARGET_MIN_PER_DAY = 150 / 7                 # resistance-exercise target (same as the bone forecast)
US_EVERY, URINE_EVERY, BLOOD_EVERY = 30, 14, 30
US_NOISE_PCT = 0.4                           # REMS spine precision ~0.4 % (Di Paola 2019)
RECOVERY_HALF_LIFE_D = 276                   # Sibonga 2007 exponential recovery fit

SCHEDULE = [
    # id, test, phase, interval, what it tells us, radiation, relative cost, crew time
    {'id': 'dxa', 'test': 'DXA spine scan (X-ray)', 'phase': 'ground', 'when': 'L-180, L-30, landing, +6 mo, +1 yr',
     'shows': 'Bone density (g/cm²), the gold standard', 'radiation': 'Very low', 'cost': '$$', 'crew_min': 20},
    {'id': 'qct', 'test': 'CT scan (QCT) of the spine', 'phase': 'ground', 'when': 'L-30 and landing (if ordered)',
     'shows': '3D density: inner (trabecular) vs outer bone', 'radiation': 'Higher', 'cost': '$$$', 'crew_min': 30},
    {'id': 'xray', 'test': 'Spine X-ray', 'phase': 'ground', 'when': 'L-30 and landing',
     'shows': 'Vertebral fractures, posture / curve', 'radiation': 'Low', 'cost': '$', 'crew_min': 10},
    {'id': 'us', 'test': 'Spine ultrasound (REMS-type)', 'phase': 'flight', 'when': 'Every 30 days',
     'shows': 'Estimated spine density, trend between DXA scans', 'radiation': 'None', 'cost': '$ (device once)', 'crew_min': 15},
    {'id': 'urine', 'test': 'Urine: NTx + calcium', 'phase': 'flight', 'when': 'Every 14 days',
     'shows': 'Bone breakdown and calcium leaving the body (early warning)', 'radiation': 'None', 'cost': '$', 'crew_min': 5},
    {'id': 'blood', 'test': 'Blood: calcium, BSAP, vitamin D', 'phase': 'flight', 'when': 'Every 30 days',
     'shows': 'Bone building, calcium balance, vitamin D level', 'radiation': 'None', 'cost': '$$', 'crew_min': 10},
    {'id': 'pain', 'test': 'Back pain + posture check', 'phase': 'flight', 'when': 'Daily (in check-in)',
     'shows': 'Symptoms: back pain 0-10, where, hunched posture', 'radiation': 'None', 'cost': 'Free', 'crew_min': 1},
    {'id': 'exercise', 'test': 'Exercise log', 'phase': 'flight', 'when': 'Daily (from exercise device)',
     'shows': 'Resistance minutes vs 150 min/week target', 'radiation': 'None', 'cost': 'Free', 'crew_min': 0},
]


def main():
    rnd = random.Random(SEED)
    crew = json.load(open(os.path.join(DATA, 'crew.json')))
    daily = json.load(open(os.path.join(DATA, 'daily.json')))
    landing = max(r['day'] for r in daily)
    out = {'about': 'Simulated spine tracking. Pre-flight DXA values are real NASA MR035G participants; everything else is simulated.',
           'landing_day': landing, 'schedule': SCHEDULE,
           'model': {'loss_no_exercise_pct_per_month': LOSS_NO_EX, 'loss_full_exercise_pct_per_month': LOSS_FULL_EX,
                     'target_resist_min_per_week': 150, 'recovery_half_life_days': RECOVERY_HALF_LIFE_D,
                     'ultrasound_precision_pct': US_NOISE_PCT},
           'crew': {}}

    rca = random.Random(SEED + 1)   # separate stream: adding urine calcium leaves every other value unchanged
    for c in crew:
        rows = sorted([r for r in daily if r['crew_id'] == c['id']], key=lambda r: r['day'])
        pre = c['preflight_bone']['spine_bmd_g_cm2']
        # ground DXA: L-180 and L-30 (the second is the baseline; the first shows normal scan-to-scan wobble)
        ground = [{'day': -180, 'test': 'DXA', 'lumbar_bmd': round(pre * (1 + rnd.gauss(0, 0.006)), 4)},
                  {'day': -30, 'test': 'DXA', 'lumbar_bmd': round(pre, 4)}]
        ntx0 = round(rnd.uniform(30, 40), 1)        # nmol BCE/mmol creatinine, normal adult range
        uca0 = round(rca.uniform(160, 200))         # urine calcium, mg/day
        bsap0 = round(rnd.uniform(18, 24), 1)       # U/L
        vitd0 = round(rnd.uniform(32, 38), 1)       # ng/mL 25-OH vitamin D
        ground.append({'day': -30, 'test': 'urine', 'ntx': ntx0, 'calcium': uca0})
        ground.append({'day': -30, 'test': 'blood', 'calcium': 9.4, 'bsap': bsap0, 'vitd': vitd0})

        pct, true_pct, ultrasound, urine, blood, weekly = 0.0, {}, [], [], [], []
        week_pain, week_posture, week_ex = [], [], []
        for r in rows:
            d = r['day']
            last7 = [x['ex_resist_min'] for x in rows if d - 7 < x['day'] <= d]
            adh = min(1.0, sum(last7) / (TARGET_MIN_PER_DAY * len(last7)))  # weekly adherence, like the bone forecast
            pct -= (LOSS_NO_EX - (LOSS_NO_EX - LOSS_FULL_EX) * adh) / 30
            true_pct[d] = pct
            last14 = [x['ex_resist_min'] for x in rows if d - 14 < x['day'] <= d]
            adh14 = min(1.0, sum(last14) / (TARGET_MIN_PER_DAY * len(last14)))
            # back pain: space-adaptation pain in the first ~12 days (NASA: onset days 2-5, gone by ~day 12),
            # then low; rises when exercise drops (weaker core + faster bone loss)
            adapt = 4.0 * math.exp(-((d - 4) ** 2) / 18) if d <= 14 else 0
            low_ex = max(0.0, 0.8 - adh14) * 6
            pain = max(0, min(10, round(adapt + low_ex + 0.6 + rnd.gauss(0, 0.6))))
            hunched = (low_ex > 1.5 and rnd.random() < 0.5) or rnd.random() < 0.04
            week_pain.append(pain); week_posture.append(hunched); week_ex.append(r['ex_resist_min'])
            if d % 7 == 0:
                weekly.append({'week': d // 7, 'day': d, 'pain_avg': round(sum(week_pain) / len(week_pain), 1), 'pain_max': max(week_pain),
                               'hunched_days': sum(week_posture), 'resist_min': sum(week_ex)})
                week_pain, week_posture, week_ex = [], [], []
            if d % US_EVERY == 0:
                m = pct + rnd.gauss(0, US_NOISE_PCT)
                ultrasound.append({'day': d, 'lumbar_bmd_est': round(pre * (1 + m / 100), 4), 'pct': round(m, 2)})
            if d % URINE_EVERY == 0:
                # resorption rises in flight (Smith 2005: NTx up ~50-100 %); more when exercise is low
                ntx = ntx0 * (1.45 + 0.9 * (1 - adh14)) * (1 + rnd.gauss(0, 0.07))
                # urine calcium rises in flight as bone releases calcium (Smith 2012); more when exercise is low
                uca = uca0 * (1.35 + 0.6 * (1 - adh14)) * (1 + rca.gauss(0, 0.06))
                urine.append({'day': d, 'ntx': round(ntx, 1), 'calcium': round(uca)})
            if d % BLOOD_EVERY == 0:
                blood.append({'day': d, 'calcium': round(9.4 + 0.25 * (1 - adh14) + rnd.gauss(0, 0.08), 2),
                              'bsap': round(bsap0 * (0.95 + rnd.gauss(0, 0.05)), 1),
                              'vitd': round(vitd0 - 0.02 * d + rnd.gauss(0, 1.2), 1)})

        out['crew'][c['id']] = {
            'preflight_source': c['preflight_bone']['source'],
            'ground': ground,
            'flight': {'ultrasound': ultrasound, 'urine': urine, 'blood': blood, 'weekly': weekly,
                       'true_pct_by_day': {str(k): round(v, 3) for k, v in true_pct.items() if k % 5 == 0 or k == landing}},
            'baseline': {'lumbar_bmd': round(pre, 4), 'ntx': ntx0, 'urine_calcium': uca0, 'bsap': bsap0, 'vitd': vitd0},
        }

    with open(os.path.join(DATA, 'spine.json'), 'w') as fh:
        json.dump(out, fh, indent=1)
    for cid, v in out['crew'].items():
        us = v['flight']['ultrasound']
        print(cid, 'pre', v['baseline']['lumbar_bmd'], 'last US', us[-1], 'NTx', [u['ntx'] for u in v['flight']['urine']][-4:],
              'pain', [w['pain_avg'] for w in v['flight']['weekly']][12:21])


if __name__ == '__main__':
    main()
