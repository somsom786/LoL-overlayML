"""
features.py — Feature extraction and normalization for ML models.
Transforms raw JSONL snapshots into model-ready feature vectors.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any

# ── Feature columns used by the models ──────────────────────────────────────

NUMERIC_FEATURES = [
    'gameTime',
    'goldDiff',
    'goldDiffPerMin',
    'allyGold',
    'enemyGold',
    'allyCSTotal',
    'enemyCSTotal',
    'topGoldGap',
    'jglGoldGap',
    'midGoldGap',
    'botGoldGap',
    'supGoldGap',
    'allyTowers',
    'enemyTowers',
    'towerDiff',
    'allyDragons',
    'enemyDragons',
    'dragonDiff',
    'allyBarons',
    'enemyBarons',
    'allyHeralds',
    'enemyHeralds',
    'allyKills',
    'enemyKills',
    'killDiff',
    'allyDeaths',
    'enemyDeaths',
    'userKills',
    'userDeaths',
    'userAssists',
    'userCS',
    'userLevel',
    'userItemCount',
    'userKDA',
    'gamePhaseNum',
]

FEATURE_COLUMNS = NUMERIC_FEATURES


def extract_features(snapshot: Dict[str, Any]) -> Dict[str, float]:
    """Convert a raw training snapshot into a normalized feature dict."""
    deaths = max(snapshot.get('userDeaths', 1), 1)
    kda = (snapshot.get('userKills', 0) + snapshot.get('userAssists', 0)) / deaths

    phase_map = {'EARLY': 0, 'MID': 1, 'LATE': 2}
    phase = phase_map.get(snapshot.get('gamePhase', 'EARLY'), 0)

    return {
        'gameTime': snapshot.get('gameTime', 0),
        'goldDiff': snapshot.get('goldDiff', 0),
        'goldDiffPerMin': snapshot.get('goldDiffPerMin', 0),
        'allyGold': snapshot.get('allyGold', 0),
        'enemyGold': snapshot.get('enemyGold', 0),
        'allyCSTotal': snapshot.get('allyCSTotal', 0),
        'enemyCSTotal': snapshot.get('enemyCSTotal', 0),
        'topGoldGap': snapshot.get('topGoldGap', 0),
        'jglGoldGap': snapshot.get('jglGoldGap', 0),
        'midGoldGap': snapshot.get('midGoldGap', 0),
        'botGoldGap': snapshot.get('botGoldGap', 0),
        'supGoldGap': snapshot.get('supGoldGap', 0),
        'allyTowers': snapshot.get('allyTowers', 0),
        'enemyTowers': snapshot.get('enemyTowers', 0),
        'towerDiff': snapshot.get('allyTowers', 0) - snapshot.get('enemyTowers', 0),
        'allyDragons': snapshot.get('allyDragons', 0),
        'enemyDragons': snapshot.get('enemyDragons', 0),
        'dragonDiff': snapshot.get('allyDragons', 0) - snapshot.get('enemyDragons', 0),
        'allyBarons': snapshot.get('allyBarons', 0),
        'enemyBarons': snapshot.get('enemyBarons', 0),
        'allyHeralds': snapshot.get('allyHeralds', 0),
        'enemyHeralds': snapshot.get('enemyHeralds', 0),
        'allyKills': snapshot.get('allyKills', 0),
        'enemyKills': snapshot.get('enemyKills', 0),
        'killDiff': snapshot.get('killDiff', 0),
        'allyDeaths': snapshot.get('allyDeaths', 0),
        'enemyDeaths': snapshot.get('enemyDeaths', 0),
        'userKills': snapshot.get('userKills', 0),
        'userDeaths': snapshot.get('userDeaths', 0),
        'userAssists': snapshot.get('userAssists', 0),
        'userCS': snapshot.get('userCS', 0),
        'userLevel': snapshot.get('userLevel', 1),
        'userItemCount': snapshot.get('userItemCount', 0),
        'userKDA': kda,
        'gamePhaseNum': phase,
    }


def snapshot_to_dataframe(snapshots: List[Dict[str, Any]]) -> pd.DataFrame:
    """Convert a list of raw snapshots into a feature DataFrame."""
    features = [extract_features(s) for s in snapshots]
    df = pd.DataFrame(features)

    # Ensure all expected columns exist
    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            df[col] = 0.0

    return df[FEATURE_COLUMNS]


def determine_spike_status(snapshot: Dict[str, Any]) -> str:
    """Heuristic for power spike based on items and gold diff."""
    items = snapshot.get('userItemCount', 0)
    gold_diff = snapshot.get('goldDiff', 0)
    game_time = snapshot.get('gameTime', 0)
    game_min = game_time / 60

    # Spike detection based on completed item thresholds
    if items >= 3 and gold_diff > 1000 and game_min < 25:
        return 'active'
    elif items >= 2 and gold_diff > 500:
        return 'approaching'
    elif game_min > 30:
        return 'past'
    return 'none'


def determine_comeback_path(snapshot: Dict[str, Any], comeback_prob: float) -> str | None:
    """Suggest a comeback action based on game state."""
    if snapshot.get('goldDiff', 0) >= -1500:
        return None  # Not in a deficit

    dragon_diff = snapshot.get('allyDragons', 0) - snapshot.get('enemyDragons', 0)
    tower_diff = snapshot.get('allyTowers', 0) - snapshot.get('enemyTowers', 0)
    kill_diff = snapshot.get('killDiff', 0)

    if comeback_prob < 0.15:
        return 'stall_and_scale'
    elif dragon_diff < -1:
        return 'focus_baron'
    elif tower_diff < -2:
        return 'split_push'
    elif kill_diff < -5:
        return 'pick_carry'
    else:
        return 'teamfight_at_objective'
