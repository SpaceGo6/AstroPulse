"""Turn the raw NASA MR035G (Artificial Gravity pilot bed-rest) DXA files into clean summaries.

Input : data/raw/MR035G_AG_PILOT_DXA/MR035G_AG_PILOT_DXA_ANALYZED/*
Output: data/nasa/dxa_bedrest_subjects.csv   one row per participant (pre/post BMD per site, % change)
        data/nasa/dxa_bedrest_summary.json    group means used by the app (forecast calibration, "Why?" panel)

Each scan session has triplicate scans; we average them. First session = pre bed rest,
second session = post (about 30 days later). The DXA README notes a scanner correction
already applied to scans between 6/9/06 and 8/10/06. Group assignment (AG vs control) is
not in these files, so results are for all participants combined.
Run: python3 scripts/process_nasa_dxa.py   (standard library only)
"""
import csv, json, os, statistics as st
from datetime import datetime
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw', 'MR035G_AG_PILOT_DXA', 'MR035G_AG_PILOT_DXA_ANALYZED')
OUT = os.path.join(ROOT, 'data', 'nasa')
PREFIX = 'MR035G_AG_PILOT_DXA_ANALYZED_'

# site -> (file stem, BMD column, label)
SITES = {
    'whole_body': ('WB', 'WBTOT_BMD', 'Whole body'),
    'pelvis': ('WB', 'PELV_BMD', 'Pelvis'),
    'spine': ('Spine', 'TOT_BMD', 'Lumbar spine'),
    'hip_neck_left': ('L_Hip', 'NECK_BMD', 'Left femoral neck (hip)'),
    'hip_troch_left': ('L_Hip', 'TROCH_BMD', 'Left trochanter (hip)'),
    'heel': ('Heel', 'NET_AVG_BMD', 'Heel (calcaneus)'),
    'forearm': ('Forearm', 'RU13TOT_BMD', 'Forearm (radius+ulna 1/3)'),
}

def read_sessions(stem, col, subject):
    path = os.path.join(RAW, f'{PREFIX}{stem}_{subject}')
    if not os.path.exists(path):
        return None
    by_date = defaultdict(list)
    with open(path, newline='', encoding='utf-8-sig') as fh:
        for row in csv.DictReader(fh):
            try:
                v = float(row[col])
            except (KeyError, ValueError, TypeError):
                continue
            d = datetime.strptime(row['SCAN_DATE'].strip().split(' ')[0], '%m/%d/%Y').date()
            by_date[d].append(v)
    return sorted((d, st.mean(vs), len(vs)) for d, vs in by_date.items())

def main():
    subjects = sorted({f.rsplit('_', 1)[1] for f in os.listdir(RAW) if f.startswith(PREFIX + 'Spine_')})
    rows, changes = [], defaultdict(list)
    for s in subjects:
        rec = {'subject': s}
        for key, (stem, col, _) in SITES.items():
            sess = read_sessions(stem, col, s)
            if not sess or len(sess) < 2:
                continue
            (d0, v0, n0), (d1, v1, n1) = sess[0], sess[1]
            days = (d1 - d0).days
            pct = (v1 - v0) / v0 * 100
            rec.update({f'{key}_pre': round(v0, 4), f'{key}_post': round(v1, 4), f'{key}_pct': round(pct, 2)})
            rec['pre_date'], rec['post_date'], rec['days_between'] = str(d0), str(d1), days
            changes[key].append((pct, days))
        rows.append(rec)

    os.makedirs(OUT, exist_ok=True)
    cols = ['subject', 'pre_date', 'post_date', 'days_between'] + [f'{k}_{p}' for k in SITES for p in ('pre', 'post', 'pct')]
    with open(os.path.join(OUT, 'dxa_bedrest_subjects.csv'), 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, '') for c in cols})

    sites = {}
    for key, vals in changes.items():
        pcts = [p for p, _ in vals]
        per30 = [p / d * 30 for p, d in vals if d]
        sites[key] = {
            'label': SITES[key][2],
            'n': len(pcts),
            'mean_pct_change': round(st.mean(pcts), 2),
            'sd_pct_change': round(st.stdev(pcts), 2) if len(pcts) > 1 else None,
            'mean_pct_change_per_30_days': round(st.mean(per30), 2),
            'pre_bmd_mean_g_cm2': round(st.mean(r[f'{key}_pre'] for r in rows if f'{key}_pre' in r), 3),
        }
    summary = {
        'source': 'NASA Life Sciences Data Archive, study MR035G: Artificial Gravity pilot bed-rest study (UTMB, 2006), DXA analyzed scans',
        'what_it_is': 'Bone mineral density (g/cm^2) of 15 healthy male volunteers, scanned before and about 30 days after a head-down bed-rest period, an Earth analog for microgravity. Triplicate scans averaged per session.',
        'caveats': [
            'Some participants received artificial gravity (short-radius centrifuge) as a countermeasure; the group split is not in these files, so means combine both groups.',
            'Bed rest is an Earth analog, not spaceflight; use it to show direction and scale of change, alongside NASA HRP spaceflight rates.',
            'A scanner correction (README) is already applied to scans from 6/9/06 to 8/10/06.',
        ],
        'participants': len(rows),
        'sites': sites,
    }
    with open(os.path.join(OUT, 'dxa_bedrest_summary.json'), 'w') as fh:
        json.dump(summary, fh, indent=2)
    print(json.dumps(sites, indent=2))

if __name__ == '__main__':
    main()
