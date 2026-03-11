"""
test_accuracy.py — Tests ALL matches through the ML engines and reports accuracy.

For each match, simulates feeding the mid-game state to the ML server and checks
if the prediction matches the actual outcome. Tests at 10, 15, 20, and 25 min marks.
"""

import json, os, requests

MATCH_DIR = 'match_history'
TIMELINE_DIR = 'match_timelines'
ML_URL = 'http://127.0.0.1:8421/predict'
GAME_NAME = 'jag gillar bajs'


def get_user_puuid():
    for f in os.listdir(MATCH_DIR):
        if not f.endswith('.json'): continue
        d = json.load(open(f'{MATCH_DIR}/{f}'))
        for p in d['info']['participants']:
            if p.get('riotIdGameName', '').lower() == GAME_NAME.lower():
                return p['puuid']
    return None


def test_match_at_time(match_data, timeline_data, user_puuid, target_minute):
    """Extract real stats at a specific minute and query the ML server."""
    info = match_data['info']
    if info.get('queueId') not in (420, 440, 400, 430, 490):
        return None
    if info['gameDuration'] < 300:
        return None

    frames = timeline_data['info']['frames']
    frame_idx = target_minute  # frames are 1 per minute
    if frame_idx >= len(frames):
        return None

    # Find user
    user = None
    user_pid = None
    for p in info['participants']:
        if p['puuid'] == user_puuid:
            user = p
            user_pid = str(p['participantId'])
            break
    if not user:
        return None

    team_id = user['teamId']
    ally_ids = [str(p['participantId']) for p in info['participants'] if p['teamId'] == team_id]
    enemy_ids = [str(p['participantId']) for p in info['participants'] if p['teamId'] != team_id]

    # Real gold from timeline
    frame = frames[frame_idx]
    pframes = frame.get('participantFrames', {})

    ally_gold = sum(pframes.get(pid, {}).get('totalGold', 0) for pid in ally_ids)
    enemy_gold = sum(pframes.get(pid, {}).get('totalGold', 0) for pid in enemy_ids)
    gold_diff = ally_gold - enemy_gold

    user_pf = pframes.get(user_pid, {})
    user_cs = user_pf.get('minionsKilled', 0) + user_pf.get('jungleMinionsKilled', 0)
    user_level = user_pf.get('level', 1)
    user_gold = user_pf.get('totalGold', 0)

    # Count kills from events
    ally_kills = 0
    enemy_kills = 0
    user_kills = 0
    user_deaths = 0
    user_assists = 0

    for fi in range(0, frame_idx + 1):
        for event in frames[fi].get('events', []):
            if event.get('type') == 'CHAMPION_KILL':
                killer = str(event.get('killerId', 0))
                victim = str(event.get('victimId', 0))
                assists = [str(a) for a in event.get('assistingParticipantIds', [])]
                if killer in ally_ids:
                    ally_kills += 1
                elif killer in enemy_ids:
                    enemy_kills += 1
                if killer == user_pid:
                    user_kills += 1
                if victim == user_pid:
                    user_deaths += 1
                if user_pid in assists:
                    user_assists += 1

    payload = {
        'gameTime': target_minute * 60,
        'allyGold': ally_gold,
        'enemyGold': enemy_gold,
        'goldDiff': gold_diff,
        'allyKills': ally_kills,
        'enemyKills': enemy_kills,
        'userKills': user_kills,
        'userDeaths': user_deaths,
        'userAssists': user_assists,
        'userCS': user_cs,
        'userLevel': user_level,
        'userItemCount': min(6, max(0, int(user_gold / 3000))),
    }

    try:
        r = requests.post(ML_URL, json=payload, timeout=5)
        pred = r.json()
        actual_win = user['win']
        predicted_win = pred['win_prob'] > 0.5
        return {
            'correct': predicted_win == actual_win,
            'win_prob': pred['win_prob'],
            'actual': actual_win,
            'gold_diff': gold_diff,
            'kill_diff': ally_kills - enemy_kills,
            'spike': pred['spike_status'],
            'comeback': pred['comeback_path'],
            'confidence': pred['model_confidence'],
            'champion': user['championName'],
        }
    except:
        return None


