/**
 * Data Dragon Fallback Service
 *
 * Provides fallback to local assets when the Tauri backend fails to fetch champion data.
 */
import { invoke } from "@tauri-apps/api/core";
import { Champion } from "../types/draft.ts";
import { DDragonResponse } from "../types/ddragon.ts";

const DDRAGON_VERSION = "16.2.1";
const FALLBACK_BASE_PATH = "/dragontail-16.2.1";

const ROLE_MAP: Record<string, string> = {
    TOP: "top",
    JUNGLE: "jungle",
    MIDDLE: "middle",
    BOTTOM: "bottom",
    UTILITY: "utility",
    ALL: "fill",
} as const;

let positionIconFallback = false;
let championAssetFallback = false;

/**
 * Cache for champion data to avoid repeated requests
 */
let championCache: Champion[] | null = null;

/**
 * Fetch all champions with automatic fallback to local assets
 */
export async function getAllChampions(): Promise<Champion[]> {
    if (championCache) {
        return championCache;
    }

    try {
        const result = await invoke<Champion[]>("get_all_champions");
        // Update URLs if we detected that we need fallback for assets, 
        // even if the backend managed to get the JSON.
        if (championAssetFallback) {
            result.forEach(c => {
                c.icon = getChampionIcon(c.id);
                c.splash = getChampionSplash(c.id);
            });
        }
        championCache = result;
        return result;
    } catch (error) {
        console.warn("Backend fetch failed, using local fallback:", error);
        return await loadLocalChampions();
    }
}

/**
 * Load champion data from bundled local assets
 */
async function loadLocalChampions(): Promise<Champion[]> {
    const localUrl = `${FALLBACK_BASE_PATH}/${DDRAGON_VERSION}/data/en_US/champion.json`;

    try {
        const response = await fetch(localUrl);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to load ${localUrl}`);
        }

        const data: DDragonResponse = await response.json();
        const champions = transformChampionData(data);

        championCache = champions;
        return champions;
    } catch (error) {
        console.error("Failed to load local champion data:", error);
        throw new Error("Unable to load champion data from both backend and local sources");
    }
}

/**
 * Transform DDragon response into Champion array with local asset paths
 */
function transformChampionData(data: DDragonResponse): Champion[] {
    return Object.values(data.data).map((champ) => ({
        name: champ.name,
        id: champ.id,
        numeric_id: parseInt(champ.key, 10) || 0,
        icon: getChampionIcon(champ.id),
        splash: getChampionSplash(champ.id),
    }));
}

/**
 * Retrieves the icon role from community dragon
 * @param role Position of the icon to be retrieved
 */
export function getRoleIcon(role: string): string {
    const lane =
        role === "TOP" ? "top" :
            role === "JUNGLE" ? "jungle" :
                role === "MIDDLE" ? "middle" :
                    role === "BOTTOM" ? "bottom" :
                        role === "UTILITY" ? "utility" :
                            "fill";

    return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${lane}.png`;
}

/**
 * Retrieves the icon role from local assets
 * @param role Position of the icon to be retrieved
 */
export function getFallbackRoleIcon(role: string): string {
    const lane = ROLE_MAP[role] || "fill";
    return `/positions/${lane}.png`;
}

export function getRoleIconSync(role: string): string {
    if (positionIconFallback || !navigator.onLine) {
        return getFallbackRoleIcon(role);
    }

    return getRoleIcon(role);
}

/**
 * Returns champion icon with automatic fallback
 */
export function getChampionIcon(id: string): string {
    if (championAssetFallback) {
        return `${FALLBACK_BASE_PATH}/${DDRAGON_VERSION}/img/champion/${id}.png`;
    }
    return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${id}.png`;
}

/**
 * Returns champion splash with automatic fallback
 */
export function getChampionSplash(id: string): string {
    if (championAssetFallback) {
        return `${FALLBACK_BASE_PATH}/img/champion/splash/${id}_0.jpg`;
    }
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg`;
}

export async function initializeIconSource(): Promise<void> {
    const checkConnectivity = async (url: string): Promise<boolean> => {
        if (!navigator.onLine) return false;
        try {
            await fetch(url, {
                method: 'HEAD', 
                mode: 'no-cors',
                cache: 'no-store' 
            });
            return true;
        } catch (error) {
            return false;
        }
    };

    const positionUrl = getRoleIcon("TOP");
    const championUrl = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/Aatrox.png`;

    const [canReachPositions, canReachChampions] = await Promise.all([
        checkConnectivity(positionUrl),
        checkConnectivity(championUrl)
    ]);

    positionIconFallback = !canReachPositions;
    championAssetFallback = !canReachChampions;

    if (positionIconFallback) {
        console.log("Fallback activated for position icons (Local assets)");
    }
    if (championAssetFallback) {
        console.log("Fallback activated for champion assets (Local assets)");
    }
}

