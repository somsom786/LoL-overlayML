// =============================================================================
// DataService — Polls the Live Client Data API or falls back to mock data
// =============================================================================

import type { LiveGameData } from '../types';
import { getMockGameData, startMockClock } from './MockDataService';
import { startRecording, recordSnapshot, stopRecording, detectGameEnd, isRecording } from './MatchRecorder';

// In dev mode, use Vite's proxy to bypass Riot's self-signed SSL cert.
// In Electron production, use the direct URL (Electron handles cert errors).
const LIVE_API_URL = '/riot-api/liveclientdata/allgamedata';
const POLL_INTERVAL = 500; // ms

export type DataSource = 'live' | 'mock';

interface DataServiceState {
    source: DataSource;
    data: LiveGameData | null;
    isConnected: boolean;
    error: string | null;
    listeners: Set<(data: LiveGameData) => void>;
    pollTimer: ReturnType<typeof setInterval> | null;
}

const state: DataServiceState = {
    source: 'mock',
    data: null,
    isConnected: false,
    error: null,
    listeners: new Set(),
    pollTimer: null,
};

/** Subscribe to game data updates. Returns an unsubscribe function. */
export function subscribe(listener: (data: LiveGameData) => void): () => void {
    state.listeners.add(listener);
    // Immediately emit the latest data if available
    if (state.data) listener(state.data);
    return () => state.listeners.delete(listener);
}

function emit(data: LiveGameData) {
    state.data = data;
    state.listeners.forEach((fn) => fn(data));
}

/** Attempt to fetch from the real Live Client API */
async function fetchLiveData(): Promise<LiveGameData | null> {
    try {
        // SSL bypass is handled by Vite proxy (dev) or Electron (prod)
        const response = await fetch(LIVE_API_URL, {
            signal: AbortSignal.timeout(2000),
        });
        if (!response.ok) return null;
        const data = (await response.json()) as LiveGameData;
        return data;
    } catch (err) {
        // Connection refused = game not running, which is expected
        return null;
    }
}

async function poll() {
    // Try live data first
    const liveData = await fetchLiveData();
    if (liveData) {
        if (state.source !== 'live') {
            state.source = 'live';
            state.isConnected = true;
            state.error = null;
            console.log('[DataService] Connected to Live Client API');
            startRecording(liveData);
        }
        // Record snapshot for ML training
        if (isRecording()) {
            recordSnapshot(liveData);
            const gameEnd = detectGameEnd(liveData);
            if (gameEnd.ended) {
                stopRecording(gameEnd.won ? 1 : 0);
            }
        }
        emit(liveData);
    } else {
        // No live game detected — clear data
        if (state.source !== 'mock') {
            state.source = 'mock';
            state.isConnected = false;
            console.log('[DataService] Live API unavailable — waiting for game');
            if (isRecording()) {
                stopRecording(0);
            }
        }
        // Don't emit mock data — let the UI show a "waiting" state
        state.data = null;
    }
}

/** Start polling loop */
export function startPolling() {
    if (state.pollTimer) return;
    console.log('[DataService] Starting polling loop (500ms)');
    poll(); // Initial fetch
    state.pollTimer = setInterval(poll, POLL_INTERVAL);
}

/** Stop polling loop */
export function stopPolling() {
    if (state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
        console.log('[DataService] Polling stopped');
    }
}

/** Get current data source */
export function getSource(): DataSource {
    return state.source;
}

/** Get current connection state */
export function isConnected(): boolean {
    return state.isConnected;
}
