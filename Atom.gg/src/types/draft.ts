export interface Champion {
  name: string;
  id: string;
  icon: string;
  splash: string;
}

export interface DraftTurn {
  team: "blue" | "red";
  type: "ban" | "pick";
  index: number;
}

export type GameMode = "Normal" | "Fearless" | "Ironman";

export interface DraftConfig {
  team1: string;
  team2: string;
  mode: GameMode;
  numGames: number;
}
