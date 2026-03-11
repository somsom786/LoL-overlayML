"""
server.py — FastAPI inference bridge for the LoL ML Hub.
Loads all three trained models and serves predictions via REST API.

Run: uvicorn server:app --host 127.0.0.1 --port 8421 --reload
"""

import os
import time
from typing import Dict, Any, Optional

import numpy as np
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from features import extract_features, FEATURE_COLUMNS, determine_spike_status, determine_comeback_path

# ── App Setup ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="LoL ML Hub",
    description="Live inference for win probability, power spikes, and comeback analysis",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow Electron/browser to connect
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model Loading ───────────────────────────────────────────────────────────

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

models = {
    'win_prob': None,      # XGBoost
    'spike': None,         # Random Forest
    'comeback': None,      # Logistic Regression
}

model_info = {
    'loaded_at': None,
    'win_prob_ready': False,
    'spike_ready': False,
    'comeback_ready': False,
}


def load_models():
    """Load trained models from disk."""
    global models, model_info

    win_path = os.path.join(MODELS_DIR, 'win_prob_xgb.joblib')
    spike_path = os.path.join(MODELS_DIR, 'spike_rf.joblib')
    comeback_path = os.path.join(MODELS_DIR, 'comeback_lr.joblib')

    if os.path.exists(win_path):
        models['win_prob'] = joblib.load(win_path)
        model_info['win_prob_ready'] = True
        print(f"[ML Hub] Loaded win_prob model")

    if os.path.exists(spike_path):
        models['spike'] = joblib.load(spike_path)
        model_info['spike_ready'] = True
        print(f"[ML Hub] Loaded spike model")

    if os.path.exists(comeback_path):
        models['comeback'] = joblib.load(comeback_path)
        model_info['comeback_ready'] = True
        print(f"[ML Hub] Loaded comeback model")

    model_info['loaded_at'] = time.time()
    ready_count = sum(1 for v in [model_info['win_prob_ready'], model_info['spike_ready'], model_info['comeback_ready']] if v)
    print(f"[ML Hub] {ready_count}/3 models loaded")


# Load models on startup
load_models()


# ── Request/Response Models ─────────────────────────────────────────────────

class GameStateRequest(BaseModel):
    """Accepts a training snapshot or live game state."""
    gameTime: float = 0
    gamePhase: str = "EARLY"
    allyGold: float = 0
    enemyGold: float = 0
    goldDiff: float = 0
    goldDiffPerMin: float = 0
    allyCSTotal: float = 0
    enemyCSTotal: float = 0
    topGoldGap: float = 0
    jglGoldGap: float = 0
    midGoldGap: float = 0
    botGoldGap: float = 0
    supGoldGap: float = 0
    allyTowers: int = 0
    enemyTowers: int = 0
    allyDragons: int = 0
    enemyDragons: int = 0
    allyBarons: int = 0
    enemyBarons: int = 0
    allyHeralds: int = 0
    enemyHeralds: int = 0
    allyInhibitors: int = 0
    enemyInhibitors: int = 0
    allyKills: int = 0
    enemyKills: int = 0
    allyDeaths: int = 0
    enemyDeaths: int = 0
    killDiff: int = 0
    userKills: int = 0
    userDeaths: int = 0
    userAssists: int = 0
    userCS: int = 0
    userLevel: int = 1
    userItemCount: int = 0


class PredictionResponse(BaseModel):
    win_prob: float
    spike_status: str
    spike_window: str
    comeback_path: Optional[str]
    comeback_prob: float
    model_confidence: float


class HealthResponse(BaseModel):
    status: str
    models_loaded: int
    win_prob_ready: bool
    spike_ready: bool
    comeback_ready: bool
    uptime_seconds: float


# ── Endpoints ───────────────────────────────────────────────────────────────

@app.post("/predict", response_model=PredictionResponse)
async def predict(state: GameStateRequest):
    """Run inference on all three models and return combined prediction."""
    snapshot = state.model_dump()
    features = extract_features(snapshot)

    # Build feature vector in correct order
    feature_vector = np.array([[features.get(col, 0) for col in FEATURE_COLUMNS]])

    # ── Engine A: Win Probability ──
    win_prob = 0.5  # Default to 50%
    model_confidence = 0.0

    if models['win_prob'] is not None:
        try:
            proba = models['win_prob'].predict_proba(feature_vector)
            win_prob = float(proba[0][1])
            # Confidence based on how far from 50% the prediction is
            model_confidence = abs(win_prob - 0.5) * 2
        except Exception as e:
            print(f"[Engine A] Error: {e}")

    # ── Engine B: Power Spike ──
    spike_status = determine_spike_status(snapshot)
    spike_window = "N/A"

    if models['spike'] is not None:
        try:
            spike_pred = models['spike'].predict_proba(feature_vector)
            spike_prob = float(spike_pred[0][1]) if spike_pred.shape[1] > 1 else 0.0

            if spike_prob > 0.7:
                spike_status = 'active'
                spike_window = 'NOW — press your advantage'
            elif spike_prob > 0.4:
                spike_status = 'approaching'
                items_needed = max(1, 3 - snapshot.get('userItemCount', 0))
                spike_window = f'{items_needed} item(s) away from spike'
            else:
                if snapshot.get('gameTime', 0) > 1800:
                    spike_status = 'past'
                    spike_window = 'Power spike window has passed'
                else:
                    spike_status = 'none'
                    spike_window = 'Building toward spike'
        except Exception as e:
            print(f"[Engine B] Error: {e}")

    # ── Engine C: Comeback Heuristic ──
    comeback_prob = 0.0
    comeback_path = None

    if models['comeback'] is not None and snapshot.get('goldDiff', 0) < -1500:
        try:
            cb_proba = models['comeback'].predict_proba(feature_vector)
            comeback_prob = float(cb_proba[0][1]) if cb_proba.shape[1] > 1 else 0.0
            comeback_path = determine_comeback_path(snapshot, comeback_prob)
        except Exception as e:
            print(f"[Engine C] Error: {e}")

    return PredictionResponse(
        win_prob=round(win_prob, 4),
        spike_status=spike_status,
        spike_window=spike_window,
        comeback_path=comeback_path,
        comeback_prob=round(comeback_prob, 4),
        model_confidence=round(model_confidence, 4),
    )


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check and model status."""
    loaded = sum(1 for m in models.values() if m is not None)
    uptime = time.time() - (model_info['loaded_at'] or time.time())

    return HealthResponse(
        status="healthy" if loaded > 0 else "no_models",
        models_loaded=loaded,
        win_prob_ready=model_info['win_prob_ready'],
        spike_ready=model_info['spike_ready'],
        comeback_ready=model_info['comeback_ready'],
        uptime_seconds=round(uptime, 1),
    )


@app.post("/reload")
async def reload_models():
    """Hot-reload models without restarting the server."""
    load_models()
    loaded = sum(1 for m in models.values() if m is not None)
    return {"status": "reloaded", "models_loaded": loaded}
