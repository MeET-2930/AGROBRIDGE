"""
ml/make_dataset.py   (install44)
------------------------------------------------------------------
Generates a REALISTIC SYNTHETIC wheat season for one mandi so the
models have something to learn from before real data exists.
Assumptions (from Haryana 2025/26 procurement reports):
  - ~45 days season, arrivals peak around day 12-18
  - 10-15 % no-show, higher for far-ahead bookings and afternoons
  - farmers under-declare a little (actual ~1.05 x declared) with a
    personal habit that persists visit to visit
  - weighbridge clears ~300-350 q/h mornings, ~250 after lunch
Output: ml/data/bookings.csv  (same columns the app stores)
Replace this file's output with a real export when you have one.
"""
import csv, math, os, random
from datetime import datetime, timedelta

random.seed(42)
OUT = os.path.join(os.path.dirname(__file__), 'data', 'bookings.csv')
os.makedirs(os.path.dirname(OUT), exist_ok=True)

SEASON_START = datetime(2026, 4, 1)
DAYS = 45
CROPS = ['wheat', 'mustard']
HOURS = list(range(8, 18))

# 600 farmers with a persistent declaring habit and reliability
farmers = []
for i in range(600):
    farmers.append({
        'id': f'F{i:04d}',
        'ratio': max(0.8, min(1.35, random.gauss(1.05, 0.10))),   # actual / declared habit
        'reliab': max(0.0, min(1.0, random.gauss(0.88, 0.10))),    # base show-up tendency
        'size': random.choice([15, 25, 40, 60, 80, 120]),
        'n_book': 0, 'n_noshow': 0,
    })

def hour_throughput(h):
    return 330 if h < 13 else (260 if h < 16 else 290)

rows = []
for day in range(DAYS):
    date = SEASON_START + timedelta(days=day)
    season_curve = math.exp(-((day - 15) ** 2) / (2 * 8 ** 2))   # bell peak at day 15
    n_today = int(40 + 90 * season_curve)
    for _ in range(n_today):
        f = random.choice(farmers)
        crop = 'wheat' if random.random() < 0.85 else 'mustard'
        declared = max(5, int(random.gauss(f['size'], f['size'] * 0.15)))
        hour = random.choices(HOURS, weights=[6, 10, 12, 12, 9, 6, 6, 7, 7, 4])[0]
        via = 'gate' if random.random() < 0.12 else 'app'
        lead = 0 if via == 'gate' else random.choices([0, 1, 2, 3, 4, 5, 6, 7], weights=[20, 30, 18, 12, 8, 5, 4, 3])[0]
        # show probability: reliability, lead time, afternoon, gate booking
        p = f['reliab'] - 0.035 * lead - (0.06 if hour >= 15 else 0) + (0.15 if via == 'gate' else 0) - (0.03 if declared > 80 else 0)
        p = max(0.05, min(0.99, p))
        showed = random.random() < p
        f['n_book'] += 1
        if not showed:
            f['n_noshow'] += 1
        actual = round(declared * f['ratio'] * random.gauss(1, 0.04), 1) if showed else ''
        weighed_at = ''
        if showed:
            # weighed inside the hour with jitter based on throughput
            minute = min(59, int(random.random() * 60))
            weighed_at = (date + timedelta(hours=hour, minutes=minute)).isoformat()
        rows.append({
            'farmerId': f['id'], 'crop': crop, 'date': date.strftime('%Y-%m-%d'), 'hour': hour,
            'declared': declared, 'actual': actual, 'showed': int(showed), 'leadDays': lead,
            'bookedVia': via, 'pastBookings': f['n_book'] - 1, 'pastNoShows': f['n_noshow'] - (0 if showed else 1),
            'weighedAt': weighed_at, 'seasonDay': day,
        })

with open(OUT, 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()), lineterminator='\n')
    w.writeheader(); w.writerows(rows)
print(f'wrote {len(rows)} bookings -> {OUT}  (show rate {sum(r["showed"] for r in rows)/len(rows):.3f})')
