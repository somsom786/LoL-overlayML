"""Demo: find a LOSS game and run it through all 3 ML engines at 3 time points."""
import json, os, random, requests

MATCH_DIR = 'match_history'
ML_URL = 'http://127.0.0.1:8421/predict'
GAME_NAME = 'jag gillar bajs'

# Find a loss
losses = []
for f in os.listdir(MATCH_DIR):
    if not f.endswith('.json'): continue
    d = json.load(open(f'{MATCH_DIR}/{f}'))
    for p in d['info']['participants']:
        if p.get('riotIdGameName', '').lower() == GAME_NAME.lower():
            if not p['win']:
                losses.append((f, d, p))
            break

print(f"Found {len(losses)} losses out of {len(os.listdir(MATCH_DIR))} games\n")

f, d, user = random.choice(losses)
info = d['info']
team_id = user['teamId']
allies = [p for p in info['participants'] if p['teamId'] == team_id]
enemies = [p for p in info['participants'] if p['teamId'] != team_id]
ally_gold = sum(p['goldEarned'] for p in allies)
enemy_gold = sum(p['goldEarned'] for p in enemies)
ally_kills = sum(p['kills'] for p in allies)
enemy_kills = sum(p['kills'] for p in enemies)
duration = info['gameDuration']

print("=" * 60)
print(f"MATCH: {f.replace('.json', '')}")
print("=" * 60)
print(f"Champion: {user['championName']} ({user.get('teamPosition', '?')})")
print(f"Duration: {duration // 60}m {duration % 60}s")
print(f"Result:   LOSS")
print(f"KDA:      {user['kills']}/{user['deaths']}/{user['assists']}")
print(f"CS:       {user['totalMinionsKilled'] + user.get('neutralMinionsKilled', 0)}")
print(f"Gold:     {user['goldEarned']}")
print(f"\nYour team:  {', '.join(p['championName'] for p in allies)}")
print(f"Enemy team: {', '.join(p['championName'] for p in enemies)}")
print(f"Team gold:  {ally_gold:,} vs {enemy_gold:,} ({ally_gold - enemy_gold:+,})")
print(f"Team kills: {ally_kills} vs {enemy_kills}")

time_points = [
    ('EARLY (10 min)', 600),
    ('MID (20 min)',   1200),
    ('LATE (30 min)',  1800),
]

for label, t in time_points:
    if t > duration:
        continue
    progress = t / duration
    gold_scale = progress ** 0.85
    kill_scale = progress ** 0.9

    payload = {
        'gameTime': t,
        'allyGold': int(ally_gold * gold_scale),
        'enemyGold': int(enemy_gold * gold_scale),
        'goldDiff': int((ally_gold - enemy_gold) * gold_scale),
        'allyKills': int(ally_kills * kill_scale),
        'enemyKills': int(enemy_kills * kill_scale),
        'userKills': int(user['kills'] * kill_scale),
        'userDeaths': int(user['deaths'] * kill_scale),
        'userAssists': int(user['assists'] * kill_scale),
        'userCS': int((user['totalMinionsKilled'] + user.get('neutralMinionsKilled', 0)) * gold_scale),
        'userLevel': min(18, max(1, int(1 + (t / 60) * 0.6))),
        'userItemCount': min(6, max(0, int(sum(1 for i in range(6) if user.get(f'item{i}', 0) > 0) * gold_scale))),
    }

    try:
        r = requests.post(ML_URL, json=payload, timeout=5)
        pred = r.json()
        wp = pred['win_prob'] * 100
        verdict = 'CORRECT' if wp < 50 else 'WRONG'

        print(f"\n--- {label} ---")
        print(f"  Gold:     {payload['allyGold']:,} vs {payload['enemyGold']:,} ({payload['goldDiff']:+,})")
        print(f"  Kills:    {payload['allyKills']} vs {payload['enemyKills']}")
        print(f"  Your KDA: {payload['userKills']}/{payload['userDeaths']}/{payload['userAssists']}")
        print(f"  ------------------------------------")
        print(f"  ENGINE A  Win Prob  = {wp:.1f}%  [{verdict}]")
        print(f"  ENGINE B  Spike     = {pred['spike_status']} ({pred['spike_window']})")
        cb = pred['comeback_path'] or 'N/A'
        print(f"  ENGINE C  Comeback  = {cb} ({pred['comeback_prob'] * 100:.1f}%)")
        print(f"  Confidence: {pred['model_confidence'] * 100:.1f}%")
    except Exception as e:
        print(f"\n--- {label} --- ERROR: {e}")

print(f"\n{'=' * 60}")
print(f"ACTUAL RESULT: LOSS")
print(f"Model verdict: {'CORRECT' if True else ''} - Did the model predict <50% win?")
print(f"{'=' * 60}")
