// =============================================================================
// MockDataService — Provides realistic game data for development/testing
// Mirrors the exact shape of the Live Client Data API responses
// =============================================================================

import type { LiveGameData } from '../types';

let mockGameTime = 0;
let mockInterval: ReturnType<typeof setInterval> | null = null;

/** Advances mock game time by 0.5s every 500ms to simulate live game progression */
export function startMockClock() {
    if (mockInterval) return;
    mockInterval = setInterval(() => {
        mockGameTime += 0.5;
    }, 500);
}

export function stopMockClock() {
    if (mockInterval) {
        clearInterval(mockInterval);
        mockInterval = null;
    }
}

export function getMockGameTime(): number {
    return mockGameTime;
}

/** Returns a full mock LiveGameData snapshot */
export function getMockGameData(): LiveGameData {
    const t = mockGameTime;
    // Simulate CS growth: ~7 CS/min early, ~8 CS/min mid-game
    const csRate = t < 900 ? 7 : 8;
    const userCS = Math.floor((t / 60) * csRate);
    const opponentCS = Math.floor((t / 60) * (csRate - 0.5));

    // Scale kills/deaths loosely with game time
    const scaledKills = Math.min(Math.floor(t / 180), 8);
    const scaledDeaths = Math.min(Math.floor(t / 240), 5);
    const scaledAssists = Math.min(Math.floor(t / 200), 6);

    return {
        activePlayer: {
            championName: 'Jinx',
            level: Math.min(Math.floor(t / 100) + 1, 18),
            currentGold: 850 + Math.floor(t * 1.5),
            summonerName: 'BlitzUser',
            abilities: {},
            championStats: {
                abilityPower: 0,
                armor: 28 + Math.floor(t / 60),
                armorPenetrationFlat: 0,
                armorPenetrationPercent: 0,
                attackDamage: 64 + Math.floor(t / 30),
                attackRange: 525,
                attackSpeed: 0.625 + t * 0.001,
                bonusArmorPenetrationPercent: 0,
                bonusMagicPenetrationPercent: 0,
                critChance: t > 600 ? 0.5 : 0.2,
                critDamage: 1.75,
                currentHealth: 650 + Math.floor(t / 5),
                healthRegenRate: 3.75,
                lifeSteal: t > 600 ? 0.18 : 0,
                magicLethality: 0,
                magicPenetrationFlat: 0,
                magicPenetrationPercent: 0,
                magicResist: 30,
                maxHealth: 650 + Math.floor(t / 5),
                moveSpeed: 325,
                physicalLethality: 0,
                resourceMax: 245,
                resourceRegenRate: 6.7,
                resourceType: 'MANA',
                resourceValue: 245,
                spellVamp: 0,
                tenacity: 0,
            },
            fullRunes: {
                generalRunes: [],
                keystone: { displayName: 'Lethal Tempo', id: 8008, rawDescription: '', rawDisplayName: '' },
                primaryRuneTree: { displayName: 'Precision', id: 8000, rawDescription: '', rawDisplayName: '' },
                secondaryRuneTree: { displayName: 'Sorcery', id: 8200, rawDescription: '', rawDisplayName: '' },
                statRunes: [],
            },
        },
        allPlayers: [
            // ─── Allied Team (ORDER) ────────────────────────────────────────
            {
                championName: 'KSante',
                isBot: false,
                isDead: false,
                items: buildItems(t, 'tank-ad'),
                level: Math.min(Math.floor(t / 110) + 1, 18),
                position: 'TOP',
                rawChampionName: 'live_champion_KSante',
                respawnTimer: 0,
                scores: { kills: scaledKills - 1, deaths: scaledDeaths, assists: scaledAssists + 2, creepScore: userCS - 10, wardScore: 8 },
                skinID: 0,
                summonerName: 'TopLaner99',
                summonerSpells: makeSpells('Teleport', 'Flash'),
                team: 'ORDER',
            },
            {
                championName: 'LeeSin',
                isBot: false,
                isDead: false,
                items: buildItems(t, 'bruiser'),
                level: Math.min(Math.floor(t / 105) + 1, 18),
                position: 'JUNGLE',
                rawChampionName: 'live_champion_LeeSin',
                respawnTimer: 0,
                scores: { kills: scaledKills + 1, deaths: scaledDeaths - 1, assists: scaledAssists + 4, creepScore: Math.floor(userCS * 0.7), wardScore: 14 },
                skinID: 0,
                summonerName: 'JGL_Diff',
                summonerSpells: makeSpells('Smite', 'Flash'),
                team: 'ORDER',
            },
            {
                championName: 'Ahri',
                isBot: false,
                isDead: false,
                items: buildItems(t, 'mage'),
                level: Math.min(Math.floor(t / 100) + 1, 18),
                position: 'MIDDLE',
                rawChampionName: 'live_champion_Ahri',
                respawnTimer: 0,
                scores: { kills: scaledKills + 2, deaths: scaledDeaths, assists: scaledAssists + 1, creepScore: userCS + 5, wardScore: 6 },
                skinID: 0,
                summonerName: 'MidKingAhri',
                summonerSpells: makeSpells('Ignite', 'Flash'),
                team: 'ORDER',
            },
            {
                championName: 'Jinx',
                isBot: false,
                isDead: false,
                items: buildItems(t, 'adc'),
                level: Math.min(Math.floor(t / 100) + 1, 18),
                position: 'BOTTOM',
                rawChampionName: 'live_champion_Jinx',
                respawnTimer: 0,
                scores: { kills: scaledKills, deaths: scaledDeaths, assists: scaledAssists, creepScore: userCS, wardScore: 4 },
                skinID: 0,
                summonerName: 'BlitzUser',
                summonerSpells: makeSpells('Heal', 'Flash'),
                team: 'ORDER',
            },
            {
                championName: 'Thresh',
                isBot: false,
                isDead: false,
                items: buildItems(t, 'support'),
                level: Math.min(Math.floor(t / 120) + 1, 18),
                position: 'UTILITY',
                rawChampionName: 'live_champion_Thresh',
                respawnTimer: 0,
                scores: { kills: scaledKills - 2, deaths: scaledDeaths + 1, assists: scaledAssists + 6, creepScore: Math.floor(userCS * 0.15), wardScore: 28 },
                skinID: 0,
                summonerName: 'HookCity',
                summonerSpells: makeSpells('Exhaust', 'Flash'),
                team: 'ORDER',
            },

            // ─── Enemy Team (CHAOS) ────────────────────────────────────────
            {
                championName: 'DrMundo',
                isBot: false,
                isDead: false,
                items: buildItems(t, 'tank-hp'),
                level: Math.min(Math.floor(t / 105) + 1, 18),
                position: 'TOP',
                rawChampionName: 'live_champion_DrMundo',
                respawnTimer: 0,
                scores: { kills: scaledKills - 1, deaths: scaledDeaths + 1, assists: scaledAssists, creepScore: userCS + 8, wardScore: 5 },
                skinID: 0,
                summonerName: 'MundoGoWhere',
                summonerSpells: makeSpells('Teleport', 'Flash'),
                team: 'CHAOS',
            },
            {
                championName: 'Briar',
                isBot: false,
                isDead: false,
                items: buildItems(t, 'bruiser-heal'),
                level: Math.min(Math.floor(t / 100) + 1, 18),
                position: 'JUNGLE',
                rawChampionName: 'live_champion_Briar',
                respawnTimer: 0,
                scores: { kills: scaledKills + 3, deaths: scaledDeaths - 1, assists: scaledAssists - 1, creepScore: Math.floor(userCS * 0.65), wardScore: 3 },
                skinID: 0,
                summonerName: 'BriarFeast',
                summonerSpells: makeSpells('Smite', 'Flash'),
                team: 'CHAOS',
            },
            {
                championName: 'Syndra',
                isBot: false,
                isDead: t > 600 && t % 60 < 10,
                items: buildItems(t, 'heavy-ap'),
                level: Math.min(Math.floor(t / 95) + 1, 18),
                position: 'MIDDLE',
                rawChampionName: 'live_champion_Syndra',
                respawnTimer: t > 600 && t % 60 < 10 ? 25 : 0,
                scores: { kills: scaledKills + 4, deaths: scaledDeaths - 2, assists: scaledAssists + 2, creepScore: userCS + 15, wardScore: 7 },
                skinID: 0,
                summonerName: 'DarkSovereign',
                summonerSpells: makeSpells('Barrier', 'Flash'),
                team: 'CHAOS',
            },
            {
                championName: 'Kaisa',
                isBot: false,
                isDead: false,
                items: buildItems(t, 'adc'),
                level: Math.min(Math.floor(t / 100) + 1, 18),
                position: 'BOTTOM',
                rawChampionName: 'live_champion_Kaisa',
                respawnTimer: 0,
                scores: { kills: scaledKills + 1, deaths: scaledDeaths + 1, assists: scaledAssists, creepScore: opponentCS, wardScore: 5 },
                skinID: 0,
                summonerName: 'KaisaSnipe',
                summonerSpells: makeSpells('Heal', 'Flash'),
                team: 'CHAOS',
            },
            {
                championName: 'Nautilus',
                isBot: false,
                isDead: false,
                items: buildItems(t, 'support-tank'),
                level: Math.min(Math.floor(t / 125) + 1, 18),
                position: 'UTILITY',
                rawChampionName: 'live_champion_Nautilus',
                respawnTimer: 0,
                scores: { kills: scaledKills - 3, deaths: scaledDeaths + 2, assists: scaledAssists + 5, creepScore: Math.floor(userCS * 0.12), wardScore: 22 },
                skinID: 0,
                summonerName: 'AnchorDown',
                summonerSpells: makeSpells('Ignite', 'Flash'),
                team: 'CHAOS',
            },
        ],
        events: {
            Events: generateMockEvents(t, scaledKills),
        },
        gameData: {
            gameMode: 'CLASSIC',
            gameTime: t,
            mapName: 'Map11',
            mapNumber: 11,
            mapTerrain: 'Default',
        },
    };
}

