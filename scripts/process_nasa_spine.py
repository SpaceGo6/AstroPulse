"""Spine bone density by phase from NASA MR035G bed-rest DXA (Earth stand-in for spaceflight).

Inputs : data/raw/MR035G_C3_DXA_WHOLE_BODY/.../*_WB_Bone, *_WB_Bone_A   (~60-day bed rest + follow-ups)
         data/nasa/dxa_bedrest_summary.json                              (30-day pilot, dedicated L1-L4 scans)
Outputs: data/nasa/spine_bedrest_timeline.csv   one row per participant per scan session
         data/nasa/spine_bedrest_phases.json    average lumbar + thoracic spine density per phase

Phase mapping used in the app (bed rest stands in for the mission):
  ground  = last scan before bed rest      (pre-flight)
  mission = last scan in bed rest          (end of "flight")
  post    = after getting up, 6 months, 1 year (post-flight recovery)
Run: python3 scripts/process_nasa_spine.py   (standard library only)
"""
import csv
import json
import os
import statistics as st
from collections import defaultdict

from process_nasa_c3 import parse_date, num, label, pct  # same phase rules as the 60-day summary

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw', 'MR035G_C3_DXA_WHOLE_BODY', 'MR035G_Campaign_3_DXA_Whole_Body')
OUT = os.path.join(ROOT, 'data', 'nasa')
SITES = {'lumbar': 'L_S_BMD', 'thoracic': 'T_S_BMD'}


def load():
    seen, raw, flagged = set(), defaultdict(lambda: defaultdict(list)), set()
    for f in sorted(os.listdir(RAW)):
        path = os.path.join(RAW, f)
        if not os.path.isfile(path):
            continue
        with open(path, newline='', encoding='utf-8-sig') as fh:
            rows = list(csv.DictReader(fh))
        for r in rows:  # NASA's own ID check, across every file
            if 'WRONG' in (r.get('ID Check') or '').upper():
                flagged.add((r.get('CAMPAIGN'), r.get('SUBJECT')))
        if not ('_WB_Bone' in f):
            continue
        for r in rows:
            d, ls = parse_date(r.get('SCAN_DATE')), num(r.get('L_S_BMD'))
            if d is None or ls is None:
                continue
            key = (r.get('CAMPAIGN'), r.get('SUBJECT'), d, ls, r.get('SCAN_TIME') or r.get('SCANID'))
            if key in seen:
                continue
            seen.add(key)
            raw[(r.get('CAMPAIGN'), r.get('SUBJECT'))][d].append({
                'phase': (r.get('TEST_PHASE') or 'NA').strip(), 'lumbar': ls, 'thoracic': num(r.get('T_S_BMD'))})
    sessions = {}
    for subj, by_date in raw.items():
        if subj in flagged:
            continue
        sessions[subj] = {}
        for d, scans in by_date.items():
            ph = [s['phase'] for s in scans if s['phase'] != 'NA']
            avg = {k: (st.mean([s[k] for s in scans if s[k] is not None]) if any(s[k] is not None for s in scans) else None)
                   for k in SITES}
            sessions[subj][d] = {'phase': ph[0] if ph else 'NA', **avg}
    return sessions, sorted('%s_%s' % k for k in flagged)


