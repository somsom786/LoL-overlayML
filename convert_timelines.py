"""
convert_timelines.py — Converts Match-V5 Timeline data into REAL training snapshots.

Unlike convert_matches.py which interpolated end-of-game stats, this uses
ACTUAL per-minute gold, kills, CS, level from the Timeline API.

Run: python convert_timelines.py
Input:  match_history/*.json + match_timelines/*.json
Output: data/real_matches.jsonl
"""

import json
import os
import sys

MATCH_DIR = os.path.join(os.path.dirname(__file__), 'match_history')
TIMELINE_DIR = os.path.join(os.path.dirname(__file__), 'match_timelines')
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
OUTPUT_FILE = os.path.join(DATA_DIR, 'real_matches.jsonl')

GAME_NAME = "jag gillar bajs"


def find_user_puuid():
    """Auto-detect user PUUID from match data."""
    for filename in os.listdir(MATCH_DIR):
        if not filename.endswith('.json'):
            continue
        with open(os.path.join(MATCH_DIR, filename), 'r') as f:
            match = json.load(f)
        for p in match['info']['participants']:
            name = p.get('riotIdGameName', p.get('summonerName', ''))
            if name.lower() == GAME_NAME.lower():
                return p['puuid']
    return None


def convert_match_with_timeline(match_data, timeline_data, user_puuid, match_id):
    """Convert a match using REAL per-minute timeline data."""
    info = match_data['info']

    # Skip non-SR / remakes
    if info.get('queueId') not in (420, 440, 400, 430, 490):
        return []
    if info['gameDuration'] < 300:
        return []

    frames = timeline_data['info']['frames']
    if len(frames) < 5:
        return []

    # Find user and determine team
    user = None
    user_participant_id = None
    for p in info['participants']:
        if p['puuid'] == user_puuid:
            user = p
            user_participant_id = str(p['participantId'])
            break
    if not user:
        return []

    user_team_id = user['teamId']
    outcome = 1 if user['win'] else 0

    # Map participant IDs to teams
    ally_ids = []
    enemy_ids = []
    for p in info['participants']:
        pid = str(p['participantId'])
        if p['teamId'] == user_team_id:
            ally_ids.append(pid)
        else:
            enemy_ids.append(pid)

    # Get champion names
    allies = [p for p in info['participants'] if p['teamId'] == user_team_id]
    enemies = [p for p in info['participants'] if p['teamId'] != user_team_id]
    ally_champs = sorted([p['championName'] for p in allies])
    enemy_champs = sorted([p['championName'] for p in enemies])

    # Track cumulative events across frames
    ally_towers = 0
    enemy_towers = 0
    ally_dragons = 0
    enemy_dragons = 0
    ally_barons = 0
    enemy_barons = 0
    ally_heralds = 0
    enemy_heralds = 0
    ally_inhibitors = 0
    enemy_inhibitors = 0

    # Build position map for lane gold gaps
    position_map = {}  # participantId -> position
    for p in info['participants']:
        pos = p.get('teamPosition', '')
        if pos:
            position_map[str(p['participantId'])] = pos

    snapshots = []

    # Skip frame 0 (game start), cap at 80% of frames
    max_frame = int(len(frames) * 0.8)

    for frame_idx in range(1, max_frame):
        frame = frames[frame_idx]
        game_time = frame.get('timestamp', 0) // 1000  # ms -> seconds

        if game_time < 120:  # Skip first 2 minutes
            continue

        # Process events in this frame to track objectives
        for event in frame.get('events', []):
            etype = event.get('type', '')

            if etype == 'BUILDING_KILL':
                building = event.get('buildingType', '')
                if 'TOWER' in building:
                    killer_team = event.get('teamId', 0)
                    # teamId in building events = team whose building was killed
                    if killer_team == user_team_id:
                        enemy_towers += 1  # enemy destroyed our tower
                    else:
                        ally_towers += 1  # we destroyed their tower
                elif 'INHIBITOR' in building:
                    killer_team = event.get('teamId', 0)
                    if killer_team == user_team_id:
                        enemy_inhibitors += 1
                    else:
                        ally_inhibitors += 1

            elif etype == 'ELITE_MONSTER_KILL':
                monster = event.get('monsterType', '')
                killer_id = str(event.get('killerTeamId', event.get('killerTeamId', 0)))

                # Determine which team killed it
                killer_pid = str(event.get('killerId', 0))
                killer_is_ally = killer_pid in ally_ids

                if 'DRAGON' in monster:
                    if killer_is_ally:
                        ally_dragons += 1
                    else:
                        enemy_dragons += 1
                elif 'BARON' in monster:
                    if killer_is_ally:
                        ally_barons += 1
                    else:
                        enemy_barons += 1
                elif 'RIFTHERALD' in monster or 'HORDE' in monster:
                    if killer_is_ally:
                        ally_heralds += 1
                    else:
                        enemy_heralds += 1

        # Extract REAL gold/CS/level from participant frames
        pframes = frame.get('participantFrames', {})

        ally_gold = 0
        enemy_gold = 0
        ally_cs = 0
        enemy_cs = 0
        ally_kills_total = 0
        enemy_kills_total = 0
        ally_deaths_total = 0
        enemy_deaths_total = 0

        user_gold = 0
        user_cs = 0
        user_level = 1
        user_kills = 0
        user_deaths = 0
        user_assists = 0

        # Per-position gold for lane gaps
        pos_gold = {'TOP': [0, 0], 'JUNGLE': [0, 0], 'MIDDLE': [0, 0],
                    'BOTTOM': [0, 0], 'UTILITY': [0, 0]}

        for pid, pf in pframes.items():
            gold = pf.get('totalGold', 0)
            cs = pf.get('minionsKilled', 0) + pf.get('jungleMinionsKilled', 0)
            level = pf.get('level', 1)

            if pid in ally_ids:
                ally_gold += gold
                ally_cs += cs
                pos = position_map.get(pid, '')
                if pos in pos_gold:
                    pos_gold[pos][0] = gold
            else:
                enemy_gold += gold
                enemy_cs += cs
                pos = position_map.get(pid, '')
                if pos in pos_gold:
                    pos_gold[pos][1] = gold

            if pid == user_participant_id:
                user_gold = gold
                user_cs = cs
                user_level = level

        # Count kills from events up to this frame
        for fi in range(0, frame_idx + 1):
            for event in frames[fi].get('events', []):
                if event.get('type') == 'CHAMPION_KILL':
                    killer = str(event.get('killerId', 0))
                    victim = str(event.get('victimId', 0))
                    assists = [str(a) for a in event.get('assistingParticipantIds', [])]

                    if killer in ally_ids:
                        ally_kills_total += 1
                        enemy_deaths_total += 1
                    elif killer in enemy_ids:
                        enemy_kills_total += 1
                        ally_deaths_total += 1

                    if killer == user_participant_id:
                        user_kills += 1
                    if victim == user_participant_id:
                        user_deaths += 1
                    if user_participant_id in assists:
                        user_assists += 1

        gold_diff = ally_gold - enemy_gold
        game_min = game_time / 60

        # Count user items from gold (approximate: 1 item per ~3000g spent)
        user_items = min(6, max(0, int(user_gold / 3000)))

        snapshot = {
            'match_id': match_id,
            'gameTime': game_time,
            'gamePhase': 'EARLY' if game_min < 14 else 'MID' if game_min < 28 else 'LATE',
            'allyGold': ally_gold,
            'enemyGold': enemy_gold,
            'goldDiff': gold_diff,
            'goldDiffPerMin': gold_diff / max(game_min, 0.1),
            'allyCSTotal': ally_cs,
            'enemyCSTotal': enemy_cs,
            'topGoldGap': pos_gold['TOP'][0] - pos_gold['TOP'][1],
            'jglGoldGap': pos_gold['JUNGLE'][0] - pos_gold['JUNGLE'][1],
            'midGoldGap': pos_gold['MIDDLE'][0] - pos_gold['MIDDLE'][1],
            'botGoldGap': pos_gold['BOTTOM'][0] - pos_gold['BOTTOM'][1],
            'supGoldGap': pos_gold['UTILITY'][0] - pos_gold['UTILITY'][1],
            'allyTowers': ally_towers,
            'enemyTowers': enemy_towers,
            'allyDragons': ally_dragons,
            'enemyDragons': enemy_dragons,
            'allyBarons': ally_barons,
            'enemyBarons': enemy_barons,
            'allyHeralds': ally_heralds,
            'enemyHeralds': enemy_heralds,
            'allyInhibitors': ally_inhibitors,
            'enemyInhibitors': enemy_inhibitors,
            'allyKills': ally_kills_total,
            'enemyKills': enemy_kills_total,
            'allyDeaths': ally_deaths_total,
            'enemyDeaths': enemy_deaths_total,
            'killDiff': ally_kills_total - enemy_kills_total,
            'allyChampions': ally_champs,
            'enemyChampions': enemy_champs,
            'userChampion': user['championName'],
            'userPosition': user.get('teamPosition', 'BOTTOM'),
            'userKills': user_kills,
            'userDeaths': user_deaths,
            'userAssists': user_assists,
            'userCS': user_cs,
            'userLevel': user_level,
            'userItemCount': user_items,
            'outcome': outcome,
        }
        snapshots.append(snapshot)

    return snapshots


