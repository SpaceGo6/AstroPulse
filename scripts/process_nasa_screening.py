"""Summarize NASA MR035G screening DXA scans: a healthy-volunteer bone reference.

Input : data/raw/MR035G_AG_PILOT_DXA_SCREEN/MR035G_AG_PILOT_DXA_SCREEN/*
Output: data/nasa/dxa_screening_subjects.csv    one row per screened volunteer
        data/nasa/dxa_screening_reference.json  mean / SD / range of spine and hip bone density

Each volunteer was scanned once at screening, before selection for the bed-rest study.
File formats differ between volunteers (T_Z, *_BMD, ALL_DATA), so columns are matched by name.
Run: python3 scripts/process_nasa_screening.py   (standard library only)
"""
import csv
import json
import os
import re
import statistics as st
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw', 'MR035G_AG_PILOT_DXA_SCREEN', 'MR035G_AG_PILOT_DXA_SCREEN')
OUT = os.path.join(ROOT, 'data', 'nasa')
PREFIX = 'MR035G_AG_PILOT_DXA_SCREEN_'

# field -> accepted (normalized) column names
FIELDS = {
    'spine_bmd': ['tot_bmd', 'spine bmd lumbar spine (l1-l4)'],
    'spine_t': ['spine t', 'spine t-score'],
    'hip_total_bmd': ['htot_bmd', 'total hip bmd'],
    'hip_t': ['hip t', 'hip t-score'],
    'hip_neck_bmd': ['neck_bmd', 'femoral neck bmd'],
}
SPINE_FILES = ('Spine_T_Z', 'Spine_BMD', 'Spine_ALL_DATA')
HIP_FILES = ('L_Hip_T_Z', 'Left_Hip_BMD', 'L_Hip_ALL_DATA')


def norm(h):
    return re.sub(r'\s+', ' ', (h or '').strip().lower())


def read_first_row(path):
    with open(path, newline='', encoding='utf-8-sig') as fh:
        reader = csv.reader(fh)
        header = [norm(h) for h in next(reader)]
        for row in reader:
            if any(c.strip() for c in row):
                return dict(zip(header, row))
    return {}


def pick(row, names):
    for n in names:
        if n in row:
            try:
                return float(row[n])
            except ValueError:
                pass
    return None


def main():
    by_subject = defaultdict(dict)
    for fname in sorted(os.listdir(RAW)):
        if not fname.startswith(PREFIX):
            continue
        kind, subject = fname[len(PREFIX):].rsplit('_', 1)
        if kind not in SPINE_FILES + HIP_FILES:
            continue  # S_bone / LH_bone are raw region detail; the summary files carry the totals
        row = read_first_row(os.path.join(RAW, fname))
        rec = by_subject[subject]
        rec.setdefault('scan_date', (row.get('scan_date') or '').split(' ')[0])
        wanted = ('spine_bmd', 'spine_t') if kind in SPINE_FILES else ('hip_total_bmd', 'hip_t', 'hip_neck_bmd')
        for f in wanted:
            v = pick(row, FIELDS[f])
            if v is not None and f not in rec:
                rec[f] = v

    os.makedirs(OUT, exist_ok=True)
    cols = ['subject', 'scan_date', 'spine_bmd', 'spine_t', 'hip_total_bmd', 'hip_t', 'hip_neck_bmd']
    with open(os.path.join(OUT, 'dxa_screening_subjects.csv'), 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        for s in sorted(by_subject):
            w.writerow({'subject': s, **{c: by_subject[s].get(c, '') for c in cols[1:]}})

    def stats(field):
        vals = [r[field] for r in by_subject.values() if field in r]
        if not vals:
            return None
        return {'n': len(vals), 'mean': round(st.mean(vals), 3), 'sd': round(st.stdev(vals), 3) if len(vals) > 1 else None,
                'min': round(min(vals), 3), 'max': round(max(vals), 3)}

    reference = {
        'source': 'NASA Life Sciences Data Archive, study MR035G: Artificial Gravity pilot bed-rest study (UTMB, 2006), screening DXA scans',
        'what_it_is': 'One bone scan per healthy male volunteer at screening, before selection for bed rest. Use it as a healthy-adult reference for pre-flight bone density.',
        'units': 'BMD in g/cm^2; T-score = standard deviations from a young-adult reference (scanner-reported)',
        'volunteers': len(by_subject),
        'spine_bmd_l1_l4': stats('spine_bmd'),
        'spine_t_score': stats('spine_t'),
        'total_hip_bmd': stats('hip_total_bmd'),
        'hip_t_score': stats('hip_t'),
        'femoral_neck_bmd': stats('hip_neck_bmd'),
        'caveats': ['Screening population only (healthy men); not astronauts.', 'Some volunteers have spine or hip only; n differs per field.'],
    }
    with open(os.path.join(OUT, 'dxa_screening_reference.json'), 'w') as fh:
        json.dump(reference, fh, indent=2)
    print(json.dumps(reference, indent=2))


if __name__ == '__main__':
    main()
