export interface ChampionData {
    name: string;
    id: string;
    key: string;
}

export interface DDragonResponse {
    data: Record<string, ChampionData>;
}