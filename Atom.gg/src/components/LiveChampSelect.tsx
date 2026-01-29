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
  team: "blue" | "red" | null;
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

  const blinkDuration = useMemo(() => {
    if (currentAction.timeLeft > 20) return "2.0s";
    if (currentAction.timeLeft > 10) return "1.2s";
    if (currentAction.timeLeft > 5) return "0.8s";
    return "0.6s";
  }, [currentAction.timeLeft]);

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
    if (!session) return { type: null, isMyTurn: false, timeLeft: 0, phase: "WAITING", team: null };

    const localCellId = session.localPlayerCellId;
    const actions = session.actions || [];
    const timer = session.timer || {};
    const myTeam = session.myTeam || [];
    const myTeamCellIds = new Set(myTeam.map((p: any) => p.cellId));

    let activeAction = null;
    let isMyTurn = false;

    for (const group of actions) {
      if (!Array.isArray(group)) continue;
      for (const action of group) {
        if (action.isInProgress && !action.completed) {
          activeAction = action;
          if (action.actorCellId === localCellId) {
            isMyTurn = true;
          }
          break;
        }
      }
      if (activeAction) break;
    }

    //time left
    let timeLeft = 0;
    if (timer.adjustedTimeLeftInPhase !== undefined && timer.internalNowInEpochMs !== undefined) {
      const elapsedSinceSnapshot = currentTime - timer.internalNowInEpochMs;
      const remainingMs = timer.adjustedTimeLeftInPhase - elapsedSinceSnapshot;
      timeLeft = Math.max(0, Math.ceil(remainingMs / 1000)) - 1;
      if (timeLeft < 0) timeLeft = 0;
    }

    const phase = timer.phase || "WAITING";
    const isPlanning = phase === "PLANNING" || phase === "FINALIZATION";

    if (activeAction) {
      return {
        type: isPlanning ? null : activeAction.type,
        isMyTurn,
        timeLeft,
        phase,
        team: myTeamCellIds.has(activeAction.actorCellId) ? "blue" : "red"
      };
    }

    return {
      type: null,
      isMyTurn: false,
      timeLeft,
      phase,
      team: null
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

  const teamHighlightColor = currentAction.team === "blue" ? "var(--accent-blue)" : currentAction.team === "red" ? "var(--accent-red)" : "var(--brand-primary)";
  const teamHighlightShadow = currentAction.team === "blue" ? "rgba(0, 209, 255, 0.25)" : currentAction.team === "red" ? "rgba(255, 75, 80, 0.25)" : "rgba(0, 255, 148, 0.25)";

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

  const [selectedRec, setSelectedRec] = useState<{ rec: MlRecommendation; champ: Champion | undefined } | null>(null);

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

    const filtered = recs
      .map((rec) => ({ rec, champ: resolveChampion(rec.champion) }))
      .filter(({ champ }) => {
        if (!champ) return true;
        if (champ.name === "none") return false;
        if (lockedChampionNames.has(champ.name)) return false;
        return !unavailableChampionIds.has(champ.numeric_id);
      });

    return filtered;
  }, [activeMlSuggest, lockedChampionNames, resolveChampion, selectedRole, unavailableChampionIds, selectedRec]);

  const isLowTime = currentAction.timeLeft <= 10;

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
      if (currentAction.type === "ban") return <span className="text-[var(--accent-red)]">Enemy Banning</span>;
      if (currentAction.type === "pick") return <span className="text-[var(--accent-blue)]">Enemy Picking</span>;
      return "Waiting...";
    }

    if (currentAction.type === "ban") return <span className="text-[var(--accent-red)]">Ban a Champion</span>;
    if (currentAction.type === "pick") return <span className="text-[var(--accent-blue)]">Pick a Champion</span>;
    return "Waiting...";
  };

  const getConfirmButtonText = () => {
    if (currentAction.type === "ban") return <span className="text-white">Ban</span>;
    if (currentAction.type === "pick") return <span className="text-white">Lock In</span>;
    return "Confirm";
  };

  const getConfirmButtonColor = () => {
    return "text-[var(--bg-color)] brightness-110";
  };

  // Keep these returns AFTER all hooks to preserve hook order.
  if (!session && !error) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[var(--bg-color)] text-[var(--text-primary)]">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-2xl font-black uppercase tracking-[0.2em] text-[var(--brand-primary)] animate-pulse">Syncing with LCU...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <NoActiveDraft onHome={onHome} />;
  }

  return (
      <div 
        className="flex flex-col h-full w-full p-4 bg-[var(--bg-color)] text-[var(--text-primary)] font-sans box-border relative overflow-hidden"
        style={{
          '--team-accent': teamHighlightColor,
          '--team-accent-shadow': teamHighlightShadow
        } as React.CSSProperties}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col gap-2">
            <div className="text-base font-black uppercase tracking-tighter text-[var(--accent-blue)]">
              Blue Side <span className="text-[var(--text-muted)] opacity-50">bans</span>
            </div>
            <div className="flex gap-1.5">
              {bansFromActions.myTeamBans.map((id: number, i: number) => (
                  <BanSlot
                    key={i}
                    ban={getChamp(id)}
                    team="blue"
                    isActive={currentAction.type === "ban" && currentAction.team === "blue" && i === bansFromActions.myTeamBans.length}
                    isLowTime={isLowTime && currentAction.type === "ban" && currentAction.team === "blue"}
                    animationDuration={blinkDuration}
                  />
              ))}
              {Array.from({ length: 5 - bansFromActions.myTeamBans.length }).map((_, i) => {
                  const absoluteIndex = bansFromActions.myTeamBans.length + i;
                  return (
                    <BanSlot
                      key={`empty-my-${i}`}
                      ban={null}
                      team="blue"
                      isActive={currentAction.type === "ban" && currentAction.team === "blue" && absoluteIndex === bansFromActions.myTeamBans.length}
                      isLowTime={isLowTime && currentAction.type === "ban" && currentAction.team === "blue"}
                      animationDuration={blinkDuration}
                    />
                  );
              })}
            </div>
            <button
                onClick={onBack}
                className="mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--surface-color)] border border-[var(--border-color)] rounded-lg text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-white hover:border-[var(--text-secondary)] transition-all group w-fit"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3 transform group-hover:-translate-x-1 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Exit
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="text-2xl font-black text-white tracking-tighter uppercase">Live <span className="text-[var(--brand-primary)]">Integration</span></div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.3em] font-black bg-[var(--surface-color)] px-3 py-0.5 rounded-full border border-[var(--border-color)]">
              {session.isCustomGame ? "Tournament" : "Matchmaking"}
            </div>

            {/* Timer and Phase Display */}
            <div className="flex flex-col items-center gap-1 bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl px-8 py-3 min-w-[240px] relative overflow-hidden">
              <div className={`text-[11px] font-black uppercase tracking-[0.15em] ${
                  currentAction.isMyTurn ? "text-[var(--brand-primary)]" : "text-[var(--text-muted)]"
              }`}>
                {getPhaseText()}
              </div>
              <div className={`text-5xl font-black tabular-nums tracking-tighter transition-all duration-300 ${
                  currentAction.timeLeft <= 10
                      ? "text-[var(--brand-primary)] animate-pulse"
                      : currentAction.isMyTurn
                          ? "text-white"
                          : "text-[var(--text-muted)] opacity-30"
              }`}>
                {currentAction.timeLeft}
              </div>
              {currentAction.isMyTurn && (
                  <div className="h-1 w-full bg-[var(--bg-color)] rounded-full overflow-hidden mt-2 border border-[var(--border-color)]">
                    <div
                        className="h-full bg-[var(--brand-primary)] rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${(currentAction.timeLeft / 30) * 100}%` }}
                    />
                  </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 items-end">
            <div className="text-base font-black uppercase tracking-tighter text-[var(--accent-red)]">
              Red Side <span className="text-[var(--text-muted)] opacity-50">bans</span>
            </div>
            <div className="flex gap-1.5">
              {bansFromActions.theirTeamBans.map((id: number, i: number) => (
                  <BanSlot
                    key={i}
                    ban={getChamp(id)}
                    team="red"
                    isActive={currentAction.type === "ban" && currentAction.team === "red" && i === bansFromActions.theirTeamBans.length}
                    isLowTime={isLowTime && currentAction.type === "ban" && currentAction.team === "red"}
                    animationDuration={blinkDuration}
                  />
              ))}
              {Array.from({ length: 5 - bansFromActions.theirTeamBans.length }).map((_, i) => {
                  const absoluteIndex = bansFromActions.theirTeamBans.length + i;
                  return (
                    <BanSlot
                      key={`empty-their-${i}`}
                      ban={null}
                      team="red"
                      isActive={currentAction.type === "ban" && currentAction.team === "red" && absoluteIndex === bansFromActions.theirTeamBans.length}
                      isLowTime={isLowTime && currentAction.type === "ban" && currentAction.team === "red"}
                      animationDuration={blinkDuration}
                    />
                  );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-1 justify-between gap-6 min-h-0 w-full">
          <div className="flex-1 flex flex-col gap-2 min-w-[180px]">
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
                      isActive={currentAction.type === "pick" && currentAction.team === "blue" && player.cellId === session.actions.flat().find((a: any) => a.isInProgress && !a.completed)?.actorCellId}
                      isLowTime={isLowTime && currentAction.type === "pick" && currentAction.team === "blue" && player.cellId === session.actions.flat().find((a: any) => a.isInProgress && !a.completed)?.actorCellId}
                      animationDuration={blinkDuration}
                  />
              );
            })}
          </div>

          <div className="flex-none flex flex-col gap-2 w-[800px] mx-auto">
            <div className="flex flex-col items-end gap-2">
              <div className="relative">
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-[180px] h-[28px] border border-[var(--border-color)] bg-[var(--surface-color)] px-4 text-[11px] focus:outline-none focus:border-[var(--brand-primary)] transition-all rounded-lg uppercase font-black tracking-widest text-white placeholder:text-[var(--text-muted)] placeholder:opacity-40"
                />
              </div>
            </div>
            <div className="flex-[3] border border-[var(--border-color)] bg-[var(--surface-color)] overflow-y-auto p-3 relative no-scrollbar rounded-xl shadow-inner">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(55px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-4">
                {filteredChampions.map((champ) => (
                    <ChampionCard
                        key={champ.id}
                        champion={champ}
                        isSelected={champ.name !== "none" && unavailableChampionIds.has(champ.numeric_id)}
                        isStaged={stagedChampion?.id === champ.id}
                        onSelect={(c) => handleSelectChampion(c)}
                        highlightColor={teamHighlightColor}
                    />
                ))}
              </div>
            </div>
            <button
                onClick={handleConfirm}
                disabled={!stagedChampion || stagedChampion.name === "none" || !currentAction.isMyTurn || currentAction.phase === "PLANNING" || currentAction.phase === "FINALIZATION"}
                className={`w-full py-2 rounded-xl font-black uppercase tracking-[0.2em] transition-all transform active:scale-[0.98] text-sm border-2 ${
                    stagedChampion && stagedChampion.name !== "none" && currentAction.isMyTurn && currentAction.phase !== "PLANNING" && currentAction.phase !== "FINALIZATION"
                        ? getConfirmButtonColor()
                        : "bg-[var(--surface-color)] border-[var(--border-color)] text-[var(--text-muted)] cursor-not-allowed opacity-40"
                }`}
                style={stagedChampion && stagedChampion.name !== "none" && currentAction.isMyTurn ? {
                  backgroundColor: teamHighlightColor,
                  borderColor: teamHighlightColor
                } : {}}
            >
              {currentAction.phase === "PLANNING" || currentAction.phase === "FINALIZATION" ? "Awaiting Game" : getConfirmButtonText()}
            </button>

            {canShowRecommendations && (
              <div className="mt-4 border border-[var(--border-color)] bg-[var(--surface-color)] rounded-xl p-4 relative overflow-hidden flex-1 flex flex-col min-h-0">
                {selectedRec ? (
                  <div className="absolute inset-0 bg-[var(--bg-color)]/95 p-2 flex animate-in fade-in duration-300 z-20">
                    <div className="w-[110px] flex flex-col items-center gap-3 shrink-0 mt-3">
                      {selectedRec.champ ? (
                        <img
                          src={selectedRec.champ.icon}
                          alt={selectedRec.champ.name}
                          className="w-16 h-16 border-2 rounded-xl"
                          style={{ borderColor: teamHighlightColor }}
                        />
                      ) : (
                        <div 
                          className="w-16 h-16 border-2 bg-[var(--surface-color)] rounded-xl"
                          style={{ borderColor: teamHighlightColor }}
                        />
                      )}
                      <div className="flex flex-col gap-1 items-center text-center w-full">
                        <div className="text-sm font-black uppercase tracking-tight text-white truncate w-full">
                          {selectedRec.champ ? selectedRec.champ.name : selectedRec.rec.champion}
                        </div>
                        <div 
                          className="text-xs font-black uppercase tracking-wider"
                          style={{ color: teamHighlightColor }}
                        >
                          {(selectedRec.rec.score * 100).toFixed(0)}%
                        </div>
                        <button 
                          onClick={() => setSelectedRec(null)}
                          className="mt-2 px-4 py-1 bg-[var(--surface-color)] border-2 border-[var(--border-color)] rounded-lg text-[10px] font-black uppercase tracking-widest text-white hover:bg-[var(--surface-color-hover)] hover:border-[var(--team-accent)] transition-all"
                        >
                          Back
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl p-3 text-[13px] leading-relaxed text-[var(--text-secondary)] italic overflow-y-auto no-scrollbar whitespace-pre-line shadow-inner">
                      {selectedRec.rec.tactical || "No detailed analysis available."}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-black uppercase tracking-[0.15em] text-[10px] flex items-center gap-1.5" style={{ color: 'var(--team-accent)' }}>
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--team-accent)' }} />
                        Strategy Recommendations
                      </div>
                      <button
                        onClick={() => refreshRecommendations()}
                        className="px-3 py-1 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-md text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-white hover:border-[var(--team-accent)] transition-all"
                      >
                        Refresh
                      </button>
                    </div>

                    {activeMlSuggest && typeof activeMlSuggest.blue_winrate === "number" && typeof activeMlSuggest.red_winrate === "number" && (
                      <div className="mb-3 flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.05em] bg-[var(--bg-color)] p-2 rounded-lg border border-[var(--border-color)] w-fit">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[var(--text-muted)] opacity-50">BLUE:</span>
                          <span className="text-[var(--accent-blue)] text-sm">{(activeMlSuggest.blue_winrate * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-px h-3 bg-[var(--border-color)]" />
                        <div className="flex items-center gap-1.5">
                          <span className="text-[var(--text-muted)] opacity-50">RED:</span>
                          <span className="text-[var(--accent-red)] text-sm">{(activeMlSuggest.red_winrate * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {UI_ROLES.map((role) => (
                        <button
                          key={role}
                          onClick={() => setSelectedRole(role)}
                          className={`px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                            selectedRole === role
                              ? "bg-[var(--team-accent)] border-[var(--team-accent)] text-[var(--bg-color)]"
                              : "bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-white hover:border-[var(--team-accent)]"
                          }`}
                          title={role}
                          type="button"
                        >
                          {role === "MIDDLE"
                            ? "MID"
                            : role === "BOTTOM"
                            ? "ADC"
                            : role === "UTILITY"
                            ? "SUPP"
                            : role === "ALL"
                            ? "ALL"
                            : role}
                        </button>
                      ))}
                    </div>

                    {mlError && (
                      <div className="mb-2 text-[var(--accent-red)] text-[10px] font-black uppercase tracking-widest animate-pulse">
                        ⚠️ {mlError}
                      </div>
                    )}

                    <div className="max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                      {activeMlSuggest ? (
                        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                          {visibleRecommendations.map(({ rec, champ }) => (
                            <div
                              key={`${selectedRole}-${rec.champion}`}
                              className="flex flex-col items-center gap-2 border border-[var(--border-color)] bg-[var(--bg-color)] rounded-lg p-2 hover:border-[var(--team-accent)] transition-all cursor-pointer hover:bg-[var(--surface-color-hover)] group"
                              onClick={() => {
                                if (!champ) return;
                                setSelectedRec({ rec, champ });
                                setStagedChampion((prev) => (prev?.name === champ.name ? null : champ));
                                if (stagedChampion?.name !== champ.name) {
                                  handleSelectChampion(champ);
                                }
                              }}
                            >
                              {champ ? (
                                <div className="relative">
                                  <img src={champ.icon} alt={champ.name} className="w-14 h-14 border-2 border-[var(--border-color)] rounded-lg group-hover:border-[var(--team-accent)] transition-all" />
                                  <div className="absolute -top-1 -right-1 bg-[var(--team-accent)] text-[var(--bg-color)] text-[8px] font-black px-1 rounded border border-[var(--bg-color)]">
                                    {(rec.score * 100).toFixed(0)}%
                                  </div>
                                </div>
                              ) : (
                                <div className="w-14 h-14 border-2 border-[var(--border-color)] bg-[var(--bg-color)] rounded-lg" />
                              )}

                              <div className="w-full text-center">
                                <div className="truncate font-black uppercase tracking-tight text-[10px] text-white">
                                  {champ ? champ.name : rec.champion}
                                </div>
                              </div>
                            </div>
                          ))}

                          {visibleRecommendations.length === 0 && (
                            <div className="col-span-full text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest text-center py-6 opacity-30">No predictions</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest text-center py-6 animate-pulse">Analyzing...</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-2 min-w-[180px]">
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
                      isActive={currentAction.type === "pick" && currentAction.team === "red" && player.cellId === session.actions.flat().find((a: any) => a.isInProgress && !a.completed)?.actorCellId}
                      isLowTime={isLowTime && currentAction.type === "pick" && currentAction.team === "red" && player.cellId === session.actions.flat().find((a: any) => a.isInProgress && !a.completed)?.actorCellId}
                      animationDuration={blinkDuration}
                  />
              );
            })}
          </div>
        </div>
      </div>
  );
}