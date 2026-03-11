// =============================================================================
// MLService — Queries the Python FastAPI ML Hub for predictions
// Falls back gracefully when the ML server is offline.
// =============================================================================

const ML_API_URL = 'http://127.0.0.1:8421';
const QUERY_INTERVAL = 30_000; // 30 seconds

export interface MLPrediction {
    win_prob: number;             // 0.0 - 1.0
    spike_status: 'active' | 'approaching' | 'past' | 'none';
    spike_window: string;         // e.g., "2-3 items (next 5 min)"
    comeback_path: string | null; // e.g., "focus_baron", "pick_carry"
    comeback_prob: number;        // 0.0 - 1.0
    model_confidence: number;     // 0.0 - 1.0
}

interface MLServiceState {
    isOnline: boolean;
    lastPrediction: MLPrediction | null;
    lastQueryTime: number;
    queryTimer: ReturnType<typeof setInterval> | null;
    listeners: Set<(pred: MLPrediction) => void>;
}

const state: MLServiceState = {
    isOnline: false,
    lastPrediction: null,
    lastQueryTime: 0,
    queryTimer: null,
    listeners: new Set(),
};

/** Subscribe to ML prediction updates */
export function subscribeML(listener: (pred: MLPrediction) => void): () => void {
    state.listeners.add(listener);
    if (state.lastPrediction) listener(state.lastPrediction);
    return () => state.listeners.delete(listener);
}

function emitML(pred: MLPrediction) {
    state.lastPrediction = pred;
    state.listeners.forEach((fn) => fn(pred));
}

/** Send current game state to the ML hub for inference */
export async function queryMLHub(gameState: Record<string, unknown>): Promise<MLPrediction | null> {
    try {
        const response = await fetch(`${ML_API_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gameState),
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return null;
        const prediction = (await response.json()) as MLPrediction;
        state.isOnline = true;
        emitML(prediction);
        return prediction;
    } catch {
        if (state.isOnline) {
            state.isOnline = false;
            console.log('[MLService] ML Hub offline — using rule-based fallback');
        }
        return null;
    }
}

/** Check if the ML Hub is online */
export async function checkMLHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${ML_API_URL}/health`, {
            signal: AbortSignal.timeout(3000),
        });
        state.isOnline = response.ok;
        return response.ok;
    } catch {
        state.isOnline = false;
        return false;
    }
}

/** Get current ML server status */
export function isMLOnline(): boolean {
    return state.isOnline;
}

export function getLastPrediction(): MLPrediction | null {
    return state.lastPrediction;
}
