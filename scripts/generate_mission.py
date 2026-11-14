"""AstroPulse simulated mission generator (standard library only).

Builds a reproducible 180-day Mars-transit mission for 3 crew members and writes:
  data/crew.json             crew profiles + pre-flight baselines (bone values from real NASA DXA scans)
  data/daily.json            1 row per crew member per day: check-in + wearable summary + bone estimate
  data/environment.json      1 row per day: cabin CO2, radiation dose, solar-event flag
  data/stream_emergency.json 1 row per minute for 120 min: Leo's wearable feed for the Red Alert demo
  data/events.json           the story events we plant (for the demo script and judges)
  data/rules.json            per-indicator thresholds, guidance and sources
  data/triage.json           prototype emergency protocols

value(day) = personal baseline + spaceflight drift + daily noise + planted event
Run order:  process_nasa_dxa.py, process_nasa_screening.py, process_nasa_c3.py, then generate_mission.py (all in scripts/)
All crew data is SIMULATED. Constants marked "verify": True must be checked against the cited source.
"""
import csv
import json
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
SEED = 42
DAYS = 180
TODAY = 140
rng = random.Random(SEED)
RESOURCES = 'https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources'

# ---- model constants (prototype; verify against NASA HRP / CSA before the pitch) ----
BONE_LOSS_NO_EXERCISE_PCT_PER_MONTH = 1.25    # NASA HRP cites ~1-1.5%/month without countermeasures (verify)
BONE_LOSS_FULL_EXERCISE_PCT_PER_MONTH = 0.25  # prototype assumption: countermeasures cut most of the loss
RESIST_TARGET_MIN_PER_WEEK = 150
RAD_MSV_PER_DAY = 1.8                         # deep-space transit order of magnitude (verify)
RAD_CAREER_LIMIT_MSV = 600                    # NASA career limit (verify)


def g(mu, sd):
    return rng.gauss(mu, sd)


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def load_nasa():
    subj = os.path.join(DATA, 'nasa', 'dxa_bedrest_subjects.csv')
    summ = os.path.join(DATA, 'nasa', 'dxa_bedrest_summary.json')
    if not (os.path.exists(subj) and os.path.exists(summ)):
        raise SystemExit('Run scripts/process_nasa_dxa.py first (creates data/nasa/*).')
    with open(subj, newline='') as fh:
        rows = {r['subject']: r for r in csv.DictReader(fh)}
    with open(summ) as fh:
        return rows, json.load(fh)


def make_crew(dxa):
    crew = [
        {'id': 'maya', 'name': 'Cmdr. Maya Singh', 'role': 'Commander', 'dxa_subject': '1392',
         'bp_sys': 118, 'bp_dia': 76, 'hr_rest': 62, 'hrv': 55, 'glucose': 90, 'temp': 36.7, 'sleep_h': 6.5, 'mood': 4, 'stress': 2},
        {'id': 'leo', 'name': 'Leo Park', 'role': 'Flight Engineer', 'dxa_subject': '4011',
         'bp_sys': 122, 'bp_dia': 79, 'hr_rest': 64, 'hrv': 50, 'glucose': 92, 'temp': 36.6, 'sleep_h': 6.3, 'mood': 4, 'stress': 2},
        {'id': 'sam', 'name': 'Sam Okafor', 'role': 'Mission Specialist', 'dxa_subject': '5695',
         'bp_sys': 115, 'bp_dia': 74, 'hr_rest': 58, 'hrv': 62, 'glucose': 88, 'temp': 36.8, 'sleep_h': 6.7, 'mood': 4, 'stress': 2},
    ]
    for c in crew:
        r = dxa[c['dxa_subject']]
        c['preflight_bone'] = {
            'pelvis_bmd_g_cm2': float(r['pelvis_pre']),
            'spine_bmd_g_cm2': float(r['spine_pre']),
            'hip_troch_bmd_g_cm2': float(r['hip_troch_left_pre']),
            'source': ('Real pre-bed-rest DXA values of NASA MR035G participant %s (anonymized), '
                       "used as this simulated crew member's pre-flight scan" % c['dxa_subject']),
        }
    return crew


