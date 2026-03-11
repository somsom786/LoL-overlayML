// =============================================================================
// JungleTracker — Estimates enemy jungler position and predicts ganks
// Uses game events, timers, and champion-specific clear speeds.
// =============================================================================

import type { LiveGameData, PlayerData, GameEvent } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type MapQuadrant = 'TOP_BLUE' | 'TOP_RED' | 'BOT_BLUE' | 'BOT_RED' | 'UNKNOWN';
export type ThreatLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'GANKING';

export interface JungleState {
    enemyJungler: string;             // Champion name
    estimatedQuadrant: MapQuadrant;
    threatLevel: ThreatLevel;
    lastSeenTime: number;             // Game time in seconds
    lastSeenEvent: string;            // Description of last known action
    timeSinceSeen: number;            // Seconds since last seen
    gankWarning: GankWarning | null;
    pathing: string;                  // Estimated path description
    isTrackable: boolean;             // False if we have zero info
}

export interface GankWarning {
    targetLane: 'TOP' | 'MID' | 'BOT';
    urgency: 'POSSIBLE' | 'LIKELY' | 'IMMINENT';
    eta: number;                      // Estimated seconds until arrival
    reason: string;
}

// ─── Jungler Clear Speed Profiles ───────────────────────────────────────────

type ClearSpeed = 'fast' | 'medium' | 'slow';

const JUNGLER_CLEAR_SPEED: Record<string, ClearSpeed> = {
    // Fast clearers
    Kayn: 'fast', Belveth: 'fast', Shyvana: 'fast', Udyr: 'fast',
    Nocturne: 'fast', Diana: 'fast', Karthus: 'fast', Lillia: 'fast',
    Hecarim: 'fast', Fiddlesticks: 'fast', DrMundo: 'fast', Amumu: 'fast',
    Briar: 'fast', Volibear: 'fast',
    // Slow clearers (gank-focused)
    LeeSin: 'slow', Elise: 'slow', Nidalee: 'slow', RekSai: 'slow',
    Shaco: 'slow', Rengar: 'slow', Khazix: 'slow', Pyke: 'slow',
    // Medium
    Vi: 'medium', JarvanIV: 'medium', XinZhao: 'medium', Warwick: 'medium',
    Viego: 'medium', Ekko: 'medium', Sejuani: 'medium', Zac: 'medium',
    Trundle: 'medium', Poppy: 'medium', Maokai: 'medium', Ivern: 'medium',
    Gragas: 'medium', Skarner: 'medium', Kindred: 'medium',
};

function getClearSpeed(name: string): ClearSpeed {
    return JUNGLER_CLEAR_SPEED[name] || 'medium';
}

// ─── Camp Timers (seconds for full clear between camps) ─────────────────────

function campClearDuration(speed: ClearSpeed): number {
    switch (speed) {
        case 'fast': return 22;
        case 'medium': return 28;
        case 'slow': return 35;
    }
}

function estimateGankArrival(speed: ClearSpeed): number {
    switch (speed) {
        case 'fast': return 8;
        case 'medium': return 10;
        case 'slow': return 6; // Slow clearers are fast gankers
    }
}

// ─── Tracking State ─────────────────────────────────────────────────────────

interface TrackingHistory {
    events: TrackedEvent[];
}

interface TrackedEvent {
    time: number;
    type: 'KILL' | 'DEATH' | 'ASSIST' | 'DRAGON' | 'HERALD' | 'BARON' | 'SCUTTLE';
    quadrant: MapQuadrant;
    description: string;
}

let trackingHistory: TrackingHistory = { events: [] };
let lastProcessedEventId = -1;

/** Reset tracker for a new game */
export function resetTracker() {
    trackingHistory = { events: [] };
    lastProcessedEventId = -1;
}

// ─── Core Engine ────────────────────────────────────────────────────────────

