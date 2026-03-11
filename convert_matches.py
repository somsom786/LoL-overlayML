"""
convert_matches.py — Converts Riot Match-V5 JSON files into JSONL training
snapshots for the ML pipeline.

Since Match-V5 only provides end-of-game stats (not per-minute snapshots),
we generate synthetic time-series snapshots by interpolating the final stats
across the game duration. This gives the ML models temporal context.

Run: python convert_matches.py
Input:  match_history/*.json
Output: data/real_matches.jsonl
"""

import json
import os
import sys
import random

MATCH_DIR = os.path.join(os.path.dirname(__file__), 'match_history')
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
OUTPUT_FILE = os.path.join(DATA_DIR, 'real_matches.jsonl')

# Your Riot ID — must match exactly to identify which team you're on
PUUID = None  # Auto-detected from metadata
GAME_NAME = "jag gillar bajs"


def find_user_puuid():
    """Auto-detect user PUUID from the first match file."""
    for filename in os.listdir(MATCH_DIR):
        if not filename.endswith('.json'):
            continue
        with open(os.path.join(MATCH_DIR, filename), 'r') as f:
            match = json.load(f)
        # Search for our player by name
        for p in match['info']['participants']:
            name = p.get('riotIdGameName', p.get('summonerName', ''))
            if name.lower() == GAME_NAME.lower():
                return p['puuid']
    return None


def convert_match(match_data: dict, user_puuid: str, match_id: str) -> list:
    """Convert a single Match-V5 JSON into multiple training snapshots."""
    info = match_data['info']

    # Skip non-SR games (ARAM, etc.)
    if info.get('queueId') not in (420, 440, 400, 430, 490):
        # 420=SoloQ, 440=Flex, 400=Draft, 430=Blind, 490=Quickplay
        return []

    game_duration = info['gameDuration']  # in seconds
    if game_duration < 300:  # Skip remakes
        return []

    participants = info['participants']

    # Find user
    user = None
    for p in participants:
        if p['puuid'] == user_puuid:
            user = p
            break
    if not user:
        return []

    user_team_id = user['teamId']  # 100 = blue, 200 = red
    outcome = 1 if user['win'] else 0

    # Split into teams
    allies = [p for p in participants if p['teamId'] == user_team_id]
    enemies = [p for p in participants if p['teamId'] != user_team_id]

    # Team-level end-of-game stats
    team_data = {}
    for t in info['teams']:
        team_data[t['teamId']] = t

    ally_team = team_data.get(user_team_id, {})
    enemy_team_id = 200 if user_team_id == 100 else 100
    enemy_team = team_data.get(enemy_team_id, {})

    # Objective counts from team data
    def get_obj(team, obj_name):
        return team.get('objectives', {}).get(obj_name, {}).get('kills', 0)

    ally_towers_final = sum(p.get('turretKills', 0) for p in allies)
    enemy_towers_final = sum(p.get('turretKills', 0) for p in enemies)
    ally_dragons_final = get_obj(ally_team, 'dragon')
    enemy_dragons_final = get_obj(enemy_team, 'dragon')
    ally_barons_final = get_obj(ally_team, 'baron')
    enemy_barons_final = get_obj(enemy_team, 'baron')
    ally_heralds_final = get_obj(ally_team, 'horde')  # Rift Herald/Voidgrubs
    enemy_heralds_final = get_obj(enemy_team, 'horde')
    ally_inhibs_final = sum(p.get('inhibitorKills', 0) for p in allies)
    enemy_inhibs_final = sum(p.get('inhibitorKills', 0) for p in enemies)

    # Gold
    ally_gold_final = sum(p['goldEarned'] for p in allies)
    enemy_gold_final = sum(p['goldEarned'] for p in enemies)

    # Kills
    ally_kills_final = sum(p['kills'] for p in allies)
    enemy_kills_final = sum(p['kills'] for p in enemies)
    ally_deaths_final = sum(p['deaths'] for p in allies)
    enemy_deaths_final = sum(p['deaths'] for p in enemies)

    # CS
    ally_cs_final = sum(p['totalMinionsKilled'] + p.get('neutralMinionsKilled', 0) for p in allies)
    enemy_cs_final = sum(p['totalMinionsKilled'] + p.get('neutralMinionsKilled', 0) for p in enemies)

    # User stats
    user_kills_final = user['kills']
    user_deaths_final = user['deaths']
    user_assists_final = user['assists']
    user_cs_final = user['totalMinionsKilled'] + user.get('neutralMinionsKilled', 0)
    user_items_final = sum(1 for i in range(6) if user.get(f'item{i}', 0) > 0)

    # Champions
    ally_champs = sorted([p['championName'] for p in allies])
    enemy_champs = sorted([p['championName'] for p in enemies])

    # Position-based gold gaps (final)
    positions = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
    pos_gold_gaps = []
    for pos in positions:
        ally_p = next((p for p in allies if p.get('teamPosition') == pos), None)
        enemy_p = next((p for p in enemies if p.get('teamPosition') == pos), None)
        a_gold = ally_p['goldEarned'] if ally_p else 0
        e_gold = enemy_p['goldEarned'] if enemy_p else 0
        pos_gold_gaps.append(a_gold - e_gold)

    # ── Generate time-series snapshots by interpolating ──
    # Match-V5 only gives end-of-game stats, so we create snapshots at
    # 30s intervals by scaling stats proportionally to game progress.
    # Early-game stats grow slower (non-linear curve).
    snapshots = []
    game_min_total = game_duration / 60
    # Cap at 80% game progress — late-game snapshots leak the outcome
    max_time = int(game_duration * 0.8)

    for t in range(30, max_time, 30):
        progress = t / game_duration  # 0.0 → 1.0

        # Non-linear scaling: gold/CS grow slowly early, faster later
        # Using a curve that mimics real gold income patterns
        gold_curve = progress ** 0.85  # Slightly sub-linear
        kill_curve = progress ** 0.9
        obj_curve = max(0, (progress - 0.15)) / 0.85 if progress > 0.15 else 0

        # Add some noise to make snapshots less uniform
        noise = lambda scale=0.05: 1.0 + random.gauss(0, scale)

        game_min = t / 60
        phase = 'EARLY' if game_min < 14 else 'MID' if game_min < 28 else 'LATE'

        ally_gold = int(ally_gold_final * gold_curve * noise())
        enemy_gold = int(enemy_gold_final * gold_curve * noise())
        gold_diff = ally_gold - enemy_gold

        snapshot = {
            'match_id': match_id,
            'gameTime': t,
            'gamePhase': phase,
            'allyGold': ally_gold,
            'enemyGold': enemy_gold,
            'goldDiff': gold_diff,
            'goldDiffPerMin': gold_diff / max(game_min, 0.1),
            'allyCSTotal': int(ally_cs_final * gold_curve * noise()),
            'enemyCSTotal': int(enemy_cs_final * gold_curve * noise()),
            'topGoldGap': int(pos_gold_gaps[0] * gold_curve * noise(0.1)),
            'jglGoldGap': int(pos_gold_gaps[1] * gold_curve * noise(0.1)),
            'midGoldGap': int(pos_gold_gaps[2] * gold_curve * noise(0.1)),
            'botGoldGap': int(pos_gold_gaps[3] * gold_curve * noise(0.1)),
            'supGoldGap': int(pos_gold_gaps[4] * gold_curve * noise(0.1)),
            'allyTowers': min(11, int(ally_towers_final * obj_curve)),
            'enemyTowers': min(11, int(enemy_towers_final * obj_curve)),
            'allyDragons': min(4, int(ally_dragons_final * obj_curve)),
            'enemyDragons': min(4, int(enemy_dragons_final * obj_curve)),
            'allyBarons': int(ally_barons_final * max(0, (progress - 0.4) / 0.6) if progress > 0.4 else 0),
            'enemyBarons': int(enemy_barons_final * max(0, (progress - 0.4) / 0.6) if progress > 0.4 else 0),
            'allyHeralds': int(ally_heralds_final * obj_curve),
            'enemyHeralds': int(enemy_heralds_final * obj_curve),
            'allyInhibitors': int(ally_inhibs_final * max(0, (progress - 0.6) / 0.4) if progress > 0.6 else 0),
            'enemyInhibitors': int(enemy_inhibs_final * max(0, (progress - 0.6) / 0.4) if progress > 0.6 else 0),
            'allyKills': int(ally_kills_final * kill_curve * noise()),
            'enemyKills': int(enemy_kills_final * kill_curve * noise()),
            'allyDeaths': int(ally_deaths_final * kill_curve * noise()),
            'enemyDeaths': int(enemy_deaths_final * kill_curve * noise()),
            'killDiff': int((ally_kills_final - enemy_kills_final) * kill_curve),
            'allyChampions': ally_champs,
            'enemyChampions': enemy_champs,
            'userChampion': user['championName'],
            'userPosition': user.get('teamPosition', 'BOTTOM'),
            'userKills': int(user_kills_final * kill_curve * noise()),
            'userDeaths': int(user_deaths_final * kill_curve * noise()),
            'userAssists': int(user_assists_final * kill_curve * noise()),
            'userCS': int(user_cs_final * gold_curve * noise()),
            'userLevel': min(18, max(1, int(1 + game_min * 0.6))),
            'userItemCount': min(6, max(0, int(user_items_final * gold_curve))),
            'outcome': outcome,
        }
        snapshots.append(snapshot)

    return snapshots