def make_environment():
    env, cum = [], 0.0
    for day in range(1, DAYS + 1):
        dose = clamp(g(RAD_MSV_PER_DAY, 0.08), 1.5, 2.1)
        spe = day in (120, 121, 122)
        if spe:
            dose += {120: 15.0, 121: 8.0, 122: 3.0}[day]
        cum += dose
        co2 = clamp(g(2.6, 0.25), 1.8, 3.4)
        if 135 <= day <= 140:
            co2 = 3.6 + (day - 135) * 0.12 + g(0, 0.08)
        env.append({'day': day, 'co2_mmhg': round(co2, 2), 'rad_msv': round(dose, 2), 'rad_cum_msv': round(cum, 1),
                    'rad_pct_career_limit': round(cum / RAD_CAREER_LIMIT_MSV * 100, 1), 'solar_event': spe})
    return env


def adherence_for(cid, day):
    if cid != 'maya':
        return 1.0
    if 100 <= day <= 125:
        return 0.5   # busy mission phase
    if 126 <= day <= TODAY:
        return 0.8   # recovering
    if day > TODAY:
        return 0.6   # "current pace" projection
    return 1.0


def make_daily(crew):
    daily = []
    for c in crew:
        cid, bone_pct, week = c['id'], 100.0, []
        for day in range(1, DAYS + 1):
            adherence = adherence_for(cid, day)
            rest_day = day % 7 == 0
            resist = 0 if rest_day else max(0, round(g(RESIST_TARGET_MIN_PER_WEEK / 6 * adherence, 4)))
            cardio = 0 if rest_day else max(0, round(g(30 * (0.7 + 0.3 * adherence), 6)))
            week = (week + [resist])[-7:]
            week_ratio = min(1.0, sum(week) / RESIST_TARGET_MIN_PER_WEEK) if day >= 7 else adherence
            monthly = (BONE_LOSS_NO_EXERCISE_PCT_PER_MONTH
                       - (BONE_LOSS_NO_EXERCISE_PCT_PER_MONTH - BONE_LOSS_FULL_EXERCISE_PCT_PER_MONTH) * week_ratio)
            bone_pct -= monthly / 30

            sys_, dia = g(c['bp_sys'], 4), g(c['bp_dia'], 3)
            hr, hrv = g(c['hr_rest'], 2.5), g(c['hrv'], 5)
            spo2 = clamp(g(96.3, 0.6), 94.5, 98)
            glu, temp = g(c['glucose'], 4), g(c['temp'], 0.12)
            sleep = clamp(g(c['sleep_h'] - 0.2 * min(day, 30) / 30, 0.5), 4.0, 8.5)
            mood = clamp(round(g(c['mood'], 0.5)), 1, 5)
            stress = clamp(round(g(c['stress'], 0.5)), 1, 5)
            water = round(g(2300, 200), -1)
            symptoms = []

            if cid == 'maya' and 100 <= day <= 125:
                stress = clamp(stress + 1, 1, 5)
            if cid == 'maya' and 136 <= day <= TODAY:
                k = day - 136
                sys_ = [128, 134, 140, 145, 148][k] + g(0, 1)
                dia = [82, 86, 89, 93, 95][k] + g(0, 0.8)
                sleep = clamp(g(5.2, 0.15), 4.8, 5.6)
                mood, stress = 3, 4
                water = round(g(1800, 80), -1)
                if day >= 137:
                    symptoms = ['headache']
            if day in (120, 121, 122):
                stress = clamp(stress + 1, 1, 5)

            row = {'crew_id': cid, 'day': day,
                   'bp_sys': round(sys_), 'bp_dia': round(dia), 'hr_rest': round(hr), 'hrv': round(hrv),
                   'spo2_min': round(spo2), 'glucose': round(glu), 'temp': round(temp, 1), 'sleep_h': round(sleep, 1),
                   'mood': int(mood), 'stress': int(stress), 'symptoms': symptoms,
                   'ex_resist_min': resist, 'ex_cardio_min': cardio, 'water_ml': int(water),
                   'bone_pct_est': round(bone_pct, 2), 'measured': day <= TODAY}
            if cid == 'maya' and day == TODAY:
                row['bp_sys'], row['bp_dia'], row['bp_time'] = 148, 95, '07:41'
                row['bp_rejected'] = {'sys': 168, 'dia': 104, 'time': '07:34',
                                      'reason': 'remeasure: jump far outside personal day-to-day change'}
            daily.append(row)
    return daily