export function trackJungler(gameData: LiveGameData): JungleState {
    const userName = gameData.activePlayer.summonerName;
    const userPlayer = gameData.allPlayers.find((p) => p.summonerName === userName);
    if (!userPlayer) return unknownState();

    const userTeam = userPlayer.team;
    const enemies = gameData.allPlayers.filter((p) => p.team !== userTeam);
    const enemyJungler = enemies.find((p) => p.position === 'JUNGLE');

    if (!enemyJungler) return unknownState();

    const gameTime = gameData.gameData.gameTime;
    const clearSpeed = getClearSpeed(enemyJungler.championName);

    // Process new events
    processEvents(gameData.events.Events, enemyJungler, userTeam, gameTime);

    // Find last known position
    const lastEvent = trackingHistory.events.length > 0
        ? trackingHistory.events[trackingHistory.events.length - 1]
        : null;

    const lastSeenTime = lastEvent?.time || 0;
    const timeSinceSeen = gameTime - lastSeenTime;

    // Estimate current quadrant
    const estimatedQuadrant = estimateQuadrant(
        lastEvent, enemyJungler, gameTime, clearSpeed, userTeam
    );

    // Determine threat level
    const threatLevel = determineThreatLevel(
        timeSinceSeen, clearSpeed, gameTime, enemyJungler, userPlayer
    );

    // Generate gank warning
    const gankWarning = generateGankWarning(
        estimatedQuadrant, threatLevel, clearSpeed,
        gameTime, timeSinceSeen, userPlayer, enemyJungler
    );

    // Pathing estimate
    const pathing = estimatePathing(
        lastEvent, estimatedQuadrant, clearSpeed, gameTime, enemyJungler.championName
    );

    return {
        enemyJungler: enemyJungler.championName,
        estimatedQuadrant,
        threatLevel,
        lastSeenTime,
        lastSeenEvent: lastEvent?.description || 'Not yet seen',
        timeSinceSeen: Math.round(timeSinceSeen),
        gankWarning,
        pathing,
        isTrackable: gameTime > 90, // Don't track before camps spawn
    };
}

// ─── Event Processing ───────────────────────────────────────────────────────

function processEvents(
    events: GameEvent[],
    enemyJungler: PlayerData,
    userTeam: string,
    _gameTime: number,
) {
    for (const event of events) {
        if (event.EventID <= lastProcessedEventId) continue;
        lastProcessedEventId = event.EventID;

        const jgName = enemyJungler.summonerName;

        // Enemy jungler got a kill
        if (event.EventName === 'ChampionKill' && event.KillerName === jgName) {
            const victim = event.VictimName || 'unknown';
            trackingHistory.events.push({
                time: event.EventTime,
                type: 'KILL',
                quadrant: inferQuadrantFromPlayer(victim, userTeam),
                description: `Killed ${victim}`,
            });
        }

        // Enemy jungler assisted
        if (event.EventName === 'ChampionKill' && event.Assisters?.includes(jgName)) {
            const victim = event.VictimName || 'unknown';
            trackingHistory.events.push({
                time: event.EventTime,
                type: 'ASSIST',
                quadrant: inferQuadrantFromPlayer(victim, userTeam),
                description: `Assisted kill on ${victim}`,
            });
        }

        // Enemy jungler died
        if (event.EventName === 'ChampionKill' && event.VictimName === jgName) {
            trackingHistory.events.push({
                time: event.EventTime,
                type: 'DEATH',
                quadrant: 'UNKNOWN',
                description: 'Died — will respawn',
            });
        }

        // Dragon (always bot-side)
        if (event.EventName === 'DragonKill') {
            if (event.KillerName === jgName || (event.Assisters && event.Assisters.includes(jgName))) {
                trackingHistory.events.push({
                    time: event.EventTime,
                    type: 'DRAGON',
                    quadrant: userTeam === 'ORDER' ? 'BOT_RED' : 'BOT_BLUE',
                    description: 'At Dragon pit',
                });
            }
        }

        // Herald / Baron (always top-side)
        if (event.EventName === 'HeraldKill' || event.EventName === 'BaronKill') {
            if (event.KillerName === jgName || (event.Assisters && event.Assisters.includes(jgName))) {
                trackingHistory.events.push({
                    time: event.EventTime,
                    type: event.EventName === 'HeraldKill' ? 'HERALD' : 'BARON',
                    quadrant: userTeam === 'ORDER' ? 'TOP_RED' : 'TOP_BLUE',
                    description: `At ${event.EventName === 'HeraldKill' ? 'Herald' : 'Baron'} pit`,
                });
            }
        }
    }
}

