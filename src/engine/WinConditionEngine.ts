// =============================================================================
// WinConditionEngine — Analyzes team compositions and game state to determine
// the optimal strategy and outputs dynamic, natural-language advice.
// =============================================================================

import type { LiveGameData, PlayerData } from '../types';

// ─── Win Condition Types ────────────────────────────────────────────────────

export type WinConditionType =
    | 'TEAMFIGHT'
    | 'SPLIT_PUSH'
    | 'PICK_COMP'
    | 'SCALE_LATE'
    | 'EARLY_SNOWBALL'
    | 'OBJECTIVE_CONTROL';

export interface WinCondition {
    primary: WinConditionType;
    secondary: WinConditionType | null;
    confidence: number;          // 0-100
    phase: 'EARLY' | 'MID' | 'LATE';
    advice: string;              // Main strategic advice
    subAdvice: string;           // Secondary tip
    teamPowerLevel: 'WEAKER' | 'EVEN' | 'STRONGER';
    spikeInfo: string | null;    // e.g. "You spike at 3 items (24 min)"
}

// ─── Champion Classification Database ───────────────────────────────────────

interface ChampProfile {
    scaling: 'early' | 'mid' | 'late';    // When this champ is strongest
    role: 'engage' | 'peel' | 'damage' | 'splitpush' | 'poke' | 'pick' | 'utility';
    splitPotential: number;               // 0-10
    teamfightPower: number;               // 0-10
    engageRating: number;                 // 0-10
    burstRating: number;                  // 0-10
}

