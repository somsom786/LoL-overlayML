"""
generate_synthetic.py — Creates ~5,000 synthetic match snapshots for initial
model training, based on statistical distributions from high-ELO game data.

Run: python generate_synthetic.py
Output: data/synthetic_training.jsonl
"""

import json
import os
import random
import math

random.seed(42)

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'synthetic_training.jsonl')

# ── Statistical Distributions (based on Plat+ game patterns) ────────────────

MEAN_GAME_LENGTH = 28 * 60  # 28 minutes in seconds
GOLD_PER_MIN_MEAN = 420  # per player
CS_PER_MIN_MEAN = 7.2
KILLS_PER_MIN_TEAM = 0.35

CHAMPIONS = [
    'Jinx', 'Kaisa', 'Vayne', 'Draven', 'Caitlyn', 'Ezreal', 'Jhin',
    'Ahri', 'Syndra', 'Viktor', 'Orianna', 'Azir', 'Lux', 'Xerath',
    'Zed', 'Talon', 'Katarina', 'Akali', 'Fizz', 'Yone', 'Yasuo',
    'Darius', 'Garen', 'Jax', 'Fiora', 'Camille', 'Irelia', 'Riven',
    'Ornn', 'Malphite', 'Maokai', 'Shen', 'DrMundo', 'KSante',
    'LeeSin', 'Vi', 'JarvanIV', 'Viego', 'Briar', 'Hecarim', 'Kayn',
    'Thresh', 'Nautilus', 'Leona', 'Lulu', 'Janna', 'Soraka', 'Nami',
]


def generate_match():
    """Generate one complete match with multiple time snapshots."""
    # Match outcome (50/50 baseline, adjusted by snowball factor)
    snowball = random.gauss(0, 1.0)  # Positive = winning team is our team
    outcome = 1 if snowball > -0.1 else 0  # Slight >50% because we adjust for skill

    game_length = max(900, min(3000, int(random.gauss(MEAN_GAME_LENGTH, 300))))

    # Pick champions
    champs = random.sample(CHAMPIONS, 10)
    ally_champs = sorted(champs[:5])
    enemy_champs = sorted(champs[5:])
    user_champ = ally_champs[random.randint(0, 4)]
    user_pos = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'][ally_champs.index(user_champ)]

    snapshots = []
    for t in range(30, game_length, 30):
        snapshot = generate_snapshot(
            t, game_length, outcome, snowball,
            ally_champs, enemy_champs, user_champ, user_pos
        )
        snapshots.append(snapshot)

    return snapshots