// ─── Item Building Helpers ──────────────────────────────────────────────────

type BuildProfile = 'adc' | 'mage' | 'heavy-ap' | 'bruiser' | 'bruiser-heal' | 'tank-ad' | 'tank-hp' | 'support' | 'support-tank';

function buildItems(gameTime: number, profile: BuildProfile) {
    // Items progress as game time advances. IDs map to real Data Dragon item IDs.
    const earlyThreshold = 420;   // 7 min
    const midThreshold = 900;     // 15 min
    const lateThreshold = 1500;   // 25 min

    const profiles: Record<BuildProfile, { early: number[]; mid: number[]; late: number[]; full: number[] }> = {
        'adc': {
            early: [1055, 1001],                    // Long Sword, Boots
            mid: [3031, 3006],                      // Infinity Edge, Berserker's Greaves
            late: [3031, 3006, 3094],               // + Rapid Firecannon
            full: [3031, 3006, 3094, 3072, 3036],   // + Bloodthirster, Lord Dominik's
        },
        'mage': {
            early: [1056, 1001],                    // Doran's Ring, Boots
            mid: [4005, 3020],                      // Imperial Mandate, Sorcerer's Shoes
            late: [4005, 3020, 3089],               // + Rabadon's
            full: [4005, 3020, 3089, 3135, 3116],   // + Void Staff, Rylai's
        },
        'heavy-ap': {
            early: [1056, 1001],
            mid: [6653, 3020],                      // Liandry's, Sorc Shoes
            late: [6653, 3020, 3089],               // + Rabadon's
            full: [6653, 3020, 3089, 3135, 3157],   // + Void Staff, Zhonya's
        },
        'bruiser': {
            early: [1036, 1001],
            mid: [6631, 3111],                      // Stridebreaker, Mercury's Treads
            late: [6631, 3111, 3071],               // + Black Cleaver
            full: [6631, 3111, 3071, 3053, 3026],   // + Sterak's, Guardian Angel
        },
        'bruiser-heal': {
            early: [1036, 1001],
            mid: [6631, 3111],                      // Stridebreaker, Mercs
            late: [6631, 3111, 3812],               // + Death's Dance
            full: [6631, 3111, 3812, 3053, 3065],   // + Sterak's, Spirit Visage
        },
        'tank-ad': {
            early: [1054, 1001],                    // Doran's Shield, Boots
            mid: [6662, 3047],                      // Iceborn Gauntlet, Plated Steelcaps
            late: [6662, 3047, 3143],               // + Randuin's
            full: [6662, 3047, 3143, 3065, 3742],   // + Spirit Visage, Dead Man's Plate
        },
        'tank-hp': {
            early: [1054, 1028],                    // Doran's Shield, Ruby Crystal
            mid: [3084, 3047],                      // Heartsteel, Steelcaps
            late: [3084, 3047, 3143],               // + Randuin's
            full: [3084, 3047, 3143, 3065, 3075],   // + Spirit Visage, Thornmail
        },
        'support': {
            early: [3850, 1001],                    // Spellthief's Edge, Boots
            mid: [3851, 3158],                      // Frostfang, Ionian Boots
            late: [3851, 3158, 3504],               // + Ardent Censer
            full: [3851, 3158, 3504, 3107, 3011],   // + Redemption, Chemtech Putrifier
        },
        'support-tank': {
            early: [3858, 1001],                    // Relic Shield, Boots
            mid: [3859, 3047],                      // Targon's, Steelcaps
            late: [3859, 3047, 3190],               // + Locket
            full: [3859, 3047, 3190, 3109, 3075],   // + Knight's Vow, Thornmail
        },
    };

    const p = profiles[profile];
    let itemIds: number[];
    if (gameTime < earlyThreshold) itemIds = p.early;
    else if (gameTime < midThreshold) itemIds = p.mid;
    else if (gameTime < lateThreshold) itemIds = p.late;
    else itemIds = p.full;

    return itemIds.map((id, slot) => ({
        canUse: true,
        consumable: false,
        count: 1,
        displayName: ITEM_NAMES[id] || `Item ${id}`,
        itemID: id,
        price: ITEM_PRICES[id] || 0,
        rawDescription: '',
        rawDisplayName: '',
        slot,
    }));
}

