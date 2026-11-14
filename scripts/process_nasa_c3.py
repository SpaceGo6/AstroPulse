"""Summarize NASA MR035G Campaign 3 whole-body DXA: ~60-day bed rest + recovery follow-ups.

Input : data/raw/MR035G_C3_DXA_WHOLE_BODY/MR035G_Campaign_3_DXA_Whole_Body/*
Output: data/nasa/c3_bedrest_timeline.csv   one row per participant per scan session (triplicates averaged)
        data/nasa/c3_bedrest_summary.json    % change from pre-bed-rest at each phase (bone + lean mass)

Phases come from the TEST_PHASE column: PRE_TEST, IN_TEST (in bed rest, BR_DAY = bed-rest day),
POST_TEST (after getting up). Rows marked NA are follow-ups, classified by time since the pre scan
(about 6 months or 1 year). The same scans appear in several files; exact duplicates are removed.
Run: python3 scripts/process_nasa_c3.py   (standard library only)
"""
import csv
import json
import os
import statistics as st
from collections import defaultdict
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw', 'MR035G_C3_DXA_WHOLE_BODY', 'MR035G_Campaign_3_DXA_Whole_Body')
OUT = os.path.join(ROOT, 'data', 'nasa')


def parse_date(s):
    s = (s or '').strip().split(' ')[0]
    for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%m/%d/%y'):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def load_scans():
    """Return {(campaign, subject): {date: {...averaged session...}}}."""
    seen, raw, flagged = set(), defaultdict(lambda: defaultdict(list)), set()
    for f in sorted(os.listdir(RAW)):
        if not (f.endswith('_Body_Comp') or f.endswith('_All_WB') or f.endswith('_WB')):
            continue
        lean_col = 'WBTOT_LEAN' if f.endswith('_Body_Comp') else None  # lean definitions differ between file types
        with open(os.path.join(RAW, f), newline='', encoding='utf-8-sig') as fh:
            for r in csv.DictReader(fh):
                if 'WRONG' in (r.get('ID Check') or '').upper():
                    flagged.add((r.get('CAMPAIGN'), r.get('SUBJECT')))
                d = parse_date(r.get('SCAN_DATE'))
                wb, pel = num(r.get('WBTOT_BMD')), num(r.get('PELV_BMD'))
                if d is None or wb is None:
                    continue
                key = (r.get('CAMPAIGN'), r.get('SUBJECT'), d, wb, pel)
                if key in seen:
                    continue
                seen.add(key)
                raw[(r.get('CAMPAIGN'), r.get('SUBJECT'))][d].append({
                    'phase': (r.get('TEST_PHASE') or 'NA').strip(), 'br_day': num(r.get('BR_DAY')),
                    'wb': wb, 'pel': pel, 'lean': num(r.get(lean_col)) if lean_col else None})
    sessions = {}
    for subj, by_date in raw.items():
        sessions[subj] = {}
        for d, scans in by_date.items():
            mean = lambda k: st.mean([s[k] for s in scans if s[k] is not None]) if any(s[k] is not None for s in scans) else None
            phases = [s['phase'] for s in scans if s['phase'] != 'NA']
            sessions[subj][d] = {'phase': phases[0] if phases else 'NA',
                                 'br_day': next((s['br_day'] for s in scans if s['br_day'] is not None), None),
                                 'wb': mean('wb'), 'pel': mean('pel'), 'lean': mean('lean'), 'n_scans': len(scans)}
    for k in flagged:
        sessions.pop(k, None)
    return sessions, sorted('%s_%s' % k for k in flagged)


def label(sess, days_from_pre):
    p = sess['phase']
    if p == 'PRE_TEST':
        return 'pre'
    if p == 'IN_TEST':
        return 'in_bedrest'
    if p == 'POST_TEST':
        return 'post'
    if days_from_pre is None:
        return 'unknown'
    if days_from_pre < 120:
        return 'post'
    if days_from_pre < 300:
        return 'followup_6mo'
    return 'followup_1y'


def pct(a, b):
    return None if a is None or b is None or a == 0 else (b - a) / a * 100


