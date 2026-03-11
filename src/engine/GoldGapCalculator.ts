// =============================================================================
// GoldGapCalculator — Estimates gold from inventory, KDA, CS, and passive income
// =============================================================================

import type { LiveGameData, GoldEstimate, GoldDifferential, PlayerData } from '../types';
import { getItemGoldCost } from '../services/DataDragonService';

// ─── Constants ──────────────────────────────────────────────────────────────

const GOLD_PER_KILL = 300;
const GOLD_PER_ASSIST = 150;
const GOLD_PER_CS = 21;              // Average across melee/caster/siege minions
const PASSIVE_GOLD_PER_10S = 20.4;   // Base passive gold gain
const STARTING_GOLD = 500;
const PLATE_GOLD_ESTIMATE = 160;     // Average gold per plate taken (estimated)

// First plate typically falls around 5 min, outer turrets by 14 min
const PLATE_BUFFER_START = 300;      // 5 min
const PLATE_BUFFER_END = 840;        // 14 min

/**
 * Estimate total gold for a single player based on available data.
 */
function estimatePlayerGold(player: PlayerData, gameTime: number): GoldEstimate {
    // 1. Inventory Gold: Sum gold cost of all current items
    const inventoryGold = player.items.reduce((sum, item) => {
        const cost = getItemGoldCost(item.itemID);
        return sum + (cost > 0 ? cost : item.price);
    }, 0);

    // 2. Earned Gold from KDA
    const kdaGold =
        (player.scores.kills * GOLD_PER_KILL) +
        (player.scores.assists * GOLD_PER_ASSIST);

    // 3. CS Gold
    const csGold = player.scores.creepScore * GOLD_PER_CS;

    // 4. Passive Gold (time-based)
    // Passive gold starts at 1:50 (110 seconds)
    const passiveTime = Math.max(0, gameTime - 110);
    const passiveGold = Math.floor((passiveTime / 10) * PASSIVE_GOLD_PER_10S);

    // 5. Plate Buffer: Estimate plates based on game time and position
    let plateBuffer = 0;
    if (gameTime > PLATE_BUFFER_START && gameTime < PLATE_BUFFER_END) {
        const plateProgress = (gameTime - PLATE_BUFFER_START) / (PLATE_BUFFER_END - PLATE_BUFFER_START);
        const estimatedPlates = Math.floor(plateProgress * 3); // ~3 plates average
        if (player.position === 'BOTTOM' || player.position === 'MIDDLE') {
            plateBuffer = estimatedPlates * PLATE_GOLD_ESTIMATE;
        } else if (player.position === 'TOP') {
            plateBuffer = Math.floor(estimatedPlates * PLATE_GOLD_ESTIMATE * 0.7);
        }
    }

    const earnedGoldEstimate = kdaGold + csGold + plateBuffer;
    const totalEstimatedGold = STARTING_GOLD + inventoryGold + earnedGoldEstimate + passiveGold;

    return {
        summonerName: player.summonerName,
        championName: player.championName,
        team: player.team,
        position: player.position,
        inventoryGold,
        earnedGoldEstimate,
        passiveGold,
        totalEstimatedGold,
    };
}

/**
 * Calculate the Gold Differential between teams.
 * Uses the active player's summonerName to identify which team is "ours".
 */
export function calculateGoldGap(gameData: LiveGameData): GoldDifferential {
    const gameTime = gameData.gameData.gameTime;
    const userName = gameData.activePlayer.summonerName;

    // Estimate gold for all players
    const allEstimates = gameData.allPlayers.map((p) => estimatePlayerGold(p, gameTime));

    // Find the user
    const userEstimate = allEstimates.find((e) => e.summonerName === userName);
    if (!userEstimate) {
        // Fallback: treat first ORDER player as user
        const fallback = allEstimates.find((e) => e.team === 'ORDER') || allEstimates[0];
        return buildDifferential(fallback, allEstimates);
    }

    return buildDifferential(userEstimate, allEstimates);
}

function buildDifferential(
    userGold: GoldEstimate,
    allEstimates: GoldEstimate[]
): GoldDifferential {
    const userTeam = userGold.team;
    const allyTeamGold = allEstimates.filter((e) => e.team === userTeam);
    const enemyTeamGold = allEstimates.filter((e) => e.team !== userTeam);

    const allyTotal = allyTeamGold.reduce((s, e) => s + e.totalEstimatedGold, 0);
    const enemyTotal = enemyTeamGold.reduce((s, e) => s + e.totalEstimatedGold, 0);

    // Find lane opponent (same position, opposite team)
    const laneOpponentGold = enemyTeamGold.find((e) => e.position === userGold.position) || null;
    const laneGoldDiff = laneOpponentGold
        ? userGold.totalEstimatedGold - laneOpponentGold.totalEstimatedGold
        : 0;

    return {
        teamGoldDiff: allyTotal - enemyTotal,
        laneGoldDiff,
        userGold,
        laneOpponentGold,
        allyTeamGold,
        enemyTeamGold,
    };
}
