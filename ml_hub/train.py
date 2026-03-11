"""
train.py — Reads JSONL match data, cleans it, and trains three ML models:
  Engine A: XGBoost Win Probability Classifier
  Engine B: Random Forest Power Spike Predictor
  Engine C: Logistic Regression Comeback Heuristic

Run: python train.py
Output: models/win_prob_xgb.joblib, models/spike_rf.joblib, models/comeback_lr.joblib
"""

import json
import os
import sys
import time
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, GroupShuffleSplit
from sklearn.metrics import accuracy_score, roc_auc_score, classification_report
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
import xgboost as xgb
import joblib

from features import extract_features, FEATURE_COLUMNS

# ── Paths ───────────────────────────────────────────────────────────────────

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')


def load_data() -> pd.DataFrame:
    """Load real match JSONL files from the data directory (no synthetic data)."""
    all_snapshots = []

    if os.path.exists(DATA_DIR):
        for filename in os.listdir(DATA_DIR):
            if filename.endswith('.jsonl') and not filename.startswith('synthetic'):
                filepath = os.path.join(DATA_DIR, filename)
                count = 0
                with open(filepath, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            snap = json.loads(line)
                            if snap.get('outcome', -1) in (0, 1):
                                all_snapshots.append(snap)
                                count += 1
                print(f"  Loaded {count} snapshots from {filename}")

    if not all_snapshots:
        print("ERROR: No real match data found!")
        print(f"Run 'python convert_matches.py' first to convert match history in {DATA_DIR}")
        sys.exit(1)

    print(f"Loaded {len(all_snapshots)} snapshots total")

    # Extract features
    features = [extract_features(s) for s in all_snapshots]
    df = pd.DataFrame(features)
    df['outcome'] = [s['outcome'] for s in all_snapshots]
    df['goldDiff_raw'] = [s.get('goldDiff', 0) for s in all_snapshots]
    df['match_id'] = [s.get('match_id', f'unknown_{i}') for i, s in enumerate(all_snapshots)]

    return df


def group_split(df, test_size=0.2):
    """Split data by match_id so all snapshots from the same game stay together."""
    gss = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=42)
    groups = df['match_id'].values
    train_idx, test_idx = next(gss.split(df, groups=groups))
    return train_idx, test_idx


def train_engine_a(df: pd.DataFrame):
    """Engine A: XGBoost Win Probability Classifier."""
    print("\n" + "=" * 60)
    print("ENGINE A: XGBoost Win Probability")
    print("=" * 60)

    X = df[FEATURE_COLUMNS].values
    y = df['outcome'].values

    # Split BY MATCH — no leakage between train/test
    train_idx, test_idx = group_split(df)
    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]
    n_train_matches = df.iloc[train_idx]['match_id'].nunique()
    n_test_matches = df.iloc[test_idx]['match_id'].nunique()

    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric='logloss',
        random_state=42,
        verbosity=0,
    )

    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    # Evaluate
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    acc = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)

    print(f"  Accuracy: {acc:.4f}")
    print(f"  AUC-ROC:  {auc:.4f}")
    print(f"  Samples:  {len(X_train)} train / {len(X_test)} test")
    print(f"  Matches:  {n_train_matches} train / {n_test_matches} test (no overlap)")

    # Feature importance
    importance = model.feature_importances_
    top_features = sorted(zip(FEATURE_COLUMNS, importance), key=lambda x: x[1], reverse=True)[:5]
    print(f"  Top features: {', '.join(f'{name}({imp:.3f})' for name, imp in top_features)}")

    # Save
    model_path = os.path.join(MODELS_DIR, 'win_prob_xgb.joblib')
    joblib.dump(model, model_path)
    print(f"  Saved: {model_path}")

    return model


def train_engine_b(df: pd.DataFrame):
    """Engine B: Random Forest Power Spike Predictor.
    Labels: 1 = in a power spike (gold ahead AND items > opponents), 0 = not.
    """
    print("\n" + "=" * 60)
    print("ENGINE B: Random Forest Power Spike Predictor")
    print("=" * 60)

    # Create spike labels: considered a "spike" if gold diff is positive
    # AND the game is at a critical items threshold
    df_copy = df.copy()
    df_copy['is_spike'] = (
        (df_copy['goldDiff'] > 1000) &
        (df_copy['userItemCount'] >= 2) &
        (df_copy['gameTime'] < 1800)  # Spikes matter most before 30 min
    ).astype(int)

    X = df_copy[FEATURE_COLUMNS].values
    y = df_copy['is_spike'].values

    train_idx, test_idx = group_split(df_copy)
    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    model = RandomForestClassifier(
        n_estimators=150,
        max_depth=8,
        min_samples_split=10,
        random_state=42,
        n_jobs=-1,
    )

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"  Accuracy: {acc:.4f}")
    print(f"  Spike rate: {y.mean():.2%} of snapshots")
    print(f"  Samples:  {len(X_train)} train / {len(X_test)} test")

    model_path = os.path.join(MODELS_DIR, 'spike_rf.joblib')
    joblib.dump(model, model_path)
    print(f"  Saved: {model_path}")

    return model


def train_engine_c(df: pd.DataFrame):
    """Engine C: Logistic Regression Comeback Heuristic.
    Trained ONLY on deficit games (goldDiff < -3000) to predict win probability.
    """
    print("\n" + "=" * 60)
    print("ENGINE C: Logistic Regression Comeback Heuristic")
    print("=" * 60)

    # Filter to deficit snapshots only
    deficit_mask = df['goldDiff_raw'] < -3000
    df_deficit = df[deficit_mask].copy()

    if len(df_deficit) < 50:
        print(f"  WARNING: Only {len(df_deficit)} deficit snapshots — need at least 50")
        print("  Expanding threshold to goldDiff < -1500")
        deficit_mask = df['goldDiff_raw'] < -1500
        df_deficit = df[deficit_mask].copy()

    if len(df_deficit) < 20:
        print("  ERROR: Not enough deficit data to train. Skipping Engine C.")
        return None

    X = df_deficit[FEATURE_COLUMNS].values
    y = df_deficit['outcome'].values

    train_idx, test_idx = group_split(df_deficit, test_size=0.25)
    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    model = LogisticRegression(
        max_iter=1000,
        C=0.5,
        random_state=42,
    )

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    win_rate = y.mean()

    print(f"  Accuracy: {acc:.4f}")
    print(f"  Comeback win rate: {win_rate:.2%}")
    print(f"  Deficit samples: {len(df_deficit)} ({len(X_train)} train / {len(X_test)} test)")

    model_path = os.path.join(MODELS_DIR, 'comeback_lr.joblib')
    joblib.dump(model, model_path)
    print(f"  Saved: {model_path}")

    return model


def main():
    start = time.time()
    print("=" * 60)
    print("LoL Overlay ML Training Pipeline")
    print("=" * 60)

    os.makedirs(MODELS_DIR, exist_ok=True)

    # Load data
    df = load_data()
    print(f"\nDataset shape: {df.shape}")
    print(f"Win rate: {df['outcome'].mean():.2%}")
    print(f"Gold diff range: [{df['goldDiff'].min():.0f}, {df['goldDiff'].max():.0f}]")

    # Train all three engines
    train_engine_a(df)
    train_engine_b(df)
    train_engine_c(df)

    elapsed = time.time() - start
    print(f"\n{'=' * 60}")
    print(f"All models trained in {elapsed:.1f}s")
    print(f"Models saved to: {MODELS_DIR}")
    print(f"{'=' * 60}")


if __name__ == '__main__':
    main()