def make_stream():
    rows = []
    for m in range(120):
        hr, spo2, resp, skin = g(68, 2), clamp(g(97, 0.4), 95.5, 99), g(14, 0.8), g(33.4, 0.1)
        if 69 <= m <= 75:
            t = (m - 69) / 6
            hr, spo2, resp = 72 + t * 62 + g(0, 1.5), 97 - t * 9 + g(0, 0.2), 15 + t * 9
        elif 76 <= m <= 92:
            hr, spo2, resp = g(135, 2.5), g(88, 0.6), g(24, 1)
        elif 93 <= m <= 110:
            t = (m - 93) / 17
            hr, spo2, resp = 135 - t * 55 + g(0, 2), 88 + t * 8 + g(0, 0.3), 24 - t * 8
        rows.append({'minute': m, 'hr': round(hr), 'spo2': round(spo2, 1), 'resp': round(resp), 'skin_temp': round(skin, 1)})
    return {'crew_id': 'leo', 'mission_day': 152, 'start_time': '14:00',
            'note': 'Simulated. Change starts at minute 69; HR > 130 and SpO2 < 90 together from minute 75; recovers after triage from minute 93.',
            'rows': rows}


def healthy_reference():
    path = os.path.join(DATA, 'nasa', 'dxa_screening_reference.json')
    if not os.path.exists(path):
        return None
    with open(path) as fh:
        ref = json.load(fh)
    return {'study': 'NASA MR035G screening DXA (healthy volunteers)', 'n': ref['volunteers'],
            'spine_bmd_mean': ref['spine_bmd_l1_l4']['mean'], 'spine_bmd_sd': ref['spine_bmd_l1_l4']['sd'],
            'total_hip_bmd_mean': ref['total_hip_bmd']['mean'], 'total_hip_bmd_sd': ref['total_hip_bmd']['sd'],
            'file': 'data/nasa/dxa_screening_reference.json'}


def c3_evidence():
    path = os.path.join(DATA, 'nasa', 'c3_bedrest_summary.json')
    if not os.path.exists(path):
        return None
    with open(path) as fh:
        c3 = json.load(fh)
    ph = c3['phases']
    pick = lambda k, f: (ph.get(k) or {}).get(f, {}) and ph[k][f]['mean']
    return {'study': 'NASA MR035G Campaign 3: ~60-day bed rest + recovery (Earth analog)', 'participants': c3['participants'],
            'pelvis_pct_per_30_days_in_bedrest': c3['pelvis_bmd_pct_per_30_days_in_bedrest'],
            'end_of_bedrest': {'pelvis_pct': pick('end_of_bedrest', 'pelvis_bmd_pct'), 'lean_mass_pct': pick('end_of_bedrest', 'lean_mass_pct')},
            'recovery_6mo_pelvis_pct': pick('followup_6mo', 'pelvis_bmd_pct'), 'recovery_1y_pelvis_pct': pick('followup_1y', 'pelvis_bmd_pct'),
            'file': 'data/nasa/c3_bedrest_summary.json'}


