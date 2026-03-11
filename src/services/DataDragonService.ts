// =============================================================================
// DataDragonService — Fetches and caches item/champion metadata from Riot CDN
// =============================================================================

import type { DDragonItem, DDragonItemMap, DDragonChampion } from '../types';

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';
let currentVersion: string | null = null;
let itemCache: DDragonItemMap = {};
let championCache: Record<string, DDragonChampion> = {};
let isInitialized = false;

/** Fetch the latest Data Dragon version */
async function fetchLatestVersion(): Promise<string> {
    if (currentVersion) return currentVersion;
    try {
        const res = await fetch(`${DDRAGON_BASE}/api/versions.json`);
        const versions: string[] = await res.json();
        currentVersion = versions[0];
        console.log(`[DataDragon] Using version: ${currentVersion}`);
        return currentVersion;
    } catch (e) {
        console.warn('[DataDragon] Failed to fetch version, using fallback');
        currentVersion = '14.24.1';
        return currentVersion;
    }
}

/** Download and cache item.json */
async function fetchItems(version: string): Promise<void> {
    try {
        const res = await fetch(`${DDRAGON_BASE}/cdn/${version}/data/en_US/item.json`);
        const data = await res.json();
        itemCache = data.data as DDragonItemMap;
        console.log(`[DataDragon] Loaded ${Object.keys(itemCache).length} items`);
    } catch (e) {
        console.warn('[DataDragon] Failed to fetch items — using built-in fallback');
        itemCache = FALLBACK_ITEMS;
    }
}

/** Download and cache champion.json */
async function fetchChampions(version: string): Promise<void> {
    try {
        const res = await fetch(`${DDRAGON_BASE}/cdn/${version}/data/en_US/champion.json`);
        const data = await res.json();
        championCache = data.data as Record<string, DDragonChampion>;
        console.log(`[DataDragon] Loaded ${Object.keys(championCache).length} champions`);
    } catch (e) {
        console.warn('[DataDragon] Failed to fetch champions');
    }
}

/** Initialize Data Dragon (call once on app start) */
export async function initDataDragon(): Promise<void> {
    if (isInitialized) return;
    const version = await fetchLatestVersion();
    await Promise.all([fetchItems(version), fetchChampions(version)]);
    isInitialized = true;
}

/** Get the total gold cost of an item by ID */
export function getItemGoldCost(itemId: number | string): number {
    const item = itemCache[String(itemId)];
    if (!item) return FALLBACK_PRICES[String(itemId)] || 0;
    return item.gold.total;
}

/** Get full item data */
export function getItem(itemId: number | string): DDragonItem | undefined {
    return itemCache[String(itemId)];
}

/** Get item icon URL */
export function getItemIconUrl(itemId: number | string): string {
    const item = itemCache[String(itemId)];
    const version = currentVersion || '14.24.1';
    if (item) {
        return `${DDRAGON_BASE}/cdn/${version}/img/item/${item.image.full}`;
    }
    return `${DDRAGON_BASE}/cdn/${version}/img/item/${itemId}.png`;
}

/** Get champion icon URL */
export function getChampionIconUrl(championName: string): string {
    const version = currentVersion || '14.24.1';
    return `${DDRAGON_BASE}/cdn/${version}/img/champion/${championName}.png`;
}

/** Get champion tags (roles) */
export function getChampionRole(championName: string): string[] {
    const champ = championCache[championName];
    return champ ? champ.tags : [];
}

/** Check if an item has specific tags */
export function itemHasTag(itemId: number | string, tag: string): boolean {
    const item = itemCache[String(itemId)];
    return item ? item.tags.includes(tag) : false;
}

/** Get item stats */
export function getItemStats(itemId: number | string): Record<string, number> {
    const item = itemCache[String(itemId)];
    return item ? item.stats : {};
}

/** Get the current DDragon version */
export function getVersion(): string {
    return currentVersion || '14.24.1';
}

// ─── Fallback Data ──────────────────────────────────────────────────────────

const FALLBACK_PRICES: Record<string, number> = {
    '1001': 300, '1028': 400, '1036': 350, '1054': 450, '1055': 350, '1056': 400,
    '3006': 1100, '3011': 2300, '3020': 1100, '3026': 3000, '3031': 3400,
    '3036': 3000, '3047': 1100, '3053': 3100, '3065': 2900, '3071': 3100,
    '3072': 3400, '3075': 2700, '3084': 3200, '3089': 3600, '3094': 2600,
    '3107': 2300, '3109': 2300, '3111': 1100, '3116': 2600, '3135': 2800,
    '3143': 2700, '3157': 3000, '3158': 950, '3190': 2500, '3504': 2300,
    '3742': 2900, '3812': 3100, '3850': 400, '3851': 400, '3858': 400,
    '3859': 400, '4005': 2500, '6631': 3300, '6653': 3200, '6662': 2800,
};

const FALLBACK_ITEMS: DDragonItemMap = {};