// ─── Quadrant Estimation ────────────────────────────────────────────────────

function estimateQuadrant(
    lastEvent: TrackedEvent | null,
    jungler: PlayerData,
    gameTime: number,
    clearSpeed: ClearSpeed,
    _userTeam: string,
): MapQuadrant {
    // Before camps spawn
    if (gameTime < 90) return 'UNKNOWN';

    // Early game standard pathing 1:30 - 3:15
    if (gameTime < 195) {
        // Most junglers start bot-side for leash
        if (gameTime < 135) return 'BOT_RED';    // Doing first camp
        if (gameTime < 165) return 'BOT_RED';    // Clearing bot jungle
        return 'TOP_RED';                         // Pathing to top-side
    }

    // If jungler is dead, they're at fountain
    if (jungler.isDead) return 'UNKNOWN';

    // If we have event data, project from last known position
    if (lastEvent) {
        const timeSince = gameTime - lastEvent.time;
        const clearTime = campClearDuration(clearSpeed);

        // If seen very recently, still in that quadrant
        if (timeSince < clearTime) return lastEvent.quadrant;

        // After 1-2 clears, likely moved to opposite side
        if (timeSince < clearTime * 2) {
            return oppositeVertical(lastEvent.quadrant);
        }

        // After 2-3 clears, could be anywhere but likely crossed
        if (timeSince < clearTime * 3) {
            return oppositeHorizontal(lastEvent.quadrant);
        }

        // Lost track
        return 'UNKNOWN';
    }

    // No data — use game time patterns
    // Mid game: junglers tend to path toward objectives
    if (gameTime % 300 < 60) return 'BOT_RED'; // Near dragon timer windows
    return 'UNKNOWN';
}

function inferQuadrantFromPlayer(playerName: string, _userTeam: string): MapQuadrant {
    // In a real implementation, this would look up the player's lane.
    // For now, we infer from common lane positions.
    // This is a rough heuristic since the API doesn't give exact coordinates.
    return 'UNKNOWN';
}

function oppositeVertical(q: MapQuadrant): MapQuadrant {
    switch (q) {
        case 'TOP_BLUE': return 'BOT_BLUE';
        case 'TOP_RED': return 'BOT_RED';
        case 'BOT_BLUE': return 'TOP_BLUE';
        case 'BOT_RED': return 'TOP_RED';
        default: return 'UNKNOWN';
    }
}

function oppositeHorizontal(q: MapQuadrant): MapQuadrant {
    switch (q) {
        case 'TOP_BLUE': return 'TOP_RED';
        case 'TOP_RED': return 'TOP_BLUE';
        case 'BOT_BLUE': return 'BOT_RED';
        case 'BOT_RED': return 'BOT_BLUE';
        default: return 'UNKNOWN';
    }
}

// ─── Threat Level ───────────────────────────────────────────────────────────

function determineThreatLevel(
    timeSinceSeen: number,
    clearSpeed: ClearSpeed,
    gameTime: number,
    jungler: PlayerData,
    user: PlayerData,
): ThreatLevel {
    if (jungler.isDead) return 'LOW';
    if (gameTime < 90) return 'LOW';

    // Just got a kill / assist near user's lane
    const clearTime = campClearDuration(clearSpeed);

    // If not seen for too long, threat increases (fog of war)
    if (timeSinceSeen > clearTime * 3 || timeSinceSeen > 60) return 'HIGH';
    if (timeSinceSeen > clearTime * 2) return 'MEDIUM';
    if (timeSinceSeen < clearTime) return 'LOW';

    return 'MEDIUM';
}

// ─── Gank Warning ───────────────────────────────────────────────────────────