def generate_snapshot(t, game_length, outcome, snowball, ally_champs, enemy_champs, user_champ, user_pos):
    """Generate a single 30-second snapshot."""
    game_min = t / 60
    progress = t / game_length  # 0.0 to 1.0

    # ── Gold generation (with snowball effect) ──
    # Gold advantage grows over time if winning
    gold_lead_factor = snowball * (1 + progress) * 800
    noise = random.gauss(0, 500)

    ally_gold = int(GOLD_PER_MIN_MEAN * game_min * 5 + gold_lead_factor + noise)
    enemy_gold = int(GOLD_PER_MIN_MEAN * game_min * 5 - gold_lead_factor - noise)
    gold_diff = ally_gold - enemy_gold

    # Position gold gaps (noisy version of overall lead)
    lane_spread = gold_lead_factor / 5
    top_gap = int(lane_spread + random.gauss(0, 400))
    jgl_gap = int(lane_spread * 0.8 + random.gauss(0, 350))
    mid_gap = int(lane_spread * 1.1 + random.gauss(0, 450))
    bot_gap = int(lane_spread * 1.2 + random.gauss(0, 500))
    sup_gap = int(lane_spread * 0.3 + random.gauss(0, 200))

    # ── CS ──
    cs_noise = random.gauss(0, 15)
    ally_cs = int(CS_PER_MIN_MEAN * game_min * 5 + cs_noise)
    enemy_cs = int(CS_PER_MIN_MEAN * game_min * 5 - cs_noise * 0.5)

    # ── Kills ──
    total_kills = int(KILLS_PER_MIN_TEAM * game_min * 2)
    kill_skew = 0.55 if outcome == 1 else 0.45
    ally_kills = int(total_kills * kill_skew + random.gauss(0, 2))
    enemy_kills = int(total_kills * (1 - kill_skew) + random.gauss(0, 2))
    ally_kills = max(0, ally_kills)
    enemy_kills = max(0, enemy_kills)

    # ── Objectives ──
    # Towers fall over time, more for winning team
    max_towers = min(int(progress * 11), 11)
    ally_towers = min(max_towers, int(max_towers * (0.6 if outcome == 1 else 0.4) + random.gauss(0, 1)))
    enemy_towers = min(max_towers - ally_towers, int(max_towers * (0.4 if outcome == 1 else 0.6) + random.gauss(0, 1)))
    ally_towers = max(0, min(11, ally_towers))
    enemy_towers = max(0, min(11, enemy_towers))

    # Dragons (every ~5 min)
    max_drags = min(int(game_min / 5), 4)
    ally_drags = min(max_drags, int(max_drags * (0.6 if outcome == 1 else 0.35) + random.gauss(0, 0.5)))
    enemy_drags = min(max_drags - ally_drags, int(max_drags * (0.35 if outcome == 1 else 0.6) + random.gauss(0, 0.5)))
    ally_drags = max(0, ally_drags)
    enemy_drags = max(0, enemy_drags)

    # Baron (after 20 min)
    ally_baron = 1 if game_min > 22 and outcome == 1 and random.random() > 0.6 else 0
    enemy_baron = 1 if game_min > 22 and outcome == 0 and random.random() > 0.6 else 0

    # Herald
    ally_herald = 1 if game_min > 8 and random.random() > 0.5 else 0
    enemy_herald = 1 if game_min > 8 and random.random() > 0.5 and ally_herald == 0 else 0

    # Inhibs (late game)
    ally_inhib = 1 if progress > 0.7 and outcome == 1 and random.random() > 0.5 else 0
    enemy_inhib = 1 if progress > 0.7 and outcome == 0 and random.random() > 0.5 else 0

    # ── User stats ──
    user_kills_share = random.uniform(0.15, 0.35)
    user_kills = max(0, int(ally_kills * user_kills_share))
    user_deaths = max(0, int(enemy_kills * random.uniform(0.12, 0.28)))
    user_assists = max(0, int(ally_kills * random.uniform(0.3, 0.6)))
    user_cs = max(0, int(CS_PER_MIN_MEAN * game_min + random.gauss(0, 20)))
    user_level = min(18, max(1, int(1 + game_min * 0.6)))
    user_items = min(6, max(0, int(game_min / 5.5)))

    phase = 'EARLY' if game_min < 14 else 'MID' if game_min < 28 else 'LATE'

    return {
        'gameTime': t,
        'gamePhase': phase,
        'allyGold': max(0, ally_gold),
        'enemyGold': max(0, enemy_gold),
        'goldDiff': gold_diff,
        'goldDiffPerMin': gold_diff / max(game_min, 0.1),
        'allyCSTotal': max(0, ally_cs),
        'enemyCSTotal': max(0, enemy_cs),
        'topGoldGap': top_gap,
        'jglGoldGap': jgl_gap,
        'midGoldGap': mid_gap,
        'botGoldGap': bot_gap,
        'supGoldGap': sup_gap,
        'allyTowers': ally_towers,
        'enemyTowers': enemy_towers,
        'allyDragons': ally_drags,
        'enemyDragons': enemy_drags,
        'allyBarons': ally_baron,
        'enemyBarons': enemy_baron,
        'allyHeralds': ally_herald,
        'enemyHeralds': enemy_herald,
        'allyInhibitors': ally_inhib,
        'enemyInhibitors': enemy_inhib,
        'allyKills': ally_kills,
        'enemyKills': enemy_kills,
        'allyDeaths': enemy_kills,  # ally deaths = enemy kills
        'enemyDeaths': ally_kills,
        'killDiff': ally_kills - enemy_kills,
        'allyChampions': ally_champs,
        'enemyChampions': enemy_champs,
        'userChampion': user_champ,
        'userPosition': user_pos,
        'userKills': user_kills,
        'userDeaths': user_deaths,
        'userAssists': user_assists,
        'userCS': user_cs,
        'userLevel': user_level,
        'userItemCount': user_items,
        'outcome': outcome,
    }


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    total_snapshots = 0
    total_matches = 500  # 500 matches × ~56 snapshots each ≈ 28,000 snapshots

    print(f"Generating {total_matches} synthetic matches...")

    with open(OUTPUT_FILE, 'w') as f:
        for i in range(total_matches):
            match_snapshots = generate_match()
            for snap in match_snapshots:
                f.write(json.dumps(snap) + '\n')
                total_snapshots += 1

            if (i + 1) % 100 == 0:
                print(f"  Generated {i + 1}/{total_matches} matches ({total_snapshots} snapshots)")

    wins = sum(1 for _ in range(total_matches) if random.random() > 0.5)
    print(f"\nDone! Generated {total_snapshots} snapshots from {total_matches} matches")
    print(f"Output: {OUTPUT_FILE}")
    print(f"File size: {os.path.getsize(OUTPUT_FILE) / 1024 / 1024:.1f} MB")


if __name__ == '__main__':
    main()
