import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Champion } from "../types/draft";
import type { MlRecommendation, MlResponse, MlRole, MlSuggestPayload } from "../types/ml";
import { NONE_CHAMPION } from "../constants/draft";
import { BanSlot } from "./BanSlot";
import { PickSlot } from "./PickSlot";
import { ChampionCard } from "./ChampionCard";
import { NoActiveDraft } from "./NoActiveDraft";

const ALL_ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const UI_ROLES: MlRole[] = ["ALL", "TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

interface LiveChampSelectProps {
  onBack: () => void;
  onHome: () => void;
}

interface CurrentAction {
  type: "ban" | "pick" | null;
  isMyTurn: boolean;
  timeLeft: number;
  phase: string;
}

export function LiveChampSelect({ onBack, onHome }: LiveChampSelectProps) {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [stagedChampion, setStagedChampion] = useState<Champion | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const [mlReady, setMlReady] = useState(false);
  const [mlMyPickSuggest, setMlMyPickSuggest] = useState<MlSuggestPayload | null>(null);
  const [mlBanSuggest, setMlBanSuggest] = useState<MlSuggestPayload | null>(null);
  const [mlError, setMlError] = useState<string | null>(null);
  const [mlSyncTick, setMlSyncTick] = useState(0);
  const [selectedRole, setSelectedRole] = useState<MlRole>("ALL");

  const sentActionKeysRef = useRef<Set<string>>(new Set());

  const championsMap = useMemo(() => {
    const map = new Map<number, Champion>();
    champions.forEach((c) => map.set(c.numeric_id, c));
    return map;
  }, [champions]);

  const championById = useMemo(() => {
    const map = new Map<string, Champion>();
    champions.forEach((c) => map.set(c.id, c));
    return map;
  }, [champions]);

  const championByName = useMemo(() => {
    const map = new Map<string, Champion>();
    champions.forEach((c) => map.set(c.name, c));
    return map;
  }, [champions]);

  const resolveChampion = useCallback(
    (mlChampionKey: string): Champion | undefined => {
      // ML uses DDragon champion ids (e.g. "MonkeyKing") but can sometimes return display names.
      return championById.get(mlChampionKey) ?? championByName.get(mlChampionKey);
    },
    [championById, championByName]
  );

  const bansFromActions = useMemo(() => {
    if (!session) return { myTeamBans: [], theirTeamBans: [], cellIdToBan: new Map<number, number>() };

    const myTeam = session.myTeam || [];
    const actions = session.actions || [];

    const myTeamBans: number[] = [];
    const theirTeamBans: number[] = [];
    const cellIdToBan = new Map<number, number>();

    //cell IDs from my team
    const myTeamCellIds = new Set(myTeam.map((p: any) => p.cellId));

    //extract bans from actions
    for (const group of actions) {
      if (Array.isArray(group)) {
        for (const action of group) {
          if (action.type === "ban" && action.championId > 0) {
            // Track the latest ban action for each cellId (hovered or completed)
            cellIdToBan.set(action.actorCellId, action.championId);

            if (action.completed) {
              if (myTeamCellIds.has(action.actorCellId)) {
                myTeamBans.push(action.championId);
              } else {
                theirTeamBans.push(action.championId);
              }
            }
          }
        }
      }
    }

    return { myTeamBans, theirTeamBans, cellIdToBan };
  }, [session]);

  const currentAction = useMemo((): CurrentAction => {
    if (!session) return { type: null, isMyTurn: false, timeLeft: 0, phase: "WAITING" };

    const localCellId = session.localPlayerCellId;
    const actions = session.actions || [];
    const timer = session.timer || {};

    let myCurrentAction = null;
    for (const group of actions) {
      if (!Array.isArray(group)) continue;
      for (const action of group) {
        if (action.actorCellId === localCellId && action.isInProgress && !action.completed) {
          myCurrentAction = action;
          break;
        }
      }
      if (myCurrentAction) break;
    }

    //time left - account for time elapsed since session was fetched
    let timeLeft = 0;
    if (timer.adjustedTimeLeftInPhase !== undefined && timer.internalNowInEpochMs !== undefined) {
      const elapsedSinceSnapshot = currentTime - timer.internalNowInEpochMs;
      const remainingMs = timer.adjustedTimeLeftInPhase - elapsedSinceSnapshot;
      timeLeft = Math.max(0, Math.ceil(remainingMs / 1000)) - 1;
      if (timeLeft < 0) timeLeft = 0;
    }

    const phase = timer.phase || "WAITING";
    const isPlanning = phase === "PLANNING" || phase === "FINALIZATION";

    if (myCurrentAction) {
      return {
        type: myCurrentAction.type,
        isMyTurn: true,
        timeLeft,
        phase
      };
    }

    //check if any action is in progress (not our turn)
    let someoneElseTurn = false;
    let actionType: "ban" | "pick" | null = null;

    for (const group of actions) {
      if (!Array.isArray(group)) continue;
      for (const action of group) {
        if (action.isInProgress && !action.completed) {
          someoneElseTurn = true;
          actionType = action.type;
          break;
        }
      }
      if (someoneElseTurn) break;
    }

    return {
      type: isPlanning ? null : actionType,
      isMyTurn: false,
      timeLeft,
      phase
    };
  }, [session, currentTime]);

  const unavailableChampionIds = useMemo(() => {
    if (!session) return new Set<number>();

    const unavailable = new Set<number>();

    // Add all bans
    bansFromActions.myTeamBans.forEach(id => unavailable.add(id));
    bansFromActions.theirTeamBans.forEach(id => unavailable.add(id));

    // Add all locked-in picks
    const myTeam = session.myTeam || [];
    const theirTeam = session.theirTeam || [];

    [...myTeam, ...theirTeam].forEach((player: any) => {
      if (player.championId > 0) {
        unavailable.add(player.championId);
      }
    });

    return unavailable;
  }, [session, bansFromActions]);

  const lockedChampionNames = useMemo(() => {
    if (!session) return new Set<string>();

    const names = new Set<string>();
    const addChampionId = (id: number) => {
      if (!id || id <= 0) return;
      const champ = championsMap.get(id);
      if (champ && champ.name !== "none") names.add(champ.name);
    };

    for (const id of bansFromActions.myTeamBans) addChampionId(id);
    for (const id of bansFromActions.theirTeamBans) addChampionId(id);

    const myTeam = session.myTeam || [];
    const theirTeam = session.theirTeam || [];
    [...myTeam, ...theirTeam].forEach((player: any) => {
      if (player?.championId > 0) addChampionId(player.championId);
    });

    return names;
  }, [session, bansFromActions, championsMap]);

  const filteredChampions = useMemo(() => {
    const filtered = [...champions]
      .filter((champ) =>
        champ.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!searchTerm || "none".includes(searchTerm.toLowerCase())) {
      return [NONE_CHAMPION, ...filtered];
    }
    return filtered;
  }, [champions, searchTerm]);

  useEffect(() => {
    invoke<Champion[]>("get_all_champions")
        .then(setChampions)
        .catch((err) => console.error("Failed to fetch champions:", err));
  }, []);

  // Initialize ML for live (client) draft recommendations.
  useEffect(() => {
    const config = {
      team1: "Client",
      team2: "Enemy",
      isTeam1Blue: true,
      mode: "Normal",
      numGames: 1,
    };

    invoke("ml_init", { config })
      .then(() => {
        setMlReady(true);
        setMlError(null);
        sentActionKeysRef.current = new Set();
        setMlSyncTick((t) => t + 1);
      })
      .catch((err) => {
        console.error("Failed to init ML:", err);
        setMlReady(false);
        setMlError("Failed to init ML process");
      });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 100);

    return () => clearInterval(interval);
  }, []);

  //session polling interval
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await invoke("get_champ_select_session");
        setSession(data);
        setError(null);
      } catch (err) {
        setError("Not in champion select or LCU disconnected");
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const myTeam = session?.myTeam || [];
  const theirTeam = session?.theirTeam || [];

  const getChamp = (id: number) => championsMap.get(id) || null;

  const canShowRecommendations =
    currentAction.isMyTurn &&
    (currentAction.type === "pick" || currentAction.type === "ban") &&
    currentAction.phase !== "PLANNING" &&
    currentAction.phase !== "FINALIZATION";

  const suggestContext = useMemo(() => {
    const isBanMode = currentAction.type === "ban";
    const mySide: "BLUE" | "RED" = "BLUE";
    const analyzeSide: "BLUE" | "RED" = isBanMode ? "RED" : "BLUE";
    const label = isBanMode ? "Ban Suggestions" : "Pick Suggestions";
    return { isBanMode, mySide, analyzeSide, label };
  }, [currentAction.type]);

  const refreshRecommendations = useCallback(async () => {
    try {
      setMlError(null);

      if (currentAction.type === "ban") {
        const res = (await invoke("ml_suggest", {
          targetSide: "RED",
          isBanMode: true,
          roles: ALL_ROLES,
        })) as MlResponse;

        if (!res.ok) {
          setMlError(res.error ?? "ML error");
          return;
        }

        setMlBanSuggest(res.payload as MlSuggestPayload);
      } else {
        const res = (await invoke("ml_suggest", {
          targetSide: "BLUE",
          isBanMode: false,
          roles: ALL_ROLES,
        })) as MlResponse;

        if (!res.ok) {
          setMlError(res.error ?? "ML error");
          return;
        }

        setMlMyPickSuggest(res.payload as MlSuggestPayload);
      }
    } catch (e: any) {
      setMlError(e?.toString?.() ?? "Failed to fetch ML suggestions");
    }
  }, [currentAction.type]);

  // Sync completed actions (picks/bans) from the live match into ML.
  useEffect(() => {
    if (!mlReady) return;
    if (!session) return;
    if (championsMap.size === 0) return;

    const actions = session.actions || [];
    const myTeamCellIds = new Set<number>((session.myTeam || []).map((p: any) => p.cellId));

    const completed: any[] = [];
    for (const group of actions) {
      if (!Array.isArray(group)) continue;
      for (const action of group) {
        if (!action || !action.completed) continue;
        if (action.championId == null || action.championId <= 0) continue;
        if (action.type !== "pick" && action.type !== "ban") continue;
        completed.push(action);
      }
    }

    completed.sort((a, b) => {
      const ai = typeof a.id === "number" ? a.id : 0;
      const bi = typeof b.id === "number" ? b.id : 0;
      return ai - bi;
    });

    let cancelled = false;
    (async () => {
      let sentAny = false;

      for (const action of completed) {
        if (cancelled) return;

        const key = action.id != null ? String(action.id) : `${action.type}:${action.actorCellId}:${action.championId}`;
        if (sentActionKeysRef.current.has(key)) continue;

        const champ = championsMap.get(action.championId);
        const championKey = champ?.id;
        if (!championKey || championKey === "none") {
          sentActionKeysRef.current.add(key);
          continue;
        }

        try {
          if (action.type === "ban") {
            await invoke("ml_ban", { champion: championKey });
          } else {
            const side = myTeamCellIds.has(action.actorCellId) ? "blue" : "red";
            await invoke("ml_pick", { side, champion: championKey });
          }
          sentActionKeysRef.current.add(key);
          sentAny = true;
        } catch (err) {
          console.error("Failed to sync ML action:", err);
          setMlError("Failed to send draft actions to ML");
          return;
        }
      }

      if (sentAny) {
        setMlSyncTick((t) => t + 1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mlReady, session, championsMap]);

  // Only fetch/display recs when it's your pick turn.
  useEffect(() => {
    if (!canShowRecommendations) return;
    refreshRecommendations();
  }, [canShowRecommendations, mlSyncTick, refreshRecommendations]);

  const activeMlSuggest = useMemo(() => {
    if (currentAction.type === "ban") return mlBanSuggest;
    if (currentAction.type === "pick") return mlMyPickSuggest;
    return null;
  }, [currentAction.type, mlBanSuggest, mlMyPickSuggest]);

  const visibleRecommendations = useMemo(() => {
    if (!activeMlSuggest) return [];
    const recommendationsMap = (activeMlSuggest.recommendations ?? {}) as Record<string, MlRecommendation[]>;

    let recs: MlRecommendation[] = [];
    if (selectedRole === "ALL") {
      const allRecs = Object.values(recommendationsMap).flat();
      const uniqueRecs = new Map<string, MlRecommendation>();
      allRecs
        .slice()
        .sort((a, b) => b.score - a.score)
        .forEach((r) => {
          if (!uniqueRecs.has(r.champion)) uniqueRecs.set(r.champion, r);
        });
      recs = Array.from(uniqueRecs.values()).sort((a, b) => b.score - a.score);
    } else {
      recs = recommendationsMap[selectedRole] ?? [];
    }

    return recs
      .map((rec) => ({ rec, champ: resolveChampion(rec.champion) }))
      .filter(({ champ }) => {
        if (!champ) return true;
        if (champ.name === "none") return false;
        if (lockedChampionNames.has(champ.name)) return false;
        return !unavailableChampionIds.has(champ.numeric_id);
      });
  }, [activeMlSuggest, lockedChampionNames, resolveChampion, selectedRole, unavailableChampionIds]);

  const handleSelectChampion = async (champion: Champion) => {
    if (champion.name !== "none" && unavailableChampionIds.has(champion.numeric_id)) {
      return;
    }

    setStagedChampion(champion);

    try {
      if (currentAction.type === "pick" || currentAction.phase === "PLANNING" || currentAction.phase === "FINALIZATION") {
        await invoke("hover_champion", { championId: champion.numeric_id });
      } else if (currentAction.type === "ban") {
        await invoke("hover_ban", { championId: champion.numeric_id });
      }
    } catch (err) {
      console.error("Failed to hover:", err);
    }
  };

  const handleConfirm = async () => {
    if (!currentAction.isMyTurn || !stagedChampion) return;

    if (stagedChampion.name === "none") return;

    try {
      if (currentAction.type === "pick") {
        await invoke("lock_champion");
      } else if (currentAction.type === "ban") {
        await invoke("lock_ban");
      }
      setStagedChampion(null);
    } catch (err) {
      console.error("Failed to lock:", err);
    }
  };

  const getPhaseText = () => {
    const phase = currentAction.phase;

    if (phase === "PLANNING") {
      return "Prepare your champion";
    }

    if (phase === "FINALIZATION") {
      return "Game Starting Soon";
    }

    if (!currentAction.isMyTurn) {
      if (currentAction.type === "ban") return <span className="text-[#e74c3c]">Enemy Banning</span>;
      if (currentAction.type === "pick") return <span className="text-[#3498db]">Enemy Picking</span>;
      return "Waiting...";
    }

    if (currentAction.type === "ban") return <span className="text-[#e74c3c]">Ban a Champion</span>;
    if (currentAction.type === "pick") return <span className="text-[#3498db]">Pick a Champion</span>;
    return "Waiting...";
  };

  const getConfirmButtonText = () => {
    if (currentAction.type === "ban") return <span className="text-white">Ban</span>;
    if (currentAction.type === "pick") return <span className="text-white">Lock In</span>;
    return "Confirm";
  };

  const getConfirmButtonColor = () => {
    //if no champion or "none" is selected
    if (!stagedChampion || stagedChampion.name === "none") {
      return "bg-[#222] text-[#444] cursor-not-allowed border border-[#333]";
    }

    if (currentAction.type === "ban") {
      return "bg-[#c0392b] hover:bg-[#a93226] shadow-[0_0_20px_rgba(192,57,43,0.3)]";
    }
    return "bg-[#27ae60] hover:bg-[#229954] shadow-[0_0_20px_rgba(39,174,96,0.3)]";
  };

  // Keep these returns AFTER all hooks to preserve hook order.
  if (!session && !error) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[#121212] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#3498db] border-t-transparent rounded-full animate-spin" />
          <p className="text-xl font-bold uppercase tracking-widest text-[#3498db]">Loading Session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <NoActiveDraft onHome={onHome} />;
  }

  return (
      <div className="flex flex-col h-full w-full p-5 bg-[#121212] text-white font-sans box-border relative overflow-hidden">
        <div className="flex justify-between items-start mb-8">
          <div className="flex flex-col gap-2">
            <div className="text-lg font-bold uppercase tracking-widest text-[#3498db]">
              Blue Side <span className="text-[#e74c3c]">bans</span>
            </div>
            <div className="flex gap-1.5">
              {bansFromActions.myTeamBans.map((id: number, i: number) => (
                  <BanSlot key={i} ban={getChamp(id)} />
              ))}
              {Array.from({ length: 5 - bansFromActions.myTeamBans.length }).map((_, i) => (
                  <BanSlot key={`empty-my-${i}`} ban={null} />
              ))}
            </div>
            <button
                onClick={onBack}
                className="mt-2 flex items-center justify-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-[10px] font-bold uppercase tracking-widest text-[#666] hover:text-white hover:border-[#444] transition-all group w-fit"
            >
              Back
            </button>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="text-3xl font-black text-[#3498db]">LIVE SESSION</div>
            <div className="text-xs text-[#666] uppercase tracking-widest font-bold">
              {session.isCustomGame ? "Custom Game" : "Ranked Game"}
            </div>

            {/* Timer and Phase Display */}
            <div className="flex flex-col items-center gap-2 bg-[#1a1a1a] border-2 border-[#333] rounded-xl px-8 py-4 min-w-[280px]">
              <div className={`text-sm font-bold uppercase tracking-widest ${
                  currentAction.isMyTurn ? "text-[#3498db]" : "text-[#666]"
              }`}>
                {getPhaseText()}
              </div>
              <div className={`text-5xl font-black tabular-nums ${
                  currentAction.timeLeft <= 10
                      ? "text-[#e74c3c] animate-pulse"
                      : currentAction.isMyTurn
                          ? "text-white"
                          : "text-[#444]"
              }`}>
                {currentAction.timeLeft}
              </div>
              {currentAction.isMyTurn && (
                  <div className="h-1 w-full bg-[#333] rounded-full overflow-hidden mt-2">
                    <div
                        className="h-full bg-[#3498db] rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${(currentAction.timeLeft / 30) * 100}%` }}
                    />
                  </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-lg font-bold uppercase tracking-widest text-right text-[#e74c3c]">
              Red Side <span className="text-[#e74c3c]">bans</span>
            </div>
            <div className="flex gap-1.5">
              {bansFromActions.theirTeamBans.map((id: number, i: number) => (
                  <BanSlot key={i} ban={getChamp(id)} />
              ))}
              {Array.from({ length: 5 - bansFromActions.theirTeamBans.length }).map((_, i) => (
                  <BanSlot key={`empty-their-${i}`} ban={null} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-1 justify-between gap-8 min-h-0">
          <div className="flex flex-col gap-5 w-[220px]">
            {myTeam.map((player: any, i: number) => {
              const isCurrentPlayer = player.cellId === session.localPlayerCellId;
              const banId = bansFromActions.cellIdToBan.get(player.cellId);
              return (
                  <PickSlot
                      key={i}
                      pick={getChamp(player.championId || player.championPickIntent)}
                      ban={banId ? getChamp(banId) : null}
                      index={i}
                      team="blue"
                      playerName={isCurrentPlayer ? "YOU" : (player.gameName || `Player ${i + 1}`)}
                  />
              );
            })}
          </div>

          <div className="flex-1 flex flex-col gap-5 min-w-0">
            <div className="flex flex-col items-end gap-3">
              <input
                  type="text"
                  placeholder="Search champion..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-[200px] h-[40px] border border-[#444] bg-[#252525] px-4 text-sm focus:outline-none focus:border-[#3498db] transition-colors rounded-lg uppercase font-bold tracking-widest`}
              />
            </div>
            <div className={`flex-[3] border-2 border-[#333] bg-[#1a1a1a] overflow-y-auto p-4 relative no-scrollbar rounded-lg shadow-inner `}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-4">
                {filteredChampions.map((champ) => (
                    <ChampionCard
                        key={champ.id}
                        champion={champ}
                        isSelected={champ.name !== "none" && unavailableChampionIds.has(champ.numeric_id)}
                        isStaged={stagedChampion?.id === champ.id}
                        onSelect={(c) => handleSelectChampion(c)}
                    />
                ))}
              </div>
            </div>
            <button
                onClick={handleConfirm}
                disabled={!stagedChampion || stagedChampion.name === "none" || !currentAction.isMyTurn || currentAction.phase === "PLANNING" || currentAction.phase === "FINALIZATION"}
                className={`w-full py-3 rounded-lg font-black uppercase tracking-[0.2em] transition-all transform active:scale-95 ${
                    stagedChampion && stagedChampion.name !== "none" && currentAction.isMyTurn && currentAction.phase !== "PLANNING" && currentAction.phase !== "FINALIZATION"
                        ? getConfirmButtonColor()
                        : "bg-[#222] text-[#444] cursor-not-allowed border border-[#333]"
                }`}
            >
              {currentAction.phase === "PLANNING" || currentAction.phase === "FINALIZATION" ? "Awaiting Phase" : getConfirmButtonText()}
            </button>

            {canShowRecommendations && (
              <div className="mt-4 border-2 border-[#333] bg-[#1a1a1a] rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[#666] font-black uppercase tracking-[0.25em] text-xs">
                    {suggestContext.label} ({suggestContext.mySide}{suggestContext.isBanMode ? ` vs ${suggestContext.analyzeSide}` : ""})
                  </div>
                  <button
                    onClick={() => refreshRecommendations()}
                    className="px-3 py-1 bg-[#252525] border border-[#333] rounded-md text-[10px] font-bold uppercase tracking-widest text-[#bbb] hover:text-white hover:border-[#444] transition-all"
                  >
                    Refresh
                  </button>
                </div>

                {activeMlSuggest && (
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#444]">
                    ML: {activeMlSuggest.target_side} {activeMlSuggest.is_ban_mode ? "BAN" : "PICK"}
                  </div>
                )}

                {activeMlSuggest && typeof activeMlSuggest.blue_winrate === "number" && typeof activeMlSuggest.red_winrate === "number" && (
                  <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#555]">
                    Winrate: <span className="text-[#3498db]">BLUE</span> {(activeMlSuggest.blue_winrate * 100).toFixed(1)}% |{" "}
                    <span className="text-[#e74c3c]">RED</span> {(activeMlSuggest.red_winrate * 100).toFixed(1)}%
                  </div>
                )}

                <div className="mt-3 flex gap-2 flex-wrap">
                  {UI_ROLES.map((role) => (
                    <button
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      className={`px-3 py-2 rounded-md border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                        selectedRole === role
                          ? "bg-[#3498db] border-[#3498db] text-white"
                          : "bg-[#252525] border-[#333] text-[#999] hover:text-white hover:border-[#444]"
                      }`}
                      title={role}
                      type="button"
                    >
                      {role === "MIDDLE"
                        ? "MID"
                        : role === "BOTTOM"
                        ? "ADC"
                        : role === "UTILITY"
                        ? "SUPPORT"
                        : role === "ALL"
                        ? "TODOS"
                        : role}
                    </button>
                  ))}
                </div>

                {mlError && (
                  <div className="mt-2 text-[#e74c3c] text-xs font-bold uppercase tracking-widest">
                    {mlError}
                  </div>
                )}

                <div className="mt-3 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                  {activeMlSuggest ? (
                    <div className="flex flex-col gap-2">
                      {visibleRecommendations.map(({ rec, champ }) => (
                        <div
                          key={`${selectedRole}-${rec.champion}`}
                          className="flex items-center gap-3 border border-[#333] bg-[#141414] rounded-lg p-3 hover:border-[#3498db] transition-colors cursor-pointer"
                          onClick={() => {
                            if (!champ) return;
                            setStagedChampion((prev) => (prev?.name === champ.name ? null : champ));
                            if (stagedChampion?.name !== champ.name) {
                              handleSelectChampion(champ);
                            }
                          }}
                        >
                          {champ ? (
                            <img src={champ.icon} alt={champ.name} className="w-10 h-10 border border-[#333]" />
                          ) : (
                            <div className="w-10 h-10 border border-[#333] bg-[#222]" />
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <div className="truncate font-black uppercase tracking-wide text-sm">
                                {champ ? champ.name : rec.champion}
                              </div>
                              <div className="text-[10px] font-black uppercase tracking-widest text-[#3498db]">
                                {(rec.score * 100).toFixed(1)}%
                              </div>
                            </div>
                            {rec.tactical && <div className="text-[10px] text-[#aaa] mt-1 leading-snug">{rec.tactical}</div>}
                          </div>
                        </div>
                      ))}

                      {visibleRecommendations.length === 0 && (
                        <div className="text-[#444] text-xs font-bold uppercase tracking-widest">No recommendations</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[#444] text-xs font-bold uppercase tracking-widest">Waiting for ML...</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5 w-[220px]">
            {theirTeam.map((player: any, i: number) => {
              const banId = bansFromActions.cellIdToBan.get(player.cellId);
              return (
                  <PickSlot
                      key={i}
                      pick={getChamp(player.championId || player.championPickIntent)}
                      ban={banId ? getChamp(banId) : null}
                      index={i}
                      team="red"
                      playerName={`Enemy ${i + 1}`}
                  />
              );
            })}
          </div>
        </div>
      </div>
  );
}