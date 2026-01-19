import { Champion, DraftTurn } from "../types/draft";

export const DRAFT_SEQUENCE: DraftTurn[] = [
  // Phase 1: 3 bans each
  { team: "blue", type: "ban", index: 0 },
  { team: "red", type: "ban", index: 0 },
  { team: "blue", type: "ban", index: 1 },
  { team: "red", type: "ban", index: 1 },
  { team: "blue", type: "ban", index: 2 },
  { team: "red", type: "ban", index: 2 },
  // Phase 2: 3 picks each
  { team: "blue", type: "pick", index: 0 },
  { team: "red", type: "pick", index: 0 },
  { team: "red", type: "pick", index: 1 },
  { team: "blue", type: "pick", index: 1 },
  { team: "blue", type: "pick", index: 2 },
  { team: "red", type: "pick", index: 2 },
  // Phase 3: 2 bans each
  { team: "red", type: "ban", index: 3 },
  { team: "blue", type: "ban", index: 3 },
  { team: "red", type: "ban", index: 4 },
  { team: "blue", type: "ban", index: 4 },
  // Phase 4: 2 picks each
  { team: "red", type: "pick", index: 3 },
  { team: "blue", type: "pick", index: 3 },
  { team: "blue", type: "pick", index: 4 },
  { team: "red", type: "pick", index: 4 },
];

export const NONE_CHAMPION: Champion = {
  name: "none",
  id: "none",
  icon: "/none.png",
  splash: "/none.png",
};
