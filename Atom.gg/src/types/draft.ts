export interface Champion {
  name: string;
  id: string;
  numeric_id: number;
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
  isTeam1Blue: boolean;
  mode: GameMode;
  numGames: number;
}

export interface TeamPlayers {
  team: string;
  top: string;
  jungle: string;
  mid: string;
  adc: string;
  utility: string;
}
