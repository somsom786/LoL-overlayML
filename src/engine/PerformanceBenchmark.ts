// =============================================================================
// PerformanceBenchmark — CS/min and Gold/min vs Challenger-tier averages
// =============================================================================

import type { LiveGameData, PerformanceBenchmark } from '../types';
import { calculateGoldGap } from './GoldGapCalculator';

// ─── Challenger Benchmark Data ──────────────────────────────────────────────
// Source: Averaged from high-elo data (Challenger / GM tier)
// Indexed by time bracket in minutes

interface BenchmarkEntry {
    csPerMin: number;
    goldPerMin: number;
}

// Per-role benchmarks (Challenger average)
const ROLE_BENCHMARKS: Record<string, BenchmarkEntry> = {
    TOP: { csPerMin: 8.2, goldPerMin: 420 },
    JUNGLE: { csPerMin: 6.0, goldPerMin: 380 },
    MIDDLE: { csPerMin: 8.5, goldPerMin: 430 },
    BOTTOM: { csPerMin: 9.0, goldPerMin: 450 },
    UTILITY: { csPerMin: 1.5, goldPerMin: 280 },
};

// Default fallback
const DEFAULT_BENCHMARK: BenchmarkEntry = { csPerMin: 7.5, goldPerMin: 400 };

/**
 * Calculate performance metrics for the active player.
 */
export function calculatePerformance(gameData: LiveGameData): PerformanceBenchmark {
    const userName = gameData.activePlayer.summonerName;
    const gameTimeSec = gameData.gameData.gameTime;
    const gameTimeMin = gameTimeSec / 60;

    // Don't benchmark before 3 minutes (laning hasn't started properly)
    if (gameTimeMin < 3) {
        return {
            csPerMin: 0,
            goldPerMin: 0,
            csScore: 50,
            goldScore: 50,
            csVerdict: 'average',
            goldVerdict: 'average',
        };
    }

    // Find user in allPlayers
    const userPlayer = gameData.allPlayers.find((p) => p.summonerName === userName);
    if (!userPlayer) {
        return { csPerMin: 0, goldPerMin: 0, csScore: 50, goldScore: 50, csVerdict: 'average', goldVerdict: 'average' };
    }

    // Calculate user's CS/min
    const csPerMin = userPlayer.scores.creepScore / gameTimeMin;

    // Estimate user's Gold/min from GoldGap engine
    const goldDiff = calculateGoldGap(gameData);
    const goldPerMin = goldDiff.userGold.totalEstimatedGold / gameTimeMin;

    // Get benchmark for user's position
    const benchmark = ROLE_BENCHMARKS[userPlayer.position] || DEFAULT_BENCHMARK;

    // Normalize to 0-100 score
    // 100 = at or above Challenger average
    // 50  = at 60% of Challenger average
    // 0   = at 20% of Challenger average
    const csScore = normalizeScore(csPerMin, benchmark.csPerMin);
    const goldScore = normalizeScore(goldPerMin, benchmark.goldPerMin);

    return {
        csPerMin: Math.round(csPerMin * 10) / 10,
        goldPerMin: Math.round(goldPerMin),
        csScore,
        goldScore,
        csVerdict: getVerdict(csScore),
        goldVerdict: getVerdict(goldScore),
    };
}

function normalizeScore(actual: number, benchmarkValue: number): number {
    if (benchmarkValue === 0) return 50;
    const ratio = actual / benchmarkValue;
    // Map: 0.2 → 0, 0.6 → 50, 1.0+ → 100
    const score = Math.round(((ratio - 0.2) / 0.8) * 100);
    return Math.max(0, Math.min(100, score));
}

function getVerdict(score: number): 'behind' | 'average' | 'ahead' {
    if (score >= 67) return 'ahead';
    if (score >= 34) return 'average';
    return 'behind';
}
