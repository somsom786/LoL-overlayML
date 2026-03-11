// =============================================================================
// ItemizationEngine — Threat detection + situational item recommendations
// =============================================================================

import type {
    LiveGameData, PlayerData, ThreatAssessment, ItemRecommendation, ThreatType,
} from '../types';
import { getItemGoldCost, getItem, getItemIconUrl } from '../services/DataDragonService';

// ─── Item Classification ────────────────────────────────────────────────────

// AP-heavy items (completed)
const AP_ITEM_IDS = new Set([
    3089, 3135, 6653, 3157, 4005, 3116, 3285, 4628, 3152, 3118, 6655, 3100,
    4645, 3907, 4629, 3003, 3040, 6656, 6657,
]);

// AD-heavy items (completed)
const AD_ITEM_IDS = new Set([
    3031, 3036, 3072, 3094, 3508, 6676, 6672, 6673, 3142, 6693, 6692, 3179,
    6694, 6695, 6696, 3074, 3004, 3042, 3814, 6609,
]);

// Tank / HP-stacking items
const TANK_ITEM_IDS = new Set([
    3084, 3143, 3075, 3742, 3065, 6662, 3190, 3001, 3110, 3076, 3082, 3068,
    6665, 4401, 3109, 3119,
]);

// Items that indicate healing dependency
const HEALING_ITEM_IDS = new Set([
    3072, 3812, 3065, 3153, 6673, 3139, 3161, 3046,
]);

// Champions with innate high healing
const HEALING_CHAMPIONS = new Set([
    'DrMundo', 'Briar', 'Aatrox', 'Soraka', 'Yuumi', 'Warwick', 'Swain',
    'Vladimir', 'Fiora', 'Sylas', 'Illaoi', 'Nasus', 'Olaf', 'Sett',
    'Irelia', 'Kayn', 'Renekton', 'Darius', 'Maokai', 'Zac',
]);

// ─── Counter Item Recommendations ──────────────────────────────────────────

interface CounterItem {
    itemId: string;
    name: string;
    goldCost: number;
    roles: string[];  // Which user roles can use this
}

const MAGIC_RESIST_ITEMS: CounterItem[] = [
    { itemId: '4401', name: 'Force of Nature', goldCost: 2900, roles: ['Tank', 'Fighter'] },
    { itemId: '3156', name: 'Maw of Malmortius', goldCost: 2800, roles: ['Fighter', 'Assassin', 'Marksman'] },
    { itemId: '3065', name: 'Spirit Visage', goldCost: 2900, roles: ['Tank', 'Fighter'] },
    { itemId: '3111', name: "Mercury's Treads", goldCost: 1100, roles: ['Tank', 'Fighter', 'Mage', 'Assassin', 'Marksman', 'Support'] },
    { itemId: '3139', name: 'Mercurial Scimitar', goldCost: 3000, roles: ['Marksman', 'Fighter'] },
    { itemId: '4005', name: 'Imperial Mandate', goldCost: 2500, roles: ['Support', 'Mage'] },
];

const ARMOR_PEN_ITEMS: CounterItem[] = [
    { itemId: '3036', name: "Lord Dominik's Regards", goldCost: 3000, roles: ['Marksman'] },
    { itemId: '3071', name: 'Black Cleaver', goldCost: 3100, roles: ['Fighter', 'Assassin'] },
    { itemId: '6694', name: 'Serylda\'s Grudge', goldCost: 3200, roles: ['Fighter', 'Assassin'] },
    { itemId: '3035', name: 'Last Whisper', goldCost: 1450, roles: ['Marksman', 'Fighter', 'Assassin'] },
];

const ANTI_HEAL_ITEMS: CounterItem[] = [
    { itemId: '3033', name: 'Mortal Reminder', goldCost: 2600, roles: ['Marksman', 'Fighter'] },
    { itemId: '3011', name: 'Chemtech Putrifier', goldCost: 2300, roles: ['Support', 'Mage'] },
    { itemId: '3075', name: 'Thornmail', goldCost: 2700, roles: ['Tank'] },
    { itemId: '3165', name: 'Morellonomicon', goldCost: 2500, roles: ['Mage'] },
];