const CHAMP_DB: Record<string, ChampProfile> = {
    // ── Marksmen ──
    Jinx: { scaling: 'late', role: 'damage', splitPotential: 3, teamfightPower: 10, engageRating: 0, burstRating: 4 },
    Kaisa: { scaling: 'mid', role: 'damage', splitPotential: 5, teamfightPower: 8, engageRating: 3, burstRating: 7 },
    Vayne: { scaling: 'late', role: 'damage', splitPotential: 7, teamfightPower: 7, engageRating: 0, burstRating: 6 },
    Draven: { scaling: 'early', role: 'damage', splitPotential: 3, teamfightPower: 7, engageRating: 0, burstRating: 8 },
    Caitlyn: { scaling: 'mid', role: 'poke', splitPotential: 4, teamfightPower: 7, engageRating: 0, burstRating: 5 },
    Jhin: { scaling: 'mid', role: 'pick', splitPotential: 2, teamfightPower: 7, engageRating: 1, burstRating: 8 },
    Ezreal: { scaling: 'mid', role: 'poke', splitPotential: 4, teamfightPower: 6, engageRating: 0, burstRating: 5 },
    Lucian: { scaling: 'early', role: 'damage', splitPotential: 4, teamfightPower: 6, engageRating: 0, burstRating: 7 },
    Tristana: { scaling: 'late', role: 'damage', splitPotential: 6, teamfightPower: 8, engageRating: 1, burstRating: 7 },
    Ashe: { scaling: 'mid', role: 'utility', splitPotential: 2, teamfightPower: 7, engageRating: 6, burstRating: 3 },
    MissFortune: { scaling: 'mid', role: 'damage', splitPotential: 2, teamfightPower: 9, engageRating: 0, burstRating: 7 },
    Xayah: { scaling: 'mid', role: 'damage', splitPotential: 3, teamfightPower: 8, engageRating: 0, burstRating: 6 },
    Sivir: { scaling: 'late', role: 'damage', splitPotential: 5, teamfightPower: 8, engageRating: 1, burstRating: 4 },
    Twitch: { scaling: 'late', role: 'damage', splitPotential: 3, teamfightPower: 10, engageRating: 1, burstRating: 7 },
    Zeri: { scaling: 'late', role: 'damage', splitPotential: 4, teamfightPower: 9, engageRating: 0, burstRating: 4 },
    Samira: { scaling: 'mid', role: 'damage', splitPotential: 2, teamfightPower: 9, engageRating: 3, burstRating: 9 },
    Aphelios: { scaling: 'late', role: 'damage', splitPotential: 2, teamfightPower: 10, engageRating: 0, burstRating: 6 },
    Varus: { scaling: 'mid', role: 'poke', splitPotential: 2, teamfightPower: 7, engageRating: 4, burstRating: 7 },
    KogMaw: { scaling: 'late', role: 'damage', splitPotential: 1, teamfightPower: 10, engageRating: 0, burstRating: 3 },
    // ── Mages ──
    Ahri: { scaling: 'mid', role: 'pick', splitPotential: 4, teamfightPower: 7, engageRating: 5, burstRating: 8 },
    Syndra: { scaling: 'mid', role: 'damage', splitPotential: 3, teamfightPower: 8, engageRating: 2, burstRating: 10 },
    Viktor: { scaling: 'late', role: 'damage', splitPotential: 3, teamfightPower: 9, engageRating: 1, burstRating: 7 },
    Orianna: { scaling: 'mid', role: 'utility', splitPotential: 2, teamfightPower: 10, engageRating: 7, burstRating: 7 },
    Azir: { scaling: 'late', role: 'damage', splitPotential: 4, teamfightPower: 10, engageRating: 5, burstRating: 6 },
    Veigar: { scaling: 'late', role: 'damage', splitPotential: 2, teamfightPower: 8, engageRating: 3, burstRating: 10 },
    Lux: { scaling: 'mid', role: 'poke', splitPotential: 2, teamfightPower: 7, engageRating: 2, burstRating: 8 },
    Xerath: { scaling: 'mid', role: 'poke', splitPotential: 2, teamfightPower: 7, engageRating: 0, burstRating: 7 },
    Cassiopeia: { scaling: 'late', role: 'damage', splitPotential: 3, teamfightPower: 9, engageRating: 4, burstRating: 7 },
    Ryze: { scaling: 'late', role: 'damage', splitPotential: 7, teamfightPower: 7, engageRating: 2, burstRating: 6 },
    Anivia: { scaling: 'late', role: 'damage', splitPotential: 2, teamfightPower: 9, engageRating: 1, burstRating: 5 },
    Hwei: { scaling: 'mid', role: 'poke', splitPotential: 3, teamfightPower: 8, engageRating: 2, burstRating: 6 },
    Aurora: { scaling: 'mid', role: 'damage', splitPotential: 5, teamfightPower: 8, engageRating: 4, burstRating: 7 },
    // ── Assassins ──
    Zed: { scaling: 'mid', role: 'pick', splitPotential: 8, teamfightPower: 4, engageRating: 1, burstRating: 10 },
    Talon: { scaling: 'early', role: 'pick', splitPotential: 7, teamfightPower: 4, engageRating: 2, burstRating: 9 },
    Katarina: { scaling: 'mid', role: 'damage', splitPotential: 5, teamfightPower: 9, engageRating: 2, burstRating: 10 },
    Akali: { scaling: 'mid', role: 'pick', splitPotential: 7, teamfightPower: 6, engageRating: 3, burstRating: 10 },
    Fizz: { scaling: 'mid', role: 'pick', splitPotential: 5, teamfightPower: 5, engageRating: 2, burstRating: 10 },
    Ekko: { scaling: 'mid', role: 'pick', splitPotential: 7, teamfightPower: 7, engageRating: 3, burstRating: 9 },
    Qiyana: { scaling: 'mid', role: 'pick', splitPotential: 4, teamfightPower: 7, engageRating: 4, burstRating: 10 },
    Yone: { scaling: 'late', role: 'damage', splitPotential: 7, teamfightPower: 9, engageRating: 6, burstRating: 8 },
    Yasuo: { scaling: 'late', role: 'damage', splitPotential: 6, teamfightPower: 8, engageRating: 3, burstRating: 7 },
    Khazix: { scaling: 'mid', role: 'pick', splitPotential: 4, teamfightPower: 5, engageRating: 2, burstRating: 10 },
    Rengar: { scaling: 'mid', role: 'pick', splitPotential: 5, teamfightPower: 4, engageRating: 2, burstRating: 10 },
    Naafiri: { scaling: 'early', role: 'pick', splitPotential: 5, teamfightPower: 5, engageRating: 3, burstRating: 9 },
    // ── Fighters / Bruisers ──
    Darius: { scaling: 'mid', role: 'damage', splitPotential: 7, teamfightPower: 8, engageRating: 4, burstRating: 6 },
    Garen: { scaling: 'mid', role: 'damage', splitPotential: 7, teamfightPower: 6, engageRating: 3, burstRating: 7 },
    Jax: { scaling: 'late', role: 'splitpush', splitPotential: 10, teamfightPower: 6, engageRating: 3, burstRating: 5 },
    Fiora: { scaling: 'late', role: 'splitpush', splitPotential: 10, teamfightPower: 3, engageRating: 0, burstRating: 7 },
    Camille: { scaling: 'mid', role: 'splitpush', splitPotential: 9, teamfightPower: 6, engageRating: 5, burstRating: 8 },
    Irelia: { scaling: 'mid', role: 'splitpush', splitPotential: 8, teamfightPower: 7, engageRating: 4, burstRating: 7 },
    Riven: { scaling: 'mid', role: 'splitpush', splitPotential: 8, teamfightPower: 6, engageRating: 4, burstRating: 8 },
    Aatrox: { scaling: 'mid', role: 'damage', splitPotential: 6, teamfightPower: 8, engageRating: 5, burstRating: 6 },
    Mordekaiser: { scaling: 'mid', role: 'damage', splitPotential: 7, teamfightPower: 7, engageRating: 4, burstRating: 6 },
    Sett: { scaling: 'mid', role: 'engage', splitPotential: 6, teamfightPower: 8, engageRating: 7, burstRating: 6 },
    Viego: { scaling: 'mid', role: 'damage', splitPotential: 6, teamfightPower: 7, engageRating: 3, burstRating: 7 },
    Renekton: { scaling: 'early', role: 'engage', splitPotential: 6, teamfightPower: 6, engageRating: 5, burstRating: 7 },
    Nasus: { scaling: 'late', role: 'splitpush', splitPotential: 10, teamfightPower: 5, engageRating: 2, burstRating: 4 },
    Illaoi: { scaling: 'mid', role: 'damage', splitPotential: 8, teamfightPower: 7, engageRating: 1, burstRating: 5 },
    Olaf: { scaling: 'early', role: 'damage', splitPotential: 5, teamfightPower: 6, engageRating: 5, burstRating: 5 },
    KSante: { scaling: 'mid', role: 'engage', splitPotential: 5, teamfightPower: 8, engageRating: 8, burstRating: 5 },
    // ── Tanks ──
    Ornn: { scaling: 'late', role: 'engage', splitPotential: 2, teamfightPower: 10, engageRating: 9, burstRating: 3 },
    Malphite: { scaling: 'late', role: 'engage', splitPotential: 2, teamfightPower: 10, engageRating: 10, burstRating: 6 },
    Maokai: { scaling: 'mid', role: 'engage', splitPotential: 2, teamfightPower: 8, engageRating: 7, burstRating: 2 },
    Shen: { scaling: 'mid', role: 'utility', splitPotential: 7, teamfightPower: 7, engageRating: 6, burstRating: 3 },
    Sejuani: { scaling: 'mid', role: 'engage', splitPotential: 1, teamfightPower: 9, engageRating: 9, burstRating: 3 },
    Zac: { scaling: 'mid', role: 'engage', splitPotential: 1, teamfightPower: 9, engageRating: 10, burstRating: 3 },
    Amumu: { scaling: 'mid', role: 'engage', splitPotential: 1, teamfightPower: 9, engageRating: 10, burstRating: 3 },
    DrMundo: { scaling: 'late', role: 'damage', splitPotential: 7, teamfightPower: 6, engageRating: 2, burstRating: 2 },
    Poppy: { scaling: 'mid', role: 'peel', splitPotential: 3, teamfightPower: 7, engageRating: 5, burstRating: 5 },
    // ── Junglers ──
    LeeSin: { scaling: 'early', role: 'pick', splitPotential: 4, teamfightPower: 6, engageRating: 7, burstRating: 7 },
    Vi: { scaling: 'mid', role: 'engage', splitPotential: 3, teamfightPower: 7, engageRating: 8, burstRating: 7 },
    JarvanIV: { scaling: 'mid', role: 'engage', splitPotential: 3, teamfightPower: 8, engageRating: 9, burstRating: 5 },
    XinZhao: { scaling: 'early', role: 'engage', splitPotential: 4, teamfightPower: 6, engageRating: 7, burstRating: 6 },
    Briar: { scaling: 'mid', role: 'pick', splitPotential: 5, teamfightPower: 6, engageRating: 5, burstRating: 8 },
    Belveth: { scaling: 'late', role: 'splitpush', splitPotential: 9, teamfightPower: 6, engageRating: 3, burstRating: 5 },
    Warwick: { scaling: 'early', role: 'engage', splitPotential: 4, teamfightPower: 6, engageRating: 6, burstRating: 5 },
    Udyr: { scaling: 'mid', role: 'engage', splitPotential: 6, teamfightPower: 7, engageRating: 5, burstRating: 4 },
    Volibear: { scaling: 'mid', role: 'engage', splitPotential: 5, teamfightPower: 7, engageRating: 6, burstRating: 5 },
    Trundle: { scaling: 'mid', role: 'splitpush', splitPotential: 7, teamfightPower: 5, engageRating: 4, burstRating: 3 },
    Nocturne: { scaling: 'mid', role: 'pick', splitPotential: 7, teamfightPower: 5, engageRating: 6, burstRating: 8 },
    Hecarim: { scaling: 'mid', role: 'engage', splitPotential: 3, teamfightPower: 8, engageRating: 9, burstRating: 6 },
    Kayn: { scaling: 'mid', role: 'pick', splitPotential: 5, teamfightPower: 7, engageRating: 4, burstRating: 8 },
    Shaco: { scaling: 'early', role: 'pick', splitPotential: 8, teamfightPower: 3, engageRating: 1, burstRating: 8 },
    Elise: { scaling: 'early', role: 'pick', splitPotential: 3, teamfightPower: 5, engageRating: 4, burstRating: 8 },
    Nidalee: { scaling: 'early', role: 'poke', splitPotential: 4, teamfightPower: 4, engageRating: 0, burstRating: 8 },
    RekSai: { scaling: 'early', role: 'engage', splitPotential: 3, teamfightPower: 6, engageRating: 6, burstRating: 7 },
    // ── Supports ──
    Thresh: { scaling: 'mid', role: 'engage', splitPotential: 0, teamfightPower: 8, engageRating: 8, burstRating: 2 },
    Nautilus: { scaling: 'mid', role: 'engage', splitPotential: 0, teamfightPower: 8, engageRating: 9, burstRating: 3 },
    Leona: { scaling: 'mid', role: 'engage', splitPotential: 0, teamfightPower: 8, engageRating: 10, burstRating: 3 },
    Alistar: { scaling: 'mid', role: 'engage', splitPotential: 0, teamfightPower: 8, engageRating: 9, burstRating: 2 },
    Blitzcrank: { scaling: 'early', role: 'pick', splitPotential: 0, teamfightPower: 6, engageRating: 7, burstRating: 4 },
    Pyke: { scaling: 'early', role: 'pick', splitPotential: 1, teamfightPower: 5, engageRating: 5, burstRating: 8 },
    Rakan: { scaling: 'mid', role: 'engage', splitPotential: 0, teamfightPower: 9, engageRating: 10, burstRating: 2 },
    Lulu: { scaling: 'mid', role: 'peel', splitPotential: 0, teamfightPower: 8, engageRating: 1, burstRating: 1 },
    Janna: { scaling: 'mid', role: 'peel', splitPotential: 0, teamfightPower: 7, engageRating: 1, burstRating: 1 },
    Soraka: { scaling: 'late', role: 'peel', splitPotential: 0, teamfightPower: 9, engageRating: 0, burstRating: 1 },
    Nami: { scaling: 'mid', role: 'peel', splitPotential: 0, teamfightPower: 8, engageRating: 4, burstRating: 2 },
    Yuumi: { scaling: 'late', role: 'peel', splitPotential: 0, teamfightPower: 7, engageRating: 0, burstRating: 1 },
    Senna: { scaling: 'late', role: 'damage', splitPotential: 2, teamfightPower: 8, engageRating: 1, burstRating: 5 },
    Karma: { scaling: 'early', role: 'utility', splitPotential: 1, teamfightPower: 7, engageRating: 2, burstRating: 3 },
    Morgana: { scaling: 'mid', role: 'peel', splitPotential: 1, teamfightPower: 8, engageRating: 4, burstRating: 3 },
    Zyra: { scaling: 'mid', role: 'damage', splitPotential: 1, teamfightPower: 8, engageRating: 3, burstRating: 5 },
    Bard: { scaling: 'mid', role: 'pick', splitPotential: 2, teamfightPower: 7, engageRating: 6, burstRating: 3 },
    Renata: { scaling: 'mid', role: 'utility', splitPotential: 0, teamfightPower: 9, engageRating: 4, burstRating: 2 },
    Milio: { scaling: 'mid', role: 'peel', splitPotential: 0, teamfightPower: 8, engageRating: 0, burstRating: 1 },
};