def main():
    sessions, excluded = load_scans()
    timeline, changes = [], defaultdict(lambda: defaultdict(list))
    for (camp, subj), by_date in sorted(sessions.items()):
        pre_dates = [d for d, s in by_date.items() if s['phase'] == 'PRE_TEST']
        if not pre_dates:
            continue
        d0 = max(pre_dates)            # last scan before bed rest = baseline
        base = by_date[d0]
        last_in = max([d for d, s in by_date.items() if s['phase'] == 'IN_TEST'], default=None)
        for d in sorted(by_date):
            s = by_date[d]
            dd = (d - d0).days
            ph = label(s, dd)
            if ph == 'in_bedrest' and d == last_in:
                ph = 'end_of_bedrest'
            row = {'campaign': camp, 'subject': subj, 'phase': ph, 'br_day': s['br_day'], 'scan_date': str(d),
                   'days_from_pre': dd, 'wb_bmd': round(s['wb'], 4), 'pelvis_bmd': round(s['pel'], 4) if s['pel'] else '',
                   'lean_g': round(s['lean']) if s['lean'] else '',
                   'wb_pct': round(pct(base['wb'], s['wb']), 2), 'pelvis_pct': round(pct(base['pel'], s['pel']), 2) if s['pel'] and base['pel'] else '',
                   'lean_pct': round(pct(base['lean'], s['lean']), 2) if s['lean'] and base['lean'] else ''}
            timeline.append(row)
            if ph in ('end_of_bedrest', 'post', 'followup_6mo', 'followup_1y'):
                for k in ('wb_pct', 'pelvis_pct', 'lean_pct'):
                    if row[k] != '':
                        changes[ph][k].append(row[k])
                changes[ph]['days'].append(dd)
                if s['br_day'] is not None and ph == 'end_of_bedrest':
                    changes[ph]['br_day'].append(s['br_day'])

    os.makedirs(OUT, exist_ok=True)
    cols = list(timeline[0].keys())
    with open(os.path.join(OUT, 'c3_bedrest_timeline.csv'), 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(timeline)

    def agg(vals):
        if not vals:
            return None
        return {'n': len(vals), 'mean': round(st.mean(vals), 2), 'sd': round(st.stdev(vals), 2) if len(vals) > 1 else None}

    order = ['end_of_bedrest', 'post', 'followup_6mo', 'followup_1y']
    phases = {}
    for ph in order:
        c = changes.get(ph)
        if not c:
            continue
        phases[ph] = {'days_from_pre_mean': round(st.mean(c['days'])),
                      'bedrest_day_mean': round(st.mean(c['br_day'])) if c.get('br_day') else None, 'whole_body_bmd_pct': agg(c['wb_pct']),
                      'pelvis_bmd_pct': agg(c['pelvis_pct']), 'lean_mass_pct': agg(c['lean_pct'])}
    eob = phases.get('end_of_bedrest', {})
    per30 = None
    if eob.get('pelvis_bmd_pct') and eob.get('bedrest_day_mean'):
        per30 = round(eob['pelvis_bmd_pct']['mean'] / eob['bedrest_day_mean'] * 30, 2)
    summary = {
        'source': 'NASA Life Sciences Data Archive, study MR035G, Campaign 3: whole-body DXA during ~60-day head-down bed rest and recovery',
        'what_it_is': '% change from each participant\'s last pre-bed-rest scan, at the end of bed rest, after getting up, and at ~6-month and ~1-year follow-ups. Triplicate scans averaged per session.',
        'participants': len({(r['campaign'], r['subject']) for r in timeline}),
        'excluded_participants': excluded,
        'exclusion_reason': "NASA's own 'ID Check' column marks these scans 'WRONG ORDER'",
        'phases': phases,
        'pelvis_bmd_pct_per_30_days_in_bedrest': per30,
        'caveats': ['Bed rest is an Earth analog for microgravity, not spaceflight.',
                    'Not every participant has every phase; n differs per phase.',
                    'Some campaign sub-groups may have received countermeasures; groups are not separated here.',
                    'Lean mass uses Body_Comp files only (other files define lean differently).'],
    }
    with open(os.path.join(OUT, 'c3_bedrest_summary.json'), 'w') as fh:
        json.dump(summary, fh, indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