def make_rules(nasa_summary):
    src_hrp = {'title': 'NASA HRP resources linked from the challenge page', 'url': RESOURCES}
    src_csa = {'title': 'CSA: Monitoring Radiation for Astronaut Health (challenge resources)', 'url': RESOURCES}
    pelvis = nasa_summary['sites']['pelvis']
    return {
        'baseline_window_days': 14,
        'watch_rule': 'beyond 2 SD of the personal 14-day baseline for 3 days in a row',
        'remeasure_rule': 'single reading more than 3 SD away from the personal day-to-day change',
        'indicators': [
            {'id': 'bp', 'label': 'Blood pressure', 'unit': 'mmHg', 'fields': ['bp_sys', 'bp_dia'], 'input': 'check-in (cuff)',
             'how_to_measure': 'Rest 5 min with feet anchored; cuff on bare left upper arm at heart level; do not talk.',
             'why_in_space': 'Without gravity, body fluids shift toward the head and the heart and vessels adapt; cabin CO2 can add headaches.',
             'hazards': ['Altered gravity', 'Hostile closed environment'], 'act_limit': {'bp_sys_gte': 160, 'bp_dia_gte': 100},
             'actions': {'self_care': 'Drink 500 mL water, check cabin CO2, 15 min quiet rest, re-check at 19:00',
                         'crew': 'Tell the crew medical officer if still above 140/90 tonight',
                         'flight_surgeon': 'Send the 30-day trend report if still high tomorrow'},
             'source': src_hrp},
            {'id': 'hr_rest', 'label': 'Resting heart rate', 'unit': 'bpm', 'fields': ['hr_rest'], 'input': 'wearable',
             'how_to_measure': 'Overnight minimum from the wearable.',
             'why_in_space': 'The heart adapts to doing less work against gravity.',
             'hazards': ['Altered gravity'], 'act_limit': {'hr_gte': 130}, 'source': src_hrp},
            {'id': 'spo2', 'label': 'Oxygen saturation', 'unit': '%', 'fields': ['spo2_min'], 'input': 'wearable',
             'how_to_measure': 'Wearable, or handheld pulse oximeter on a warm finger.',
             'why_in_space': 'Cabin air problems or illness can lower blood oxygen.',
             'hazards': ['Hostile closed environment'], 'act_limit': {'spo2_lt': 90}, 'source': src_hrp},
            {'id': 'glucose', 'label': 'Blood sugar (fasting)', 'unit': 'mg/dL', 'fields': ['glucose'], 'input': 'check-in',
             'how_to_measure': 'Finger-stick glucose meter before breakfast.',
             'why_in_space': 'Inactivity and diet changes can affect how the body handles sugar.',
             'hazards': ['Altered gravity', 'Isolation & confinement'], 'act_limit': {'glucose_lt': 70, 'glucose_gte': 180}, 'source': src_hrp},
            {'id': 'temp', 'label': 'Body temperature', 'unit': '°C', 'fields': ['temp'], 'input': 'check-in',
             'how_to_measure': 'Thermometer under the tongue, 5 min after drinking.',
             'why_in_space': 'Immune changes in flight can make infections more likely.',
             'hazards': ['Space radiation', 'Hostile closed environment'], 'act_limit': {'temp_gte': 38.0}, 'source': src_hrp},
            {'id': 'sleep', 'label': 'Sleep', 'unit': 'h', 'fields': ['sleep_h'], 'input': 'wearable',
             'how_to_measure': 'Wearable sleep estimate.',
             'why_in_space': 'Isolation, noise and a disrupted light-dark cycle shorten sleep.',
             'hazards': ['Isolation & confinement', 'Distance from Earth'], 'act_limit': None, 'source': src_hrp},
            {'id': 'mood', 'label': 'Mood & stress', 'unit': '1-5', 'fields': ['mood', 'stress'], 'input': 'check-in (self-report)',
             'how_to_measure': 'Tap how you feel today; there is no objective mood sensor.',
             'why_in_space': 'Long isolation and confinement strain mood and focus.',
             'hazards': ['Isolation & confinement', 'Distance from Earth'], 'act_limit': None, 'source': src_hrp},
            {'id': 'bone', 'label': 'Bone loading / bone forecast', 'unit': '% of pre-flight', 'fields': ['ex_resist_min', 'bone_pct_est'],
             'input': 'exercise log + model',
             'how_to_measure': 'Bone density cannot be scanned in flight (DXA happens on Earth before and after); the app tracks exercise and forecasts.',
             'why_in_space': 'Without load, weight-bearing bones lose mineral; resistance exercise is the main countermeasure.',
             'hazards': ['Altered gravity'], 'watch_if_landing_loss_pct_gt': 2.5,
             'model': {'loss_no_exercise_pct_per_month': BONE_LOSS_NO_EXERCISE_PCT_PER_MONTH,
                       'loss_full_exercise_pct_per_month': BONE_LOSS_FULL_EXERCISE_PCT_PER_MONTH,
                       'resist_target_min_per_week': RESIST_TARGET_MIN_PER_WEEK, 'verify': True},
             'nasa_evidence': {'study': 'NASA MR035G bed-rest DXA (Earth analog)',
                               'pelvis_mean_pct_change_about_30_days': pelvis['mean_pct_change'], 'n': pelvis['n'],
                               'file': 'data/nasa/dxa_bedrest_summary.json',
                               'healthy_reference': healthy_reference(),
                               'bedrest_60_day': c3_evidence()},
             'source': src_hrp},
            {'id': 'radiation', 'label': 'Radiation dose', 'unit': 'mSv', 'fields': ['rad_cum_msv'], 'input': 'dosimeter (environment.json)',
             'how_to_measure': 'Read automatically from the onboard dosimeter.',
             'why_in_space': "Outside Earth's magnetic field, cosmic rays and solar storms raise long-term health risks.",
             'hazards': ['Space radiation', 'Distance from Earth'], 'career_limit_msv': RAD_CAREER_LIMIT_MSV,
             'model': {'msv_per_day': RAD_MSV_PER_DAY, 'verify': True},
             'actions': {'self_care': 'Move to the storm shelter during a solar particle event'}, 'source': src_csa},
        ],
    }