def main():
    puuid = get_user_puuid()
    if not puuid:
        print("Can't find user!")
        return

    match_files = sorted(set(os.listdir(MATCH_DIR)) & set(os.listdir(TIMELINE_DIR)))
    print(f"Testing {len(match_files)} matches through ML engines...\n")

    time_points = [10, 15, 20, 25]
    results = {t: {'correct': 0, 'wrong': 0, 'total': 0, 'wrong_details': []} for t in time_points}

    for filename in match_files:
        match_data = json.load(open(f'{MATCH_DIR}/{filename}'))
        timeline_data = json.load(open(f'{TIMELINE_DIR}/{filename}'))

        for t in time_points:
            result = test_match_at_time(match_data, timeline_data, puuid, t)
            if result is None:
                continue

            results[t]['total'] += 1
            if result['correct']:
                results[t]['correct'] += 1
            else:
                results[t]['wrong'] += 1
                results[t]['wrong_details'].append(result)

    # Print results
    print("=" * 70)
    print("ML ENGINE ACCURACY REPORT")
    print("=" * 70)

    for t in time_points:
        r = results[t]
        if r['total'] == 0:
            continue
        acc = r['correct'] / r['total'] * 100
        print(f"\n  At {t:2d} min:  {acc:.1f}% accurate  ({r['correct']}/{r['total']} correct, {r['wrong']} wrong)")

    # Show some wrong predictions
    print(f"\n{'=' * 70}")
    print("WRONG PREDICTIONS (sample at 15 min):")
    print("=" * 70)

    wrong_15 = results[15]['wrong_details']
    for i, w in enumerate(wrong_15[:8]):
        actual = "WIN" if w['actual'] else "LOSS"
        predicted = f"{w['win_prob']*100:.0f}%"
        print(f"  {w['champion']:12s} | Predicted: {predicted:>5s} win | Actual: {actual:4s} | Gold: {w['gold_diff']:+6d} | Kills: {w['kill_diff']:+3d} | Conf: {w['confidence']*100:.0f}%")

    # Breakdown: accuracy on wins vs losses
    print(f"\n{'=' * 70}")
    print("ACCURACY BY OUTCOME (at 15 min):")
    print("=" * 70)

    for t in [15]:
        r = results[t]
        all_details = []
        # Re-run to get all details
        for filename in match_files:
            match_data = json.load(open(f'{MATCH_DIR}/{filename}'))
            timeline_data = json.load(open(f'{TIMELINE_DIR}/{filename}'))
            result = test_match_at_time(match_data, timeline_data, puuid, t)
            if result:
                all_details.append(result)

        wins = [d for d in all_details if d['actual']]
        losses = [d for d in all_details if not d['actual']]
        win_acc = sum(1 for d in wins if d['correct']) / len(wins) * 100 if wins else 0
        loss_acc = sum(1 for d in losses if d['correct']) / len(losses) * 100 if losses else 0

        print(f"  Wins  ({len(wins):3d} games): {win_acc:.1f}% correctly predicted as WIN")
        print(f"  Losses ({len(losses):3d} games): {loss_acc:.1f}% correctly predicted as LOSS")

    # Confidence analysis
    print(f"\n{'=' * 70}")
    print("CONFIDENCE vs CORRECTNESS (at 15 min):")
    print("=" * 70)

    all_15 = []
    for filename in match_files:
        match_data = json.load(open(f'{MATCH_DIR}/{filename}'))
        timeline_data = json.load(open(f'{TIMELINE_DIR}/{filename}'))
        result = test_match_at_time(match_data, timeline_data, puuid, 15)
        if result:
            all_15.append(result)

    # Bucket by confidence
    buckets = [(0, 0.3, "Low (<30%)"), (0.3, 0.6, "Med (30-60%)"), (0.6, 1.01, "High (>60%)")]
    for lo, hi, label in buckets:
        in_bucket = [d for d in all_15 if lo <= d['confidence'] < hi]
        if not in_bucket:
            print(f"  {label:15s}: no predictions")
            continue
        correct = sum(1 for d in in_bucket if d['correct'])
        print(f"  {label:15s}: {correct}/{len(in_bucket)} correct ({correct/len(in_bucket)*100:.0f}%)")


if __name__ == '__main__':
    main()