function makeSpells(spell1: string, spell2: string) {
    return {
        summonerSpellOne: { displayName: spell1, rawDescription: '', rawDisplayName: '' },
        summonerSpellTwo: { displayName: spell2, rawDescription: '', rawDisplayName: '' },
    };
}

function generateMockEvents(t: number, kills: number): Array<{ EventID: number; EventName: string; EventTime: number; KillerName?: string; VictimName?: string; Assisters?: string[] }> {
    const events = [
        { EventID: 0, EventName: 'GameStart', EventTime: 0 },
        { EventID: 1, EventName: 'MinionsSpawning', EventTime: 65 },
    ];
    if (t > 180) events.push({ EventID: 2, EventName: 'ChampionKill', EventTime: 180, KillerName: 'BlitzUser', VictimName: 'KaisaSnipe', Assisters: ['HookCity'] });
    if (t > 360) events.push({ EventID: 3, EventName: 'TurretKilled', EventTime: 360, KillerName: 'BlitzUser' });
    if (t > 480) events.push({ EventID: 4, EventName: 'DragonKill', EventTime: 480, KillerName: 'JGL_Diff' });
    if (t > 600) events.push({ EventID: 5, EventName: 'ChampionKill', EventTime: 600, KillerName: 'DarkSovereign', VictimName: 'MidKingAhri', Assisters: ['BriarFeast'] });
    return events;
}