const DEFAULT_PROFILE: ChampProfile = {
    scaling: 'mid', role: 'damage', splitPotential: 5,
    teamfightPower: 6, engageRating: 3, burstRating: 5,
};

function getProfile(name: string): ChampProfile {
    return CHAMP_DB[name] || DEFAULT_PROFILE;
}

// ─── Core Engine ────────────────────────────────────────────────────────────

export function analyzeWinCondition(gameData: LiveGameData): WinCondition {
    const userName = gameData.activePlayer.summonerName;
    const userPlayer = gameData.allPlayers.find((p) => p.summonerName === userName);
    if (!userPlayer) return fallbackCondition();

    const userTeam = userPlayer.team;
    const allies = gameData.allPlayers.filter((p) => p.team === userTeam);
    const enemies = gameData.allPlayers.filter((p) => p.team !== userTeam);
    const gameTime = gameData.gameData.gameTime;
    const gameMin = gameTime / 60;

    // Phase
    const phase: 'EARLY' | 'MID' | 'LATE' =
        gameMin < 14 ? 'EARLY' : gameMin < 28 ? 'MID' : 'LATE';

    // Team profiles
    const allyProfiles = allies.map((p) => ({ player: p, profile: getProfile(p.championName) }));
    const enemyProfiles = enemies.map((p) => ({ player: p, profile: getProfile(p.championName) }));

    // Aggregate team stats
    const allyTeamfight = avg(allyProfiles.map((a) => a.profile.teamfightPower));
    const enemyTeamfight = avg(enemyProfiles.map((a) => a.profile.teamfightPower));
    const allyEngage = Math.max(...allyProfiles.map((a) => a.profile.engageRating));
    const enemyEngage = Math.max(...enemyProfiles.map((a) => a.profile.engageRating));
    const allySplit = Math.max(...allyProfiles.map((a) => a.profile.splitPotential));
    const allyBurst = avg(allyProfiles.map((a) => a.profile.burstRating));
    const allyScaling = countScaling(allyProfiles.map((a) => a.profile));
    const enemyScaling = countScaling(enemyProfiles.map((a) => a.profile));

    // Gold state
    const allyGold = estimateTeamGold(allies);
    const enemyGold = estimateTeamGold(enemies);
    const goldDiff = allyGold - enemyGold;
    const aheadByGold = goldDiff > 1500;
    const behindByGold = goldDiff < -1500;

    // KDA state
    const allyKills = allies.reduce((s, p) => s + p.scores.kills, 0);
    const enemyKills = enemies.reduce((s, p) => s + p.scores.kills, 0);

    // Power level
    const teamPowerLevel: 'WEAKER' | 'EVEN' | 'STRONGER' =
        goldDiff > 2000 ? 'STRONGER' : goldDiff < -2000 ? 'WEAKER' : 'EVEN';

    // ─── Determine Win Condition ──────────────────────────────────

    // Score each strategy
    const scores: Record<WinConditionType, number> = {
        TEAMFIGHT: 0, SPLIT_PUSH: 0, PICK_COMP: 0,
        SCALE_LATE: 0, EARLY_SNOWBALL: 0, OBJECTIVE_CONTROL: 0,
    };

    // Teamfight: high teamfight power, good engage, AoE
    scores.TEAMFIGHT = allyTeamfight * 8 + (allyEngage >= 7 ? 20 : 0) + (aheadByGold ? 10 : 0);
    if (enemyTeamfight > allyTeamfight + 1) scores.TEAMFIGHT -= 15;

    // Split push: someone with high split potential
    scores.SPLIT_PUSH = allySplit * 6 + (allyScaling.late > 0 ? 10 : 0);
    if (allySplit >= 8) scores.SPLIT_PUSH += 15;
    if (enemyEngage >= 8) scores.SPLIT_PUSH += 5; // Hard to teamfight vs strong engage → split

    // Pick comp: high burst, pick-oriented champs
    scores.PICK_COMP = allyBurst * 5 + countRole(allyProfiles, 'pick') * 15;
    if (enemyTeamfight > allyTeamfight) scores.PICK_COMP += 10; // Can't 5v5 → pick

    // Scale late: lots of late-game champs, currently behind or even
    scores.SCALE_LATE = allyScaling.late * 20 + (behindByGold && phase === 'EARLY' ? 15 : 0);
    if (phase === 'LATE') scores.SCALE_LATE -= 20; // Already late, no point "scaling"

    // Early snowball: early champs, currently winning
    scores.EARLY_SNOWBALL = allyScaling.early * 15 + (aheadByGold ? 20 : 0);
    if (phase === 'LATE') scores.EARLY_SNOWBALL -= 30;
    if (allyKills > enemyKills + 3) scores.EARLY_SNOWBALL += 10;

    // Objective control: engage + teamfight for dragon/baron
    scores.OBJECTIVE_CONTROL = (allyEngage >= 6 ? 15 : 0) + allyTeamfight * 4;
    if (phase === 'MID' || phase === 'LATE') scores.OBJECTIVE_CONTROL += 10;

    // Sort
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]) as [WinConditionType, number][];
    const primary = sorted[0][0];
    const secondary = sorted[1][1] > sorted[0][1] * 0.6 ? sorted[1][0] : null;
    const confidence = Math.min(95, 50 + Math.round((sorted[0][1] - sorted[1][1]) / 2));

    // ─── Generate Advice ──────────────────────────────────────────

    const { advice, subAdvice } = generateAdvice(
        primary, secondary, phase, teamPowerLevel, goldDiff,
        allyProfiles, enemyProfiles, gameMin
    );

    // Spike info
    let spikeInfo: string | null = null;
    if (allyScaling.late >= 2 && phase !== 'LATE') {
        const estSpikeMin = phase === 'EARLY' ? '25-30' : '30-35';
        spikeInfo = `Team spikes at 3+ items (~${estSpikeMin} min)`;
    } else if (allyScaling.early >= 2 && phase === 'EARLY') {
        spikeInfo = 'Team is strongest NOW — press the advantage';
    }

    return { primary, secondary, confidence, phase, advice, subAdvice, teamPowerLevel, spikeInfo };
}

