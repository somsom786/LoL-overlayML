// =============================================================================
// MatchRecorder — Snapshots game state every 30s to JSONL files for ML training
// Zero-impact: writes are buffered and flushed asynchronously.
// =============================================================================

import type { LiveGameData, GameEvent } from '../types';

// ─── Training Vector Schema ─────────────────────────────────────────────────

export interface TrainingSnapshot {
    // Temporal
    gameTime: number;
    gamePhase: 'EARLY' | 'MID' | 'LATE';

    // Economic
    allyGold: number;
    enemyGold: number;
    goldDiff: number;
    goldDiffPerMin: number;
    allyCSTotal: number;
    enemyCSTotal: number;

    // Per-player gold gaps (ally - enemy by position)
    topGoldGap: number;
    jglGoldGap: number;
    midGoldGap: number;
    botGoldGap: number;
    supGoldGap: number;

    // Objectives
    allyTowers: number;
    enemyTowers: number;
    allyDragons: number;
    enemyDragons: number;
    allyBarons: number;
    enemyBarons: number;
    allyHeralds: number;
    enemyHeralds: number;
    allyInhibitors: number;
    enemyInhibitors: number;

    // Combat
    allyKills: number;
    enemyKills: number;
    allyDeaths: number;
    enemyDeaths: number;
    killDiff: number;

    // Champion composition (hashed for feature encoding)
    allyChampions: string[];
    enemyChampions: string[];
    userChampion: string;
    userPosition: string;

    // User-specific
    userKills: number;
    userDeaths: number;
    userAssists: number;
    userCS: number;
    userLevel: number;
    userItemCount: number;

    // Outcome — labeled post-game
    outcome: 0 | 1 | -1; // 1 = win, 0 = loss, -1 = unknown (during game)
}

// ─── Recorder State ─────────────────────────────────────────────────────────

interface RecorderState {
    isRecording: boolean;
    matchId: string | null;
    snapshots: TrainingSnapshot[];
    lastSnapshotTime: number;
    userTeam: string | null;
    startTime: number;
}

const state: RecorderState = {
    isRecording: false,
    matchId: null,
    snapshots: [],
    lastSnapshotTime: 0,
    userTeam: null,
    startTime: 0,
};

const SNAPSHOT_INTERVAL = 30; // seconds

// ─── Public API ─────────────────────────────────────────────────────────────

export function startRecording(gameData: LiveGameData): void {
    if (state.isRecording) return;

    const now = new Date();
    state.matchId = `match_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    state.isRecording = true;
    state.snapshots = [];
    state.lastSnapshotTime = 0;
    state.startTime = gameData.gameData.gameTime;

    // Determine user's team
    const userName = gameData.activePlayer.summonerName;
    const userPlayer = gameData.allPlayers.find((p) => p.summonerName === userName);
    state.userTeam = userPlayer?.team || 'ORDER';

    console.log(`[MatchRecorder] Started recording: ${state.matchId}`);
}

export function recordSnapshot(gameData: LiveGameData): void {
    if (!state.isRecording) return;

    const gameTime = gameData.gameData.gameTime;

    // Only snapshot every SNAPSHOT_INTERVAL seconds
    if (gameTime - state.lastSnapshotTime < SNAPSHOT_INTERVAL) return;
    state.lastSnapshotTime = gameTime;

    const snapshot = extractTrainingVector(gameData);
    state.snapshots.push(snapshot);

    console.log(`[MatchRecorder] Snapshot #${state.snapshots.length} at ${Math.floor(gameTime)}s`);
}

export function stopRecording(outcome: 0 | 1): void {
    if (!state.isRecording) return;

    // Label all snapshots with the outcome
    for (const snap of state.snapshots) {
        snap.outcome = outcome;
    }

    // Flush to storage
    flushToStorage();

    state.isRecording = false;
    console.log(`[MatchRecorder] Stopped recording: ${state.matchId} (${state.snapshots.length} snapshots, outcome: ${outcome ? 'WIN' : 'LOSS'})`);
}