function generateGankWarning(
    quadrant: MapQuadrant,
    threatLevel: ThreatLevel,
    clearSpeed: ClearSpeed,
    gameTime: number,
    timeSinceSeen: number,
    user: PlayerData,
    jungler: PlayerData,
): GankWarning | null {
    if (jungler.isDead) return null;
    if (gameTime < 150) return null; // Too early for meaningful ganks
    if (threatLevel === 'LOW') return null;

    const userLane = positionToLane(user.position);
    const eta = estimateGankArrival(clearSpeed);

    // Determine if jungler is likely on user's side of the map
    const isTopSide = quadrant === 'TOP_BLUE' || quadrant === 'TOP_RED';
    const isBotSide = quadrant === 'BOT_BLUE' || quadrant === 'BOT_RED';

    let targetLane: 'TOP' | 'MID' | 'BOT' = 'MID';
    let urgency: 'POSSIBLE' | 'LIKELY' | 'IMMINENT' = 'POSSIBLE';
    let reason = '';

    if (quadrant === 'UNKNOWN') {
        // No info — general warning based on time since seen
        if (timeSinceSeen > 45) {
            // Slow clearers unseen for 45s+ are likely ganking
            const gankHeavy = clearSpeed === 'slow';
            urgency = gankHeavy ? 'LIKELY' : 'POSSIBLE';
            targetLane = userLane;
            reason = `${jungler.championName} unseen for ${Math.round(timeSinceSeen)}s`;
        } else {
            return null;
        }
    } else if (isTopSide && userLane === 'TOP') {
        urgency = timeSinceSeen < 15 ? 'IMMINENT' : 'LIKELY';
        targetLane = 'TOP';
        reason = `${jungler.championName} spotted top-side`;
    } else if (isBotSide && userLane === 'BOT') {
        urgency = timeSinceSeen < 15 ? 'IMMINENT' : 'LIKELY';
        targetLane = 'BOT';
        reason = `${jungler.championName} spotted bot-side`;
    } else if (isTopSide && userLane === 'MID') {
        urgency = 'POSSIBLE';
        targetLane = 'MID';
        reason = `${jungler.championName} clearing top — may path mid`;
    } else if (isBotSide && userLane === 'MID') {
        urgency = 'POSSIBLE';
        targetLane = 'MID';
        reason = `${jungler.championName} clearing bot — may path mid`;
    } else {
        // Jungler on opposite side of map from user — lower threat
        return null;
    }

    return { targetLane, urgency, eta, reason };
}

function positionToLane(pos: string): 'TOP' | 'MID' | 'BOT' {
    switch (pos) {
        case 'TOP': return 'TOP';
        case 'JUNGLE': return 'MID';
        case 'MIDDLE': return 'MID';
        case 'BOTTOM': return 'BOT';
        case 'UTILITY': return 'BOT';
        default: return 'MID';
    }
}

// ─── Pathing Description ────────────────────────────────────────────────────

function estimatePathing(
    lastEvent: TrackedEvent | null,
    currentQuadrant: MapQuadrant,
    clearSpeed: ClearSpeed,
    gameTime: number,
    champName: string,
): string {
    if (gameTime < 90) return 'Waiting at fountain';

    if (gameTime < 135) return 'Starting first buff';
    if (gameTime < 195) {
        return `${champName} clearing first jungle rotation`;
    }

    if (!lastEvent || currentQuadrant === 'UNKNOWN') {
        const speed = clearSpeed === 'slow' ? 'gank-heavy' : clearSpeed === 'fast' ? 'power-farming' : 'standard';
        return `${champName} position unknown — ${speed} pattern expected`;
    }

    const timeSince = Math.round(gameTime - lastEvent.time);
    if (timeSince < 15) return `${lastEvent.description} (just now)`;
    if (timeSince < 30) return `Moving away from ${quadrantLabel(lastEvent.quadrant)}`;
    return `Last seen ${timeSince}s ago at ${quadrantLabel(lastEvent.quadrant)}`;
}

function quadrantLabel(q: MapQuadrant): string {
    switch (q) {
        case 'TOP_BLUE': return 'top-blue';
        case 'TOP_RED': return 'top-red';
        case 'BOT_BLUE': return 'bot-blue';
        case 'BOT_RED': return 'bot-red';
        default: return 'unknown';
    }
}

function unknownState(): JungleState {
    return {
        enemyJungler: 'Unknown',
        estimatedQuadrant: 'UNKNOWN',
        threatLevel: 'LOW',
        lastSeenTime: 0,
        lastSeenEvent: 'Not yet identified',
        timeSinceSeen: 0,
        gankWarning: null,
        pathing: 'No data',
        isTrackable: false,
    };
}
