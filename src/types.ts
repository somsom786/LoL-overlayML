// =============================================================================
// Type definitions for the Live Client Data API and internal data structures
// =============================================================================

// ─── Live Client API Types ───────────────────────────────────────────────────

export interface LiveGameData {
    activePlayer: ActivePlayer;
    allPlayers: PlayerData[];
    events: GameEvents;
    gameData: GameMetadata;
}

export interface ActivePlayer {
    championName: string;
    level: number;
    currentGold: number; // Note: this field IS available for the active player
    summonerName: string;
    abilities: Record<string, AbilityInfo>;
    championStats: ChampionStats;
    fullRunes: FullRunes;
}

export interface AbilityInfo {
    abilityLevel: number;
    displayName: string;
    id: string;
}

export interface ChampionStats {
    abilityPower: number;
    armor: number;
    armorPenetrationFlat: number;
    armorPenetrationPercent: number;
    attackDamage: number;
    attackRange: number;
    attackSpeed: number;
    bonusArmorPenetrationPercent: number;
    bonusMagicPenetrationPercent: number;
    critChance: number;
    critDamage: number;
    currentHealth: number;
    healthRegenRate: number;
    lifeSteal: number;
    magicLethality: number;
    magicPenetrationFlat: number;
    magicPenetrationPercent: number;
    magicResist: number;
    maxHealth: number;
    moveSpeed: number;
    physicalLethality: number;
    resourceMax: number;
    resourceRegenRate: number;
    resourceType: string;
    resourceValue: number;
    spellVamp: number;
    tenacity: number;
}

export interface FullRunes {
    generalRunes: RuneData[];
    keystone: RuneData;
    primaryRuneTree: RuneTree;
    secondaryRuneTree: RuneTree;
    statRunes: StatRune[];
}

export interface RuneData {
    displayName: string;
    id: number;
    rawDescription: string;
    rawDisplayName: string;
}

export interface RuneTree {
    displayName: string;
    id: number;
    rawDescription: string;
    rawDisplayName: string;
}

export interface StatRune {
    id: number;
    rawDescription: string;
}

export interface PlayerData {
    championName: string;
    isBot: boolean;
    isDead: boolean;
    items: PlayerItem[];
    level: number;
    position: string; // "TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"
    rawChampionName: string;
    respawnTimer: number;
    scores: PlayerScores;
    skinID: number;
    summonerName: string;
    summonerSpells: SummonerSpells;
    team: 'ORDER' | 'CHAOS';
}

export interface PlayerItem {
    canUse: boolean;
    consumable: boolean;
    count: number;
    displayName: string;
    itemID: number;
    price: number;
    rawDescription: string;
    rawDisplayName: string;
    slot: number;
}

export interface PlayerScores {
    assists: number;
    creepScore: number;
    deaths: number;
    kills: number;
    wardScore: number;
}

export interface SummonerSpells {
    summonerSpellOne: SpellInfo;
    summonerSpellTwo: SpellInfo;
}

export interface SpellInfo {
    displayName: string;
    rawDescription: string;
    rawDisplayName: string;
}

export interface GameEvents {
    Events: GameEvent[];
}

export interface GameEvent {
    EventID: number;
    EventName: string;
    EventTime: number;
    KillerName?: string;
    VictimName?: string;
    Assisters?: string[];
    TurretKilled?: string;
    DragonType?: string;
}

export interface GameMetadata {
    gameMode: string;
    gameTime: number;
    mapName: string;
    mapNumber: number;
    mapTerrain: string;
}

// ─── Data Dragon Types ───────────────────────────────────────────────────────

export interface DDragonItem {
    name: string;
    description: string;
    gold: {
        base: number;
        purchasable: boolean;
        total: number;
        sell: number;
    };
    tags: string[];
    stats: Record<string, number>;
    into?: string[];
    from?: string[];
    image: {
        full: string;
        sprite: string;
        group: string;
    };
}

export interface DDragonItemMap {
    [itemId: string]: DDragonItem;
}

export interface DDragonChampion {
    id: string;
    key: string;
    name: string;
    title: string;
    tags: string[]; // "Mage", "Fighter", "Tank", "Assassin", "Marksman", "Support"
    stats: Record<string, number>;
    image: {
        full: string;
    };
}

// ─── Internal Engine Types ───────────────────────────────────────────────────

export interface GoldEstimate {
    summonerName: string;
    championName: string;
    team: 'ORDER' | 'CHAOS';
    position: string;
    inventoryGold: number;
    earnedGoldEstimate: number;
    passiveGold: number;
    totalEstimatedGold: number;
}

export interface GoldDifferential {
    teamGoldDiff: number; // positive = user's team is ahead
    laneGoldDiff: number; // positive = user is ahead of lane opponent
    userGold: GoldEstimate;
    laneOpponentGold: GoldEstimate | null;
    allyTeamGold: GoldEstimate[];
    enemyTeamGold: GoldEstimate[];
}

export type ThreatType =
    | 'HIGH_MAGIC_THREAT'
    | 'HIGH_PHYSICAL_THREAT'
    | 'TANK_THREAT'
    | 'HEALING_THREAT'
    | 'MIXED_THREAT';

export interface ThreatAssessment {
    type: ThreatType;
    level: 'moderate' | 'high' | 'critical';
    source: string; // champion name causing the threat
    description: string;
    icon: string;
}

export interface ItemRecommendation {
    itemId: string;
    itemName: string;
    goldCost: number;
    reason: string;
    threatType: ThreatType;
    priority: number; // 1 = most urgent
    iconUrl: string;
}

export interface PerformanceBenchmark {
    csPerMin: number;
    goldPerMin: number;
    csScore: number;      // 0-100 normalized
    goldScore: number;     // 0-100 normalized
    csVerdict: 'behind' | 'average' | 'ahead';
    goldVerdict: 'behind' | 'average' | 'ahead';
}