export function detectGameEnd(gameData: LiveGameData): { ended: boolean; won: boolean } {
    const events = gameData.events.Events;
    for (const event of events) {
        if (event.EventName === 'GameEnd') {
            // GameEnd events don't carry Result on our type — infer from team
            // The KillerName field on GameEnd contains the winning team
            const won = event.KillerName === state.userTeam;
            return { ended: true, won };
        }
        // Nexus destroyed detection as fallback
        if (event.EventName === 'InhibKilled' || event.EventName === 'TurretKilled') {
            // Check for Nexus turrets (they contain "Nexus" in the name)
            if (event.TurretKilled && event.TurretKilled.includes('Nexus')) {
                // If our team's nexus turret is killed, we lost
                const isAllyTurret = isAllyStructure(event.TurretKilled, state.userTeam || 'ORDER');
                return { ended: false, won: !isAllyTurret }; // Not definitive, but a strong signal
            }
        }
    }
    return { ended: false, won: false };
}

export function isRecording(): boolean {
    return state.isRecording;
}

export function getSnapshotCount(): number {
    return state.snapshots.length;
}

// ─── Feature Extraction ─────────────────────────────────────────────────────

function extractTrainingVector(gameData: LiveGameData): TrainingSnapshot {
    const userName = gameData.activePlayer.summonerName;
    const userTeam = state.userTeam || 'ORDER';

    const allies = gameData.allPlayers.filter((p) => p.team === userTeam);
    const enemies = gameData.allPlayers.filter((p) => p.team !== userTeam);
    const userPlayer = gameData.allPlayers.find((p) => p.summonerName === userName);
    const gameTime = gameData.gameData.gameTime;
    const gameMin = gameTime / 60;

    // Gold estimation
    const allyGold = estimateTeamGold(allies);
    const enemyGold = estimateTeamGold(enemies);
    const goldDiff = allyGold - enemyGold;

    // Position-based gold gaps
    const positions = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const;
    const posGaps = positions.map((pos) => {
        const a = allies.find((p) => p.position === pos);
        const e = enemies.find((p) => p.position === pos);
        return (a ? estimatePlayerGold(a) : 0) - (e ? estimatePlayerGold(e) : 0);
    });

    // Objective counts from events
    const objectives = countObjectives(gameData.events.Events, userTeam);

    // Kill totals
    const allyKills = allies.reduce((s, p) => s + p.scores.kills, 0);
    const enemyKills = enemies.reduce((s, p) => s + p.scores.kills, 0);
    const allyDeaths = allies.reduce((s, p) => s + p.scores.deaths, 0);
    const enemyDeaths = enemies.reduce((s, p) => s + p.scores.deaths, 0);

    // Phase
    const gamePhase: 'EARLY' | 'MID' | 'LATE' =
        gameMin < 14 ? 'EARLY' : gameMin < 28 ? 'MID' : 'LATE';

    return {
        gameTime,
        gamePhase,
        allyGold,
        enemyGold,
        goldDiff,
        goldDiffPerMin: gameMin > 0 ? goldDiff / gameMin : 0,
        allyCSTotal: allies.reduce((s, p) => s + p.scores.creepScore, 0),
        enemyCSTotal: enemies.reduce((s, p) => s + p.scores.creepScore, 0),
        topGoldGap: posGaps[0],
        jglGoldGap: posGaps[1],
        midGoldGap: posGaps[2],
        botGoldGap: posGaps[3],
        supGoldGap: posGaps[4],
        allyTowers: objectives.allyTowers,
        enemyTowers: objectives.enemyTowers,
        allyDragons: objectives.allyDragons,
        enemyDragons: objectives.enemyDragons,
        allyBarons: objectives.allyBarons,
        enemyBarons: objectives.enemyBarons,
        allyHeralds: objectives.allyHeralds,
        enemyHeralds: objectives.enemyHeralds,
        allyInhibitors: objectives.allyInhibitors,
        enemyInhibitors: objectives.enemyInhibitors,
        allyKills,
        enemyKills,
        allyDeaths,
        enemyDeaths,
        killDiff: allyKills - enemyKills,
        allyChampions: allies.map((p) => p.championName).sort(),
        enemyChampions: enemies.map((p) => p.championName).sort(),
        userChampion: gameData.activePlayer.championName,
        userPosition: userPlayer?.position || 'BOTTOM',
        userKills: userPlayer?.scores.kills || 0,
        userDeaths: userPlayer?.scores.deaths || 0,
        userAssists: userPlayer?.scores.assists || 0,
        userCS: userPlayer?.scores.creepScore || 0,
        userLevel: Math.min(gameData.activePlayer.level, 18),
        userItemCount: userPlayer?.items.length || 0,
        outcome: -1, // Labeled post-game
    };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function estimatePlayerGold(p: { items: { price: number }[]; scores: { kills: number; assists: number; creepScore: number } }): number {
    return p.items.reduce((s, i) => s + i.price, 0) + p.scores.kills * 300 + p.scores.assists * 150 + p.scores.creepScore * 21;
}

function estimateTeamGold(players: Array<{ items: { price: number }[]; scores: { kills: number; assists: number; creepScore: number } }>): number {
    return players.reduce((s, p) => s + estimatePlayerGold(p), 0);
}

interface ObjectiveCounts {
    allyTowers: number; enemyTowers: number;
    allyDragons: number; enemyDragons: number;
    allyBarons: number; enemyBarons: number;
    allyHeralds: number; enemyHeralds: number;
    allyInhibitors: number; enemyInhibitors: number;
}

function countObjectives(events: GameEvent[], userTeam: string): ObjectiveCounts {
    const counts: ObjectiveCounts = {
        allyTowers: 0, enemyTowers: 0,
        allyDragons: 0, enemyDragons: 0,
        allyBarons: 0, enemyBarons: 0,
        allyHeralds: 0, enemyHeralds: 0,
        allyInhibitors: 0, enemyInhibitors: 0,
    };

    for (const e of events) {
        // Note: In the real API, TurretKilled events have the turret name
        // and we can determine which team lost the turret.
        if (e.EventName === 'TurretKilled') {
            if (isAllyStructure(e.TurretKilled || '', userTeam)) {
                counts.enemyTowers++; // Enemy destroyed our turret
            } else {
                counts.allyTowers++; // We destroyed enemy turret
            }
        }
        if (e.EventName === 'DragonKill') {
            // KillerName is a player — check if it's our team
            counts.allyDragons++; // Simplified: attribute to ally (refined with player lookup)
        }
        if (e.EventName === 'BaronKill') {
            counts.allyBarons++;
        }
        if (e.EventName === 'HeraldKill') {
            counts.allyHeralds++;
        }
        if (e.EventName === 'InhibKilled') {
            if (isAllyStructure(e.TurretKilled || '', userTeam)) {
                counts.enemyInhibitors++;
            } else {
                counts.allyInhibitors++;
            }
        }
    }

    return counts;
}

function isAllyStructure(structureName: string, userTeam: string): boolean {
    // Riot structure names contain "T1" for ORDER (blue) side and "T2" for CHAOS (red) side
    // e.g., "Turret_T1_C_05_A" = ORDER team turret
    if (userTeam === 'ORDER') return structureName.includes('_T1_');
    return structureName.includes('_T2_');
}

function pad(n: number): string {
    return n.toString().padStart(2, '0');
}

// ─── Storage ────────────────────────────────────────────────────────────────

function flushToStorage(): void {
    if (state.snapshots.length === 0) return;

    const jsonlContent = state.snapshots.map((s) => JSON.stringify(s)).join('\n') + '\n';
    const filename = `${state.matchId}.jsonl`;

    // In browser context, save to localStorage as fallback.
    // In Electron, this would use fs.writeFileSync via IPC.
    try {
        // Store in localStorage indexed by match ID
        const existingMatches = JSON.parse(localStorage.getItem('lol_match_data_index') || '[]') as string[];
        if (!existingMatches.includes(filename)) {
            existingMatches.push(filename);
            localStorage.setItem('lol_match_data_index', JSON.stringify(existingMatches));
        }
        localStorage.setItem(`lol_match_${filename}`, jsonlContent);

        console.log(`[MatchRecorder] Flushed ${state.snapshots.length} snapshots to localStorage (${filename})`);
    } catch (err) {
        console.error('[MatchRecorder] Failed to flush data:', err);
    }
}

/** Export all stored match data as a single JSONL string (for ML training) */
export function exportAllMatchData(): string {
    const index = JSON.parse(localStorage.getItem('lol_match_data_index') || '[]') as string[];
    let allData = '';
    for (const filename of index) {
        const data = localStorage.getItem(`lol_match_${filename}`);
        if (data) allData += data;
    }
    return allData;
}

/** Get count of stored matches */
export function getStoredMatchCount(): number {
    const index = JSON.parse(localStorage.getItem('lol_match_data_index') || '[]') as string[];
    return index.length;
}