const ARMOR_ITEMS: CounterItem[] = [
    { itemId: '3143', name: "Randuin's Omen", goldCost: 2700, roles: ['Tank', 'Fighter'] },
    { itemId: '3110', name: 'Frozen Heart', goldCost: 2500, roles: ['Tank', 'Support'] },
    { itemId: '3047', name: 'Plated Steelcaps', goldCost: 1100, roles: ['Tank', 'Fighter', 'Mage', 'Support'] },
    { itemId: '3742', name: "Dead Man's Plate", goldCost: 2900, roles: ['Tank', 'Fighter'] },
];

// ─── Threat Detection ───────────────────────────────────────────────────────

function countCompletedItems(player: PlayerData, itemSet: Set<number>): number {
    return player.items.filter((item) => itemSet.has(item.itemID) && getItemGoldCost(item.itemID) >= 1000).length;
}

function hasHealingIndicators(player: PlayerData): boolean {
    const hasHealItems = player.items.some((item) => HEALING_ITEM_IDS.has(item.itemID));
    const isHealChamp = HEALING_CHAMPIONS.has(player.championName);
    return hasHealItems || isHealChamp;
}

/**
 * Analyze the enemy team and return detected threats.
 */
export function assessThreats(
    gameData: LiveGameData
): ThreatAssessment[] {
    const userName = gameData.activePlayer.summonerName;
    const userPlayer = gameData.allPlayers.find((p) => p.summonerName === userName);
    if (!userPlayer) return [];

    const enemies = gameData.allPlayers.filter((p) => p.team !== userPlayer.team);
    const threats: ThreatAssessment[] = [];

    for (const enemy of enemies) {
        const apItems = countCompletedItems(enemy, AP_ITEM_IDS);
        const adItems = countCompletedItems(enemy, AD_ITEM_IDS);
        const tankItems = countCompletedItems(enemy, TANK_ITEM_IDS);
        const hasHealing = hasHealingIndicators(enemy);

        // High Magic Threat: ≥2 completed AP items
        if (apItems >= 2) {
            threats.push({
                type: 'HIGH_MAGIC_THREAT',
                level: apItems >= 3 ? 'critical' : 'high',
                source: enemy.championName,
                description: `${enemy.championName} has ${apItems} AP items — build Magic Resist`,
                icon: '⚡',
            });
        }

        // High Physical Threat: ≥2 completed AD items
        if (adItems >= 2) {
            threats.push({
                type: 'HIGH_PHYSICAL_THREAT',
                level: adItems >= 3 ? 'critical' : 'high',
                source: enemy.championName,
                description: `${enemy.championName} has ${adItems} AD items — build Armor`,
                icon: '⚔️',
            });
        }

        // Tank Threat: ≥2 tank/HP items or Heartsteel
        if (tankItems >= 2 || enemy.items.some((i) => i.itemID === 3084)) {
            threats.push({
                type: 'TANK_THREAT',
                level: tankItems >= 3 ? 'critical' : (enemy.items.some((i) => i.itemID === 3084) ? 'high' : 'moderate'),
                source: enemy.championName,
                description: `${enemy.championName} is tank stacking — build Armor Pen`,
                icon: '🛡️',
            });
        }

        // Healing Threat
        if (hasHealing) {
            threats.push({
                type: 'HEALING_THREAT',
                level: HEALING_CHAMPIONS.has(enemy.championName) ? 'high' : 'moderate',
                source: enemy.championName,
                description: `${enemy.championName} has high sustain — build Anti-Heal`,
                icon: '💉',
            });
        }
    }

    // Deduplicate: keep the highest-severity threat per type
    const deduped = new Map<ThreatType, ThreatAssessment>();
    const levelPriority = { critical: 3, high: 2, moderate: 1 };
    for (const t of threats) {
        const existing = deduped.get(t.type);
        if (!existing || levelPriority[t.level] > levelPriority[existing.level]) {
            deduped.set(t.type, t);
        }
    }

    return Array.from(deduped.values()).sort(
        (a, b) => levelPriority[b.level] - levelPriority[a.level]
    );
}

/**
 * Recommend counter-items based on detected threats and the user's champion role.
 */
export function recommendItems(
    threats: ThreatAssessment[],
    userChampionName: string,
    userItems: number[],
    ddragonVersion: string
): ItemRecommendation[] {
    // Determine user's likely role from champion name (simplified)
    const userRoles = inferRoles(userChampionName);
    const ownedItemIds = new Set(userItems.map(String));

    const recommendations: ItemRecommendation[] = [];
    let priority = 1;

    for (const threat of threats) {
        let counterPool: CounterItem[] = [];

        switch (threat.type) {
            case 'HIGH_MAGIC_THREAT':
                counterPool = MAGIC_RESIST_ITEMS;
                break;
            case 'HIGH_PHYSICAL_THREAT':
                counterPool = ARMOR_ITEMS;
                break;
            case 'TANK_THREAT':
                counterPool = ARMOR_PEN_ITEMS;
                break;
            case 'HEALING_THREAT':
                counterPool = ANTI_HEAL_ITEMS;
                break;
        }

        // Filter by user role and not-already-owned
        const viable = counterPool.filter(
            (item) =>
                item.roles.some((r) => userRoles.includes(r)) &&
                !ownedItemIds.has(item.itemId)
        );

        // Take top 2 per threat
        for (const item of viable.slice(0, 2)) {
            recommendations.push({
                itemId: item.itemId,
                itemName: item.name,
                goldCost: item.goldCost,
                reason: threatLabel(threat.type),
                threatType: threat.type,
                priority: priority++,
                iconUrl: getItemIconUrl(item.itemId),
            });
        }
    }

    // Return top 4 most urgent recommendations
    return recommendations.slice(0, 4);
}

function threatLabel(type: ThreatType): string {
    switch (type) {
        case 'HIGH_MAGIC_THREAT': return 'Magic Resist';
        case 'HIGH_PHYSICAL_THREAT': return 'Armor';
        case 'TANK_THREAT': return 'Armor Pen';
        case 'HEALING_THREAT': return 'Anti-Heal';
        default: return 'Counter';
    }
}

function inferRoles(championName: string): string[] {
    // Simplified role inference
    const marksmen = new Set(['Jinx', 'Kaisa', 'Caitlyn', 'Aphelios', 'Ezreal', 'Jhin', 'Lucian', 'MissFortune', 'Vayne', 'Xayah', 'Tristana', 'Ashe', 'Draven', 'Sivir', 'KogMaw', 'Twitch', 'Varus', 'Zeri', 'Samira', 'Kalista']);
    const mages = new Set(['Ahri', 'Syndra', 'Lux', 'Viktor', 'Orianna', 'Azir', 'Anivia', 'Veigar', 'Xerath', 'Ziggs', 'Ryze', 'Cassiopeia', 'Taliyah', 'Hwei', 'Aurora']);
    const assassins = new Set(['Zed', 'Talon', 'Katarina', 'Akali', 'Fizz', 'Ekko', 'Qiyana', 'Naafiri', 'Yone', 'Yasuo', 'Khazix', 'Rengar']);
    const tanks = new Set(['Ornn', 'Malphite', 'Maokai', 'Shen', 'Poppy', 'Sejuani', 'Zac', 'Leona', 'Nautilus', 'Alistar', 'Braum', 'TahmKench', 'KSante', 'Amumu']);
    const fighters = new Set(['Darius', 'Garen', 'Jax', 'Irelia', 'Camille', 'Fiora', 'Riven', 'Renekton', 'Aatrox', 'Mordekaiser', 'Sett', 'Viego', 'LeeSin', 'Vi', 'JarvanIV', 'XinZhao', 'Briar', 'Belveth', 'DrMundo', 'Nasus', 'Illaoi', 'Olaf', 'Warwick', 'Udyr', 'Trundle', 'Volibear']);
    const supports = new Set(['Thresh', 'Lulu', 'Janna', 'Soraka', 'Nami', 'Yuumi', 'Senna', 'Rakan', 'Blitzcrank', 'Pyke', 'Zyra', 'Karma', 'Morgana', 'Bard', 'Renata', 'Milio']);

    const roles: string[] = [];
    if (marksmen.has(championName)) roles.push('Marksman');
    if (mages.has(championName)) roles.push('Mage');
    if (assassins.has(championName)) roles.push('Assassin');
    if (tanks.has(championName)) roles.push('Tank');
    if (fighters.has(championName)) roles.push('Fighter');
    if (supports.has(championName)) roles.push('Support');

    // Default to Fighter if unknown
    return roles.length > 0 ? roles : ['Fighter'];
}
