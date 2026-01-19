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