def main():
    sessions, excluded = load()
    rows, by_phase = [], defaultdict(lambda: defaultdict(list))
    for (camp, subj), by_date in sorted(sessions.items()):
        pre = [d for d, s in by_date.items() if s['phase'] == 'PRE_TEST']
        if not pre:
            continue
        d0 = max(pre)
        base = by_date[d0]
        last_in = max([d for d, s in by_date.items() if s['phase'] == 'IN_TEST'], default=None)
        for d in sorted(by_date):
            s, dd = by_date[d], (d - d0).days
            ph = label(s, dd)
            if ph == 'pre' and d != d0:
                continue  # only the last pre scan is the ground baseline
            if ph == 'in_bedrest':
                if d != last_in:
                    continue
                ph = 'end_of_bedrest'
            row = {'campaign': camp, 'subject': subj, 'phase': ph, 'scan_date': str(d), 'days_from_pre': dd}
            for k in SITES:
                row[k + '_bmd'] = round(s[k], 4) if s[k] is not None else ''
                row[k + '_pct'] = round(pct(base[k], s[k]), 2) if s[k] is not None and base[k] else ''
                if s[k] is not None:
                    by_phase[ph][k].append(s[k])
                if row[k + '_pct'] != '' and ph != 'pre':
                    by_phase[ph][k + '_pct'].append(row[k + '_pct'])
            by_phase[ph]['days'].append(dd)
            rows.append(row)

    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'spine_bedrest_timeline.csv'), 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    def agg(v, nd=3):
        return {'n': len(v), 'mean': round(st.mean(v), nd), 'sd': round(st.stdev(v), nd) if len(v) > 1 else None} if v else None

    names = {'pre': ('ground', 'Pre-flight (ground)'), 'end_of_bedrest': ('mission', 'End of mission (end of ~60-day bed rest)'),
             'post': ('post', 'Post-flight (days after getting up)'), 'followup_6mo': ('post_6mo', 'Post-flight, ~6 months'),
             'followup_1y': ('post_1y', 'Post-flight, ~1 year')}
    phases = []
    for ph in ['pre', 'end_of_bedrest', 'post', 'followup_6mo', 'followup_1y']:
        c = by_phase.get(ph)
        if not c:
            continue
        key, lab = names[ph]
        # same-people comparison: ground average of exactly the participants scanned in this phase
        ids = [(r['campaign'], r['subject']) for r in rows if r['phase'] == ph and r['lumbar_bmd'] != '']
        g = {(r['campaign'], r['subject']): r['lumbar_bmd'] for r in rows if r['phase'] == 'pre' and r['lumbar_bmd'] != ''}
        here = {(r['campaign'], r['subject']): r['lumbar_bmd'] for r in rows if r['phase'] == ph and r['lumbar_bmd'] != ''}
        both = [i for i in ids if i in g]
        paired = {'n': len(both), 'ground_mean': round(st.mean([g[i] for i in both]), 3),
                  'phase_mean': round(st.mean([here[i] for i in both]), 3)} if both else None
        phases.append({'key': key, 'label': lab, 'days_from_pre_mean': round(st.mean(c['days'])),
                       'lumbar_paired': paired,
                       'lumbar_bmd': agg(c['lumbar']), 'thoracic_bmd': agg(c['thoracic']),
                       'lumbar_pct': agg(c['lumbar_pct'], 2), 'thoracic_pct': agg(c['thoracic_pct'], 2)})

    pilot = None
    pilot_path = os.path.join(OUT, 'dxa_bedrest_summary.json')
    if os.path.exists(pilot_path):
        sp = json.load(open(pilot_path))['sites'].get('spine')
        if sp:
            pilot = {'study': '30-day bed-rest pilot (dedicated L1-L4 spine scans)', 'n': sp['n'],
                     'pre_bmd_mean': sp['pre_bmd_mean_g_cm2'], 'pct_change_mean': sp['mean_pct_change'],
                     'pct_change_sd': sp['sd_pct_change']}

    summary = {
        'source': 'NASA Life Sciences Data Archive, study MR035G (Campaign 3 ~60-day head-down bed rest, whole-body DXA spine regions; plus 30-day pilot)',
        'units': 'g/cm^2 (areal bone mineral density from DXA)',
        'participants': len({(r['campaign'], r['subject']) for r in rows}),
        'excluded_participants': excluded,
        'phases': phases,
        'pilot_30_day': pilot,
        'caveats': [
            'Bed rest is an Earth stand-in for weightlessness; real spaceflight loss is faster (NASA HRP: about 1-1.5% per month at the hip and spine).',
            'Absolute averages mix different people at each phase (n differs); the % change columns compare each person with their own ground scan.',
            'Spine values here are regions of a whole-body scan, less precise than a dedicated spine scan.',
            'Some sub-groups may have had countermeasures; groups are not separated.'],
    }
    with open(os.path.join(OUT, 'spine_bedrest_phases.json'), 'w') as fh:
        json.dump(summary, fh, indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