TRIAGE = {
    'note': 'PROTOTYPE protocols based on public sources, not NASA flight-surgeon checklists. The crew medical officer makes all treatment decisions.',
    'scenarios': [
        {'id': 'hypoxia_tachycardia', 'trigger': 'hr > 130 AND spo2 < 90', 'title': 'Heart rate high and oxygen low together', 'steps': [
            'Stop activity and keep them still, upright, anchored in foot loops.',
            'Confirm oxygen with the handheld pulse oximeter on a warm finger.',
            'Check cabin O2, CO2 and pressure on the life-support panel.',
            'Bring the medical kit and oxygen supply; the crew medical officer decides on oxygen.',
            'Call the crew medical officer and read out the numbers on screen.',
            'Re-check every 2 minutes; AstroPulse logs each reading for the flight surgeon report.']},
        {'id': 'fever', 'trigger': 'temp >= 38.0', 'title': 'Fever', 'steps': [
            'Re-measure temperature in 15 minutes to confirm.',
            'Log symptoms: sore throat, cough, rash, headache.',
            'Rest and drink fluids; limit close contact with crewmates.',
            'Tell the crew medical officer.',
            'Re-check every 4 hours; escalate to the flight surgeon if above 38.5 °C or worsening.']},
        {'id': 'severe_bp', 'trigger': 'bp_sys >= 160 OR bp_dia >= 100, confirmed by re-measure', 'title': 'Very high blood pressure', 'steps': [
            'Sit quietly for 5 minutes, then re-measure.',
            'Ask about severe headache, vision changes, chest pain or weakness.',
            'Call the crew medical officer now if any of those are present.',
            'Check cabin CO2.',
            'Send a report to the flight surgeon with the trend.']},
    ],
}

EVENTS = [
    {'days': [100, 125], 'crew': ['maya'], 'event': 'Busy mission phase: resistance exercise ~50% of target', 'app_should': 'Bone forecast turns Watch'},
    {'days': [120, 122], 'crew': ['maya', 'leo', 'sam'], 'event': 'Solar particle event: radiation spike', 'app_should': 'Radiation alert, storm-shelter action'},
    {'days': [136, 140], 'crew': ['maya'], 'event': 'BP climbs 128 -> 148, headaches, CO2 up, sleep under 6 h', 'app_should': 'BP Watch + action plan'},
    {'days': [140, 140], 'crew': ['maya'], 'event': 'One bad reading 168/104 at 07:34 (slipped cuff)', 'app_should': 'Re-measure prompt, not an alarm'},
    {'days': [152, 152], 'crew': ['leo'], 'event': 'stream_emergency.json minute 75: HR > 130 and SpO2 < 90', 'app_should': 'Red Alert triage'},
]


def main():
    dxa, nasa_summary = load_nasa()
    crew = make_crew(dxa)
    env = make_environment()
    daily = make_daily(crew)
    stream = make_stream()
    files = {'crew.json': crew, 'daily.json': daily, 'environment.json': env, 'stream_emergency.json': stream,
             'events.json': EVENTS, 'rules.json': make_rules(nasa_summary), 'triage.json': TRIAGE}
    for name, obj in files.items():
        with open(os.path.join(DATA, name), 'w', encoding='utf-8') as fh:
            json.dump(obj, fh, indent=1, ensure_ascii=False)

    m = [r for r in daily if r['crew_id'] == 'maya']
    print('daily rows:', len(daily), '| environment rows:', len(env), '| stream rows:', len(stream['rows']))
    print('maya day 140:', {k: m[TODAY - 1][k] for k in ('bp_sys', 'bp_dia', 'sleep_h', 'symptoms', 'bone_pct_est')})
    print('maya bone % day 100/125/140/180:', [m[d - 1]['bone_pct_est'] for d in (100, 125, 140, 180)])
    print('radiation cumulative day 140 / 180 (mSv):', env[TODAY - 1]['rad_cum_msv'], env[DAYS - 1]['rad_cum_msv'])
    print('leo stream minute 75:', stream['rows'][75])


if __name__ == '__main__':
    main()