// ─── Advice Generation ──────────────────────────────────────────────────────

function generateAdvice(
    primary: WinConditionType,
    secondary: WinConditionType | null,
    phase: 'EARLY' | 'MID' | 'LATE',
    power: 'WEAKER' | 'EVEN' | 'STRONGER',
    goldDiff: number,
    allies: { player: PlayerData; profile: ChampProfile }[],
    enemies: { player: PlayerData; profile: ChampProfile }[],
    gameMin: number,
): { advice: string; subAdvice: string } {
    const splitter = allies.find((a) => a.profile.splitPotential >= 8);
    const scaler = allies.find((a) => a.profile.scaling === 'late');

    switch (primary) {
        case 'TEAMFIGHT':
            if (power === 'STRONGER')
                return { advice: 'Force 5v5 fights at objectives.', subAdvice: 'Group for Dragon/Baron — your teamfight is superior.' };
            if (power === 'WEAKER')
                return { advice: 'Only teamfight at chokepoints.', subAdvice: 'Avoid open-field fights. Use terrain advantage around objectives.' };
            return { advice: 'Look for 5v5 teamfights.', subAdvice: 'Your comp excels in grouped fights. Contest objectives together.' };

        case 'SPLIT_PUSH':
            return {
                advice: `${splitter?.player.championName || 'Your toplaner'} should split-push.`,
                subAdvice: `4 members pressure mid while ${splitter?.player.championName || 'split-pusher'} takes sidelane.`,
            };

        case 'PICK_COMP':
            return {
                advice: 'Avoid 5v5. Look for isolated picks.',
                subAdvice: 'Control vision in jungle. Catch enemies rotating between lanes.',
            };

        case 'SCALE_LATE':
            if (phase === 'EARLY') return {
                advice: 'Play safe — your team outscales.',
                subAdvice: `${scaler?.player.championName || 'Your carries'} need time. Farm and avoid unnecessary fights.`,
            };
            return {
                advice: 'Your team is hitting power spikes.',
                subAdvice: 'Start looking for favorable fights. You scale harder from here.',
            };

        case 'EARLY_SNOWBALL':
            return {
                advice: 'Push your lead NOW — your comp falls off.',
                subAdvice: `Force objectives and tower dives. Close the game before ${Math.round(gameMin + 10)} min.`,
            };

        case 'OBJECTIVE_CONTROL':
            return {
                advice: 'Play for Dragon/Baron — your team controls objectives.',
                subAdvice: 'Set up vision 60s before spawn. Force fights at pit.',
            };

        default:
            return { advice: 'Play your comp strengths.', subAdvice: 'Adapt to the game state.' };
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function countScaling(profiles: ChampProfile[]): { early: number; mid: number; late: number } {
    return {
        early: profiles.filter((p) => p.scaling === 'early').length,
        mid: profiles.filter((p) => p.scaling === 'mid').length,
        late: profiles.filter((p) => p.scaling === 'late').length,
    };
}

function countRole(team: { profile: ChampProfile }[], role: string): number {
    return team.filter((t) => t.profile.role === role).length;
}

function estimateTeamGold(players: PlayerData[]): number {
    return players.reduce((sum, p) => {
        const itemGold = p.items.reduce((s, i) => s + i.price, 0);
        const kdaGold = p.scores.kills * 300 + p.scores.assists * 150;
        const csGold = p.scores.creepScore * 21;
        return sum + itemGold + kdaGold + csGold;
    }, 0);
}

function fallbackCondition(): WinCondition {
    return {
        primary: 'TEAMFIGHT', secondary: null, confidence: 50,
        phase: 'EARLY', advice: 'Play standard.', subAdvice: 'Waiting for game data...',
        teamPowerLevel: 'EVEN', spikeInfo: null,
    };
}