def main():
    print("=" * 60)
    print("Timeline -> Real Training Data Converter")
    print("=" * 60)

    if not os.path.exists(TIMELINE_DIR):
        print(f"No timeline directory: {TIMELINE_DIR}")
        print("Run fetch_timelines.py first!")
        sys.exit(1)

    # Find matches that have both match data and timeline data
    match_files = set(f for f in os.listdir(MATCH_DIR) if f.endswith('.json'))
    timeline_files = set(f for f in os.listdir(TIMELINE_DIR) if f.endswith('.json'))
    common = sorted(match_files & timeline_files)
    print(f"Matches with timelines: {len(common)}")

    puuid = find_user_puuid()
    if not puuid:
        print("Could not find your account!")
        sys.exit(1)
    print(f"PUUID: {puuid[:15]}...")

    os.makedirs(DATA_DIR, exist_ok=True)

    total_snapshots = 0
    converted = 0
    skipped = 0
    wins = 0

    with open(OUTPUT_FILE, 'w') as out:
        for i, filename in enumerate(common):
            match_path = os.path.join(MATCH_DIR, filename)
            timeline_path = os.path.join(TIMELINE_DIR, filename)

            match_data = json.load(open(match_path))
            timeline_data = json.load(open(timeline_path))

            match_id = filename.replace('.json', '')
            snapshots = convert_match_with_timeline(match_data, timeline_data, puuid, match_id)

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
                print(f"  Processed {i+1}/{len(common)} matches...")

    win_rate = (wins / converted * 100) if converted > 0 else 0
    print(f"\nDone!")
    print(f"  Converted: {converted} matches ({skipped} skipped)")
    print(f"  Win rate:  {win_rate:.1f}%")
    print(f"  Snapshots: {total_snapshots}")
    print(f"  Output:    {OUTPUT_FILE}")
    print(f"  File size: {os.path.getsize(OUTPUT_FILE) / 1024:.1f} KB")
    print(f"\n  THIS IS REAL DATA - not interpolated!")


if __name__ == '__main__':
    main()