def main():
    print("=" * 50)
    print("Match-V5 → Training Data Converter")
    print("=" * 50)

    if not os.path.exists(MATCH_DIR):
        print(f"No match_history directory found at {MATCH_DIR}")
        sys.exit(1)

    match_files = [f for f in os.listdir(MATCH_DIR) if f.endswith('.json')]
    print(f"Found {len(match_files)} match files")

    # Auto-detect PUUID
    puuid = find_user_puuid()
    if not puuid:
        print("Could not find your account in match data!")
        sys.exit(1)
    print(f"PUUID: {puuid[:15]}...")

    os.makedirs(DATA_DIR, exist_ok=True)

    total_snapshots = 0
    converted = 0
    skipped = 0
    wins = 0

    with open(OUTPUT_FILE, 'w') as out:
        for i, filename in enumerate(match_files):
            filepath = os.path.join(MATCH_DIR, filename)
            with open(filepath, 'r') as f:
                match_data = json.load(f)

            match_id = filename.replace('.json', '')
            snapshots = convert_match(match_data, puuid, match_id)
            if not snapshots:
                skipped += 1
                continue

            converted += 1
            if snapshots[0]['outcome'] == 1:
                wins += 1

            for snap in snapshots:
                out.write(json.dumps(snap) + '\n')
                total_snapshots += 1

            if (i + 1) % 25 == 0:
                print(f"  Processed {i+1}/{len(match_files)} matches...")

    win_rate = (wins / converted * 100) if converted > 0 else 0
    print(f"\nDone!")
    print(f"  Converted: {converted} matches ({skipped} skipped)")
    print(f"  Win rate:  {win_rate:.1f}%")
    print(f"  Snapshots: {total_snapshots}")
    print(f"  Output:    {OUTPUT_FILE}")
    print(f"  File size: {os.path.getsize(OUTPUT_FILE) / 1024:.1f} KB")


if __name__ == '__main__':
    main()
