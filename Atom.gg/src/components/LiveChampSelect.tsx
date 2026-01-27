import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Champion } from "../types/draft";
import type { MlRecommendation, MlResponse, MlRole, MlSuggestPayload } from "../types/ml";
import { BanSlot } from "./BanSlot";
import { PickSlot } from "./PickSlot";
import { ChampionCard } from "./ChampionCard";
import { NoActiveDraft } from "./NoActiveDraft";

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

const ALL_ROLES: MlRole[] = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

export function LiveChampSelect({ onBack, onHome }: LiveChampSelectProps) {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [stagedChampion, setStagedChampion] = useState<Champion | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const [selectedRole, setSelectedRole] = useState<MlRole>("ALL");
  const [mlSuggest, setMlSuggest] = useState<MlSuggestPayload | null>(null);
  const [mlError, setMlError] = useState<string | null>(null);

  const mlInitializedRef = useRef(false);
  const processedActionKeysRef = useRef<Set<string>>(new Set());
  const sentBluePickIdsRef = useRef<Set<number>>(new Set());
  const sentRedPickIdsRef = useRef<Set<number>>(new Set());
  const sentBanIdsRef = useRef<Set<number>>(new Set());
  const lastSuggestKeyRef = useRef<string>("");
  const lastSuggestAtRef = useRef<number>(0);

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
      return championById.get(mlChampionKey) ?? championByName.get(mlChampionKey);
    },
    [championById, championByName]
  );

  const bansFromActions = useMemo(() => {
    if (!session) return { myTeamBans: [], theirTeamBans: [] };

    const myTeam = session.myTeam || [];
    const actions = session.actions || [];

    const myTeamBans: number[] = [];
    const theirTeamBans: number[] = [];

    //cell IDs from my team
    const myTeamCellIds = new Set(myTeam.map((p: any) => p.cellId));

    //extract bans from actions
    for (const group of actions) {
      if (Array.isArray(group)) {
        for (const action of group) {
          if (action.type === "ban" && action.completed && action.championId > 0) {
            if (myTeamCellIds.has(action.actorCellId)) {
              myTeamBans.push(action.championId);
            } else {
              theirTeamBans.push(action.championId);
            }
          }
        }
      }
    }

    return { myTeamBans, theirTeamBans };
  }, [session]);

  const currentAction = useMemo((): CurrentAction => {
    if (!session) return { type: null, isMyTurn: false, timeLeft: 0, phase: "WAITING" };

    const localCellId = session.localPlayerCellId;
    const actions = session.actions || [];
    const timer = session.timer || {};

    let myCurrentAction = null;
    for (const group of actions) {
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

  const myAssignedRole = useMemo<MlRole | null>(() => {
    if (!session) return null;

    const localCellId = session.localPlayerCellId;
    const me = (session.myTeam || []).find((p: any) => p?.cellId === localCellId);
    const raw = (me?.assignedRole ?? me?.assignedPosition ?? me?.position ?? me?.role ?? "") as string;
    const v = String(raw).toLowerCase();

    if (!v) return null;
    if (v.includes("top")) return "TOP";
    if (v.includes("jungle") || v === "jg") return "JUNGLE";
    if (v.includes("mid") || v.includes("middle")) return "MIDDLE";
    if (v.includes("bot") || v.includes("bottom") || v.includes("adc")) return "BOTTOM";
    if (v.includes("sup") || v.includes("support") || v.includes("utility")) return "UTILITY";
    return null;
  }, [session]);

  const lockedNumericIds = useMemo(() => {
    const set = new Set<number>();
    if (!session) return set;

    // Locked picks (championId is present once locked)
    const myTeam = session.myTeam || [];
    const theirTeam = session.theirTeam || [];
    for (const p of [...myTeam, ...theirTeam]) {
      if (typeof p?.championId === "number" && p.championId > 0) set.add(p.championId);
    }

    // Locked bans come from completed ban actions
    const actions = session.actions || [];
    for (const group of actions) {
      if (!Array.isArray(group)) continue;
      for (const action of group) {
        if (action?.type === "ban" && action?.completed && typeof action?.championId === "number" && action.championId > 0) {
          set.add(action.championId);
        }
      }
    }

    return set;
  }, [session]);

  const showRecommendations =
    currentAction.isMyTurn &&
    (currentAction.type === "pick" || currentAction.type === "ban") &&
    currentAction.phase !== "PLANNING" &&
    currentAction.phase !== "FINALIZATION";

  // Default the role filter to the player's assigned role (once we know it).
  useEffect(() => {
    if (!myAssignedRole) return;
    setSelectedRole((prev) => (prev === "ALL" ? myAssignedRole : prev));
  }, [myAssignedRole]);

  const visibleRecommendations = useMemo(() => {
    if (!mlSuggest) return [] as Array<{ rec: MlRecommendation; champ?: Champion }>;
    const recommendationsMap = (mlSuggest.recommendations ?? {}) as Record<string, MlRecommendation[]>;

    let recs: MlRecommendation[] = [];
    if (selectedRole === "ALL") {
      const all = Object.values(recommendationsMap).flat();
      const unique = new Map<string, MlRecommendation>();
      all
        .sort((a, b) => b.score - a.score)
        .forEach((r) => {
          if (!unique.has(r.champion)) unique.set(r.champion, r);
        });
      recs = Array.from(unique.values()).sort((a, b) => b.score - a.score);
    } else {
      recs = recommendationsMap[selectedRole] ?? [];
    }

    return recs
      .map((rec) => ({ rec, champ: resolveChampion(rec.champion) }))
      .filter(({ champ }) => !champ || !lockedNumericIds.has(champ.numeric_id));
  }, [mlSuggest, selectedRole, resolveChampion, lockedNumericIds]);

  useEffect(() => {
    invoke<Champion[]>("get_all_champions")
        .then(setChampions)
        .catch((err) => console.error("Failed to fetch champions:", err));
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
        setSession(null);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const getChamp = useCallback(
    (id: number) => {
      return championsMap.get(id) || null;
    },
    [championsMap]
  );

  // Reset ML/session-derived caches when we lose session.
  useEffect(() => {
    if (session) return;
    mlInitializedRef.current = false;
    processedActionKeysRef.current = new Set();
    sentBluePickIdsRef.current = new Set();
    sentRedPickIdsRef.current = new Set();
    sentBanIdsRef.current = new Set();
    lastSuggestKeyRef.current = "";
    lastSuggestAtRef.current = 0;
    setMlSuggest(null);
    setMlError(null);
  }, [session]);

  const initMlIfNeeded = useCallback(async () => {
    if (!session) return;
    if (mlInitializedRef.current) return;

    try {
      await invoke("ml_init", {
        config: {
          team1: "",
          team2: "",
          isTeam1Blue: true,
          mode: "Normal",
          numGames: 1,
        },
      });
      mlInitializedRef.current = true;
      setMlError(null);
    } catch (e: any) {
      setMlError(e?.toString?.() ?? "Failed to init ML");
    }
  }, [session]);

  const syncDraftToMlAndMaybeSuggest = useCallback(async () => {
    if (!session) return;
    if (champions.length === 0) return;

    await initMlIfNeeded();
    if (!mlInitializedRef.current) return;

    try {
      const actions = session.actions || [];

      // Prefer `isAllyAction` when present; otherwise fall back to myTeam cellIds.
      const myTeamCellIds = new Set((session.myTeam || []).map((p: any) => p.cellId));

      const newlyCompleted: Array<{ key: string; type: "pick" | "ban"; isAlly: boolean; championId: number }> = [];

      for (let groupIndex = 0; groupIndex < actions.length; groupIndex++) {
        const group = actions[groupIndex];
        if (!Array.isArray(group)) continue;

        for (const action of group) {
          const t = action?.type;
          if (t !== "pick" && t !== "ban") continue;
          if (!action?.completed) continue;
          const champId = Number(action?.championId ?? 0);
          if (!Number.isFinite(champId) || champId <= 0) continue;

          const rawKey = action?.id ?? `${groupIndex}-${action?.actorCellId}-${t}-${champId}`;
          const key = String(rawKey);
          if (processedActionKeysRef.current.has(key)) continue;

          const isAlly =
            typeof action?.isAllyAction === "boolean" ? action.isAllyAction : myTeamCellIds.has(action?.actorCellId);

          newlyCompleted.push({ key, type: t, isAlly, championId: champId });
        }
      }

      // Apply in order so ML state matches the real timeline.
      for (const a of newlyCompleted) {
        const champ = getChamp(a.championId);
        if (!champ) continue;

        if (a.type === "ban") {
          if (!sentBanIdsRef.current.has(a.championId)) {
            await invoke("ml_ban", { champion: champ.id });
            sentBanIdsRef.current.add(a.championId);
          }
        } else {
          const sentSet = a.isAlly ? sentBluePickIdsRef.current : sentRedPickIdsRef.current;
          if (!sentSet.has(a.championId)) {
            await invoke("ml_pick", { side: a.isAlly ? "blue" : "red", champion: champ.id });
            sentSet.add(a.championId);
          }
        }

        processedActionKeysRef.current.add(a.key);
      }

      // Fallback sync: ensure we include all currently locked picks even if LCU actions are missing.
      for (const p of session.myTeam || []) {
        const champId = Number(p?.championId ?? 0);
        if (!Number.isFinite(champId) || champId <= 0) continue;
        if (sentBluePickIdsRef.current.has(champId)) continue;
        const champ = getChamp(champId);
        if (!champ) continue;
        await invoke("ml_pick", { side: "blue", champion: champ.id });
        sentBluePickIdsRef.current.add(champId);
      }

      for (const p of session.theirTeam || []) {
        const champId = Number(p?.championId ?? 0);
        if (!Number.isFinite(champId) || champId <= 0) continue;
        if (sentRedPickIdsRef.current.has(champId)) continue;
        const champ = getChamp(champId);
        if (!champ) continue;
        await invoke("ml_pick", { side: "red", champion: champ.id });
        sentRedPickIdsRef.current.add(champId);
      }

      // Fallback sync: ensure all completed bans are sent.
      for (const id of [...(bansFromActions?.myTeamBans ?? []), ...(bansFromActions?.theirTeamBans ?? [])]) {
        const banId = Number(id);
        if (!Number.isFinite(banId) || banId <= 0) continue;
        if (sentBanIdsRef.current.has(banId)) continue;
        const champ = getChamp(banId);
        if (!champ) continue;
        await invoke("ml_ban", { champion: champ.id });
        sentBanIdsRef.current.add(banId);
      }

      if (!showRecommendations) return;

      const analyzeSide = currentAction.type === "ban" ? "RED" : "BLUE";
      const isBanMode = currentAction.type === "ban";
      const suggestKey = `${analyzeSide}-${isBanMode}-${processedActionKeysRef.current.size}-${selectedRole}`;

      const now = Date.now();
      const shouldThrottle = now - lastSuggestAtRef.current < 750;
      const isSameKey = suggestKey === lastSuggestKeyRef.current;
      if (shouldThrottle && isSameKey) return;

      // Personalization: if we know the player's role and the UI isn't on ALL, ask ML only for that role.
      // This makes bans feel role-targeted (enemy lane threats) and picks feel role-targeted.
      const roles = selectedRole !== "ALL" ? [selectedRole] : ALL_ROLES;

      const res = (await invoke("ml_suggest", {
        targetSide: analyzeSide,
        isBanMode,
        roles,
      })) as MlResponse;

      if (!res.ok) {
        setMlError(res.error ?? "ML error");
        return;
      }

      lastSuggestAtRef.current = now;
      lastSuggestKeyRef.current = suggestKey;
      setMlError(null);
      setMlSuggest(res.payload as MlSuggestPayload);
    } catch (e: any) {
      setMlError(e?.toString?.() ?? "Failed to sync with ML");
    }
  }, [session, champions.length, initMlIfNeeded, getChamp, showRecommendations, currentAction.type, selectedRole, bansFromActions]);

  useEffect(() => {
    void syncDraftToMlAndMaybeSuggest();
  }, [syncDraftToMlAndMaybeSuggest]);

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

  const myTeam = session.myTeam || [];
  const theirTeam = session.theirTeam || [];

  const handleSelectChampion = async (champion: Champion) => {
    // Allow hovering during planning/finalization phase or when it's your turn


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

  const filteredChampions = champions.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const suggestTitle = currentAction.type === "ban" ? "Ban Suggestions" : "Pick Suggestions";

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
    if (currentAction.type === "ban") {
      return stagedChampion
          ? "bg-[#c0392b] hover:bg-[#a93226] shadow-[0_0_20px_rgba(192,57,43,0.3)]"
          : "bg-[#222] text-[#444] cursor-not-allowed border border-[#333]";
    }
    return stagedChampion
        ? "bg-[#27ae60] hover:bg-[#229954] shadow-[0_0_20px_rgba(39,174,96,0.3)]"
        : "bg-[#222] text-[#444] cursor-not-allowed border border-[#333]";
  };

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
              return (
                  <PickSlot
                      key={i}
                      pick={getChamp(player.championId || player.championPickIntent)}
                      index={i}
                      team="blue"
                      playerName={isCurrentPlayer ? "YOU" : (player.gameName || `Player ${i + 1}`)}
                  />
              );
            })}
          </div>

          <div className="flex-1 flex flex-col gap-5 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {showRecommendations ? (
                  <div className="text-[#666] font-black uppercase tracking-[0.25em] text-xs truncate">
                    {suggestTitle}
                  </div>
                ) : (
                  <div className="text-[#444] font-black uppercase tracking-[0.25em] text-xs truncate">
                    Champion Pool
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search champion..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-[200px] h-[40px] border border-[#444] bg-[#252525] px-4 text-sm focus:outline-none focus:border-[#3498db] transition-colors rounded-lg uppercase font-bold tracking-widest`}
                />

                {showRecommendations && (
                  <button
                    onClick={() => {
                      lastSuggestKeyRef.current = "";
                      lastSuggestAtRef.current = 0;
                      void syncDraftToMlAndMaybeSuggest();
                    }}
                    className="h-[40px] px-4 bg-[#252525] border border-[#333] rounded-md text-[10px] font-bold uppercase tracking-widest text-[#bbb] hover:text-white hover:border-[#444] transition-all"
                  >
                    Refresh
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-5 flex-1 min-h-0">
              <div className={`${showRecommendations ? "flex-[2]" : "flex-1"} border-2 border-[#333] bg-[#1a1a1a] overflow-y-auto p-4 relative no-scrollbar rounded-lg shadow-inner`}>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-4">
                  {filteredChampions.map((champ) => (
                    <ChampionCard
                      key={champ.id}
                      champion={champ}
                      isSelected={lockedNumericIds.has(champ.numeric_id)}
                      isStaged={stagedChampion?.id === champ.id}
                      onSelect={(c) => handleSelectChampion(c)}
                    />
                  ))}
                </div>
              </div>

              {showRecommendations && (
                <div className="w-[360px] border-2 border-[#333] bg-[#1a1a1a] rounded-lg shadow-inner flex flex-col min-h-0">
                  <div className="p-4 border-b border-[#333]">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#444]">
                        ML: {(mlSuggest?.target_side ?? (currentAction.type === "ban" ? "RED" : "BLUE"))} {currentAction.type === "ban" ? "BAN" : "PICK"}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#666]">
                        Role
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3 flex-wrap">
                      {(["ALL", ...ALL_ROLES] as MlRole[]).map((role) => (
                        <button
                          key={role}
                          onClick={() => setSelectedRole(role)}
                          className={`px-3 py-2 rounded-md border text-[10px] font-black uppercase tracking-widest transition-all ${
                            selectedRole === role
                              ? "bg-[#3498db] border-[#3498db] text-white"
                              : "bg-[#252525] border-[#333] text-[#999] hover:text-white hover:border-[#444]"
                          }`}
                        >
                          {role === "MIDDLE" ? "MID" : role === "BOTTOM" ? "ADC" : role === "UTILITY" ? "SUP" : role}
                        </button>
                      ))}
                    </div>

                    {mlError && (
                      <div className="mt-3 text-[#e74c3c] text-xs font-bold uppercase tracking-widest">
                        {mlError}
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex-1 overflow-y-auto no-scrollbar">
                    {mlSuggest ? (
                      <div className="flex flex-col gap-2">
                        {visibleRecommendations.slice(0, 12).map(({ rec, champ }) => (
                          <div
                            key={`${selectedRole}-${rec.champion}`}
                            className="flex items-center gap-3 border border-[#333] bg-[#141414] rounded-lg p-3 hover:border-[#3498db] transition-colors cursor-pointer"
                            onClick={() => {
                              if (!champ) return;
                              setStagedChampion(champ);
                              void handleSelectChampion(champ);
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
                              {rec.tactical && (
                                <div className="text-[10px] text-[#aaa] mt-1 leading-snug">
                                  {rec.tactical}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {visibleRecommendations.length === 0 && (
                          <div className="text-[#444] text-xs font-bold uppercase tracking-widest">
                            No recommendations
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[#444] text-xs font-bold uppercase tracking-widest">
                        Waiting for ML...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
                onClick={handleConfirm}
                disabled={!stagedChampion || !currentAction.isMyTurn || currentAction.phase === "PLANNING" || currentAction.phase === "FINALIZATION"}
                className={`w-full py-3 rounded-lg font-black uppercase tracking-[0.2em] transition-all transform active:scale-95 ${
                    stagedChampion && currentAction.isMyTurn && currentAction.phase !== "PLANNING" && currentAction.phase !== "FINALIZATION"
                        ? getConfirmButtonColor()
                        : "bg-[#222] text-[#444] cursor-not-allowed border border-[#333]"
                }`}
            >
              {currentAction.phase === "PLANNING" || currentAction.phase === "FINALIZATION" ? "Awaiting Phase" : getConfirmButtonText()}
            </button>
          </div>

          <div className="flex flex-col gap-5 w-[220px]">
            {theirTeam.map((player: any, i: number) => (
                <PickSlot
                    key={i}
                    pick={getChamp(player.championId || player.championPickIntent)}
                    index={i}
                    team="red"
                    playerName={`Enemy ${i + 1}`}
                />
            ))}
          </div>
        </div>
      </div>
  );
}