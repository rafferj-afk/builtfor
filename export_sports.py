"""
export_sports.py

Reads the Excel Profiles sheet (source of truth) and regenerates the
const SPORTS_DATA = [...] block in builtfor.html.

Run this whenever you add or update sports in the Excel file.

What it does NOT touch:
  - REGIONAL_SCORES  (add manually in HTML for new sports)
  - ELITE_COMPARISONS (add manually in HTML for new sports)
  - Everything else in the HTML

Usage:
    python3 export_sports.py
"""

import json, re
import openpyxl

HTML_PATH  = 'index.html'
EXCEL_PATH = 'sport_profile_database_v1_5.xlsx'

# ── 1. Read Excel Profiles sheet ──────────────────────────────────────────────

wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True)
ws = wb['Profiles']
rows = list(ws.iter_rows(min_row=3, values_only=True))  # skip 2 header rows

def to_float(v):
    if v is None: return None
    try: return float(v)
    except: return None

def to_int(v):
    if v is None: return None
    try: return int(v)
    except: return None

def to_str(v):
    if v is None: return None
    return str(v).strip() or None

sports = []
for r in rows:
    if not r[0]:
        continue  # skip blank rows
    sport = {
        'id':       str(r[0]),
        'sport':    to_str(r[1]),
        'position': to_str(r[2]),
        'category': to_str(r[3]),
        'physical': {
            'heightMean':          to_float(r[4]),
            'heightSD':            to_float(r[5]),
            'weightMean':          to_float(r[6]),
            'weightSD':            to_float(r[7]),
            'bmiMean':             to_float(r[8]),
            'bfMean':              to_float(r[9]),
            'wingspanRatio':       to_float(r[10]),
            'sittingHeightRatio':  to_float(r[11]),
        },
        'demands': {
            'aerobic':      to_int(r[12]),
            'anaerobic':    to_int(r[13]),
            'maxStrength':  to_int(r[14]),
            'power':        to_int(r[15]),
            'speed':        to_int(r[16]),
            'endurance':    to_int(r[17]),
            'flexibility':  to_int(r[18]),
            'coordination': to_int(r[19]),
            'reaction':     to_int(r[20]),
        },
        'categorical': {
            'teamSize':      to_int(r[21]),
            'contact':       to_str(r[22]),
            'environment':   to_str(r[23]),
            'waterBased':    to_str(r[24]),
            'equipmentCost': to_str(r[25]),
            'entryAge':      to_str(r[26]),
            'injuryRisk':    to_str(r[27]),
        },
        'ireland': {
            'accessibility':   to_int(r[28]),
            'clubsPrevalent':  to_str(r[29]),
        },
        'sources': to_str(r[30]),
        'notes':   to_str(r[31]),
        'sex':     to_str(r[32]),
    }
    sports.append(sport)

print(f'Sports read from Excel: {len(sports)}')

# ── 2. Serialize to compact JSON ──────────────────────────────────────────────

sports_json = json.dumps(sports, ensure_ascii=False, separators=(',', ':'))

new_block = f'const SPORTS_DATA = {sports_json};'

# ── 3. Splice into HTML ───────────────────────────────────────────────────────

with open(HTML_PATH, encoding='utf-8') as f:
    html = f.read()

# Find existing SPORTS_DATA block boundaries
start_marker = 'const SPORTS_DATA = ['
start = html.index(start_marker)
# Find end: the matching ] followed by ;
depth, i = 0, start + len('const SPORTS_DATA = ')
while i < len(html):
    if html[i] == '[':   depth += 1
    elif html[i] == ']':
        depth -= 1
        if depth == 0:
            i += 1  # include the ]
            break
    i += 1
# skip optional whitespace and ;
while i < len(html) and html[i] in ' \t':
    i += 1
if html[i] == ';':
    i += 1
end = i

original_block = html[start:end]
html_new = html[:start] + new_block + html[end:]

with open(HTML_PATH, 'w', encoding='utf-8') as f:
    f.write(html_new)

print(f'SPORTS_DATA block updated in {HTML_PATH}')
print(f'Old block: {len(original_block):,} chars  →  New block: {len(new_block):,} chars')
print(f'New sport count embedded in HTML: {len(sports)}')
print()
print('Reminder: for new sports, also update manually in builtfor.html:')
print('  • REGIONAL_SCORES  — add a row with [ie_uk, w_eu, n_am, anz, asia, row] scores')
print('  • ELITE_COMPARISONS — add a one-line athlete comparison string')
