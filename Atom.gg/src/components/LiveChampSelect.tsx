import { useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Champion } from "../types/draft";
import { NONE_CHAMPION } from "../constants/draft";
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

export function LiveChampSelect({ onBack, onHome }: LiveChampSelectProps) {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [stagedChampion, setStagedChampion] = useState<Champion | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const championsMap = useMemo(() => {
    const map = new Map<number, Champion>();
    champions.forEach((c) => map.set(c.numeric_id, c));
    return map;
  }, [champions]);

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

  const getChamp = (id: number) => championsMap.get(id) || null;

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