// ─── Item Metadata Lookup (subset for mock display names / prices) ──────────

const ITEM_NAMES: Record<number, string> = {
    1001: 'Boots', 1028: 'Ruby Crystal', 1036: 'Long Sword', 1054: "Doran's Shield",
    1055: 'Long Sword', 1056: "Doran's Ring",
    3006: "Berserker's Greaves", 3011: 'Chemtech Putrifier', 3020: "Sorcerer's Shoes",
    3026: 'Guardian Angel', 3031: 'Infinity Edge', 3036: "Lord Dominik's Regards",
    3047: 'Plated Steelcaps', 3053: "Sterak's Gage", 3065: 'Spirit Visage',
    3071: 'Black Cleaver', 3072: 'Bloodthirster', 3075: 'Thornmail',
    3084: 'Heartsteel', 3089: "Rabadon's Deathcap", 3094: 'Rapid Firecannon',
    3107: 'Redemption', 3109: "Knight's Vow", 3111: "Mercury's Treads",
    3116: "Rylai's Crystal Scepter", 3135: 'Void Staff', 3143: "Randuin's Omen",
    3157: "Zhonya's Hourglass", 3158: 'Ionian Boots of Lucidity', 3190: 'Locket of the Iron Solari',
    3504: 'Ardent Censer', 3742: "Dead Man's Plate", 3812: "Death's Dance",
    3850: "Spellthief's Edge", 3851: 'Frostfang', 3858: 'Relic Shield', 3859: "Targon's Buckler",
    4005: 'Imperial Mandate', 6631: 'Stridebreaker', 6653: "Liandry's Anguish",
    6662: 'Iceborn Gauntlet',
};

const ITEM_PRICES: Record<number, number> = {
    1001: 300, 1028: 400, 1036: 350, 1054: 450, 1055: 350, 1056: 400,
    3006: 1100, 3011: 2300, 3020: 1100, 3026: 3000, 3031: 3400, 3036: 3000,
    3047: 1100, 3053: 3100, 3065: 2900, 3071: 3100, 3072: 3400, 3075: 2700,
    3084: 3200, 3089: 3600, 3094: 2600, 3107: 2300, 3109: 2300, 3111: 1100,
    3116: 2600, 3135: 2800, 3143: 2700, 3157: 3000, 3158: 950, 3190: 2500,
    3504: 2300, 3742: 2900, 3812: 3100, 3850: 400, 3851: 400, 3858: 400,
    3859: 400, 4005: 2500, 6631: 3300, 6653: 3200, 6662: 2800,
};
