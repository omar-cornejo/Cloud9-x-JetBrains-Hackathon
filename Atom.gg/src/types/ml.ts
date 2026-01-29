export type MlRole = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | "ALL";

export interface MlRecommendation {
  champion: string;
  score: number;
  tags?: string;
  threat?: string;
  tactical?: string;
}

export interface MlSuggestPayload {
  target_side: "BLUE" | "RED";
  is_ban_mode: boolean;
  open_roles: MlRole[];
  inferred_open_roles?: MlRole[];
  recommendations: Record<MlRole, MlRecommendation[]>;
  blue_winrate?: number;
  red_winrate?: number;
  blocked_count: number;
  mode: string;
  game: number;
  total_games: number;
  teams?: any;
}

export interface MlResponse {
  request_id: number | string | null;
  ok: boolean;
  type: string;
  payload?: any;
  error?: string;
}
