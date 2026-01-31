import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Champion, DraftConfig, TeamPlayers } from "../types/draft";
import type { MlRole, MlSuggestPayload, MlResponse, MlRecommendation } from "../types/ml";
import { DRAFT_SEQUENCE, NONE_CHAMPION } from "../constants/draft";
import { BanSlot } from "../components/BanSlot";
import { PickSlot } from "../components/PickSlot";
import { ChampionCard } from "../components/ChampionCard";
import { TimerDisplay } from "../components/TimerDisplay";
import "./drafter.css";
import {getAllChampions, getRoleIconSync} from "../services/fallback_service.ts";

const ALL_ROLES: MlRole[] = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const UI_ROLES: MlRole[] = ["ALL", ...ALL_ROLES];

function roleIconUrl(role: MlRole): string {
  return getRoleIconSync(role);
}

function RoleIcon({ role, active }: { role: MlRole; active: boolean }) {
  return (
    <img
      src={roleIconUrl(role)}
      alt={role}
      className={`w-4 h-4 rounded ${active ? "opacity-100" : "opacity-70"}`}
    />
  );
}

interface DrafterProps {
  config: DraftConfig;
  onBack: () => void;
}

function Drafter({ config, onBack }: DrafterProps) {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [stagedChampion, setStagedChampion] = useState<Champion | null>(null);
  const stagedChampionRef = useRef<Champion | null>(null);
  const lastHandledTurnRef = useRef<number>(-1);
  useEffect(() => {
    stagedChampionRef.current = stagedChampion;
  }, [stagedChampion]);
  const [gameNumber, setGameNumber] = useState(1);
  const [isTeam1Blue, setIsTeam1Blue] = useState(config.isTeam1Blue);
  const [globalLockedChampions, setGlobalLockedChampions] = useState<Set<string>>(new Set());

  const [selectedRole, setSelectedRole] = useState<MlRole>("ALL");
  const [mlSuggest, setMlSuggest] = useState<MlSuggestPayload | null>(null);
  const [mlError, setMlError] = useState<string | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const [selectedRec, setSelectedRec] = useState<{ rec: MlRecommendation; champ: Champion | undefined } | null>(null);

  const [blueBans, setBlueBans] = useState<(Champion | null)[]>(Array(5).fill(null));
  const [redBans, setRedBans] = useState<(Champion | null)[]>(Array(5).fill(null));
  const [bluePicks, setBluePicks] = useState<(Champion | null)[]>(Array(5).fill(null));
  const [redPicks, setRedPicks] = useState<(Champion | null)[]>(Array(5).fill(null));

  const [swapSource, setSwapSource] = useState<{ team: "blue" | "red"; index: number } | null>(null);

  const [team1Players, setTeam1Players] = useState<TeamPlayers | null>(null);
  const [team2Players, setTeam2Players] = useState<TeamPlayers | null>(null);

  const blueTeamPlayers = isTeam1Blue ? team1Players : team2Players;
  const redTeamPlayers = isTeam1Blue ? team2Players : team1Players;

  const blueTeamName = isTeam1Blue ? config.team1 : config.team2;
  const redTeamName = isTeam1Blue ? config.team2 : config.team1;

  const [currentTurn, setCurrentTurn] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);

  const blinkDuration = useMemo(() => {
    if (timeLeft > 20) return "2.0s";
    if (timeLeft > 10) return "1.2s";
    if (timeLeft > 5) return "0.8s";
    return "0.6s";
  }, [timeLeft]);

  const championByName = useMemo(() => {
    const map = new Map<string, Champion>();
    champions.forEach((c) => map.set(c.name, c));
    return map;
  }, [champions]);

  const championById = useMemo(() => {
    const map = new Map<string, Champion>();
    champions.forEach((c) => map.set(c.id, c));
    return map;
  }, [champions]);

  const resolveChampion = useCallback(
    (mlChampionKey: string): Champion | undefined => {
      // The ML stack (ported from Testing.ipynb) uses DDragon champion ids (e.g. "MonkeyKing"),
      // while the UI often shows the display name (e.g. "Wukong").
      return championById.get(mlChampionKey) ?? championByName.get(mlChampionKey);
    },
    [championById, championByName]
  );

  const suggestContext = useMemo<{
    isBanMode: boolean;
    mySide: "BLUE" | "RED";
    analyzeSide: "BLUE" | "RED";
    label: string;
  }>(() => {
    if (currentTurn >= DRAFT_SEQUENCE.length) {
      return { isBanMode: false, mySide: "BLUE", analyzeSide: "BLUE", label: "Recommendations" };
    }

    const turn = DRAFT_SEQUENCE[currentTurn];
    const isBanMode = turn.type === "ban";

    // Match Testing.ipynb behavior:
    // - Picks: suggest picks for the side that is picking.
    // - Bans: suggest bans against the *enemy* side (sb command).
    const mySide: "BLUE" | "RED" = turn.team === "blue" ? "BLUE" : "RED";

    // Match Testing.ipynb semantics:
    // - `s b` / `s r`   => recommend PICKS for that same side.
    // - `sb b` / `sb r` => recommend BANS by analyzing threats of the ENEMY side.
    const analyzeSide: "BLUE" | "RED" = isBanMode ? (mySide === "BLUE" ? "RED" : "BLUE") : mySide;

    const label = isBanMode ? "Ban Recommendations" : "Pick Recommendations";
    return { isBanMode, mySide, analyzeSide, label };
  }, [currentTurn]);

  const refreshRecommendationsForTurn = useCallback(async (idx: number) => {
    try {
      setSelectedRec(null);
      let isBanMode = false;
      let analyzeSide: "BLUE" | "RED" = "BLUE";

      if (idx < DRAFT_SEQUENCE.length) {
        const t = DRAFT_SEQUENCE[idx];
        isBanMode = t.type === "ban";
        const mySide: "BLUE" | "RED" = t.team === "blue" ? "BLUE" : "RED";
        analyzeSide = isBanMode ? (mySide === "BLUE" ? "RED" : "BLUE") : mySide;
      }

      const res = (await invoke("ml_suggest", {
        targetSide: analyzeSide,
        isBanMode,
        roles: ALL_ROLES,
      })) as MlResponse;

      if (!res.ok) {
        setMlError(res.error ?? "ML error");
        return;
      }

      setMlError(null);
      setMlSuggest(res.payload as MlSuggestPayload);
    } catch (e: any) {
      setMlError(e?.toString?.() ?? "Failed to fetch ML suggestions");
    }
  }, []);

  const refreshRecommendations = useCallback(() => {
    return refreshRecommendationsForTurn(currentTurn);
  }, [currentTurn, refreshRecommendationsForTurn]);

  const currentDraftSelectedNames = useMemo(() => {
    return new Set(
      [...blueBans, ...redBans, ...bluePicks, ...redPicks]
        .filter((c) => c !== null && c.name !== "none")
        .map((c) => c!.name)
    );
  }, [blueBans, redBans, bluePicks, redPicks]);

  const allLockedNames = useMemo(() => {
    const combined = new Set(globalLockedChampions);
    currentDraftSelectedNames.forEach((name) => combined.add(name));
    return combined;
  }, [globalLockedChampions, currentDraftSelectedNames]);

  const visibleRecommendations = useMemo(() => {
    if (!mlSuggest) return [];
    const recommendationsMap = (mlSuggest.recommendations ?? {}) as Record<string, MlRecommendation[]>;
    let recs: MlRecommendation[] = [];

    if (selectedRole === "ALL") {
      const allRecs = Object.values(recommendationsMap).flat();
      const uniqueRecs = new Map<string, MlRecommendation>();
      allRecs.sort((a, b) => b.score - a.score).forEach((r) => {
        if (!uniqueRecs.has(r.champion)) {
          uniqueRecs.set(r.champion, r);
        }
      });
      recs = Array.from(uniqueRecs.values()).sort((a, b) => b.score - a.score);
    } else {
      recs = recommendationsMap[selectedRole] ?? [];
    }

    const filtered = recs
      .map((rec) => ({ rec, champ: resolveChampion(rec.champion) }))
      .filter(({ champ }) => !champ || !allLockedNames.has(champ.name));

    return filtered;
  }, [mlSuggest, selectedRole, resolveChampion, allLockedNames, selectedRec]);

  const isDraftComplete = currentTurn >= DRAFT_SEQUENCE.length;
  const currentTeam = !isDraftComplete ? DRAFT_SEQUENCE[currentTurn].team : null;
  const isLowTime = timeLeft <= 10;
  const teamHighlightColor = currentTeam === "blue" ? "var(--accent-blue)" : currentTeam === "red" ? "var(--accent-red)" : "var(--brand-primary)";
  const teamHighlightShadow = currentTeam === "blue" ? "rgba(0, 209, 255, 0.25)" : currentTeam === "red" ? "rgba(255, 75, 80, 0.25)" : "rgba(0, 255, 148, 0.25)";

  useEffect(() => {
    getAllChampions()
        .then((data) => {
          setChampions(data);
        })
        .catch((err) => {
          console.error("Failed to fetch champions:", err);
        });

    // Start ML subprocess and configure series/teams.
    invoke("ml_init", { config })
      .then(() => refreshRecommendationsForTurn(0))
      .catch((err) => {
        console.error("Failed to init ML:", err);
        setMlError("Failed to init ML process");
      });

    // Fetch team players
    invoke<TeamPlayers>("get_team_players", { teamName: config.team1 })
      .then((data) => setTeam1Players(data))
      .catch((err) => console.error(`Failed to fetch players for ${config.team1}:`, err));

    invoke<TeamPlayers>("get_team_players", { teamName: config.team2 })
      .then((data) => setTeam2Players(data))
      .catch((err) => console.error(`Failed to fetch players for ${config.team2}:`, err));
  }, [config, refreshRecommendationsForTurn]);

  useEffect(() => {
    if (currentTurn >= DRAFT_SEQUENCE.length) {
      setTimeLeft(0);
      return;
    }

    setTimeLeft(30);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSelectChampion(stagedChampionRef.current || NONE_CHAMPION);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTurn]);

  const getPlayerName = useCallback((team: "blue" | "red", index: number) => {
    const players = team === "blue" ? blueTeamPlayers : redTeamPlayers;
    if (!players) return "";
    switch (index) {
      case 0: return players.top;
      case 1: return players.jungle;
      case 2: return players.mid;
      case 3: return players.adc;
      case 4: return players.utility;
      default: return "";
    }
  }, [blueTeamPlayers, redTeamPlayers]);

  const handleSelectChampion = useCallback(
    (champion: Champion) => {
      if (currentTurn >= DRAFT_SEQUENCE.length) return;
      if (lastHandledTurnRef.current === currentTurn) return;
      if (champion.name !== "none" && allLockedNames.has(champion.name)) return;

      lastHandledTurnRef.current = currentTurn;
      const turn = DRAFT_SEQUENCE[currentTurn];
      const isBlue = turn.team === "blue";
      const isBan = turn.type === "ban";

      if (isBlue) {
        if (isBan) {
          setBlueBans((prev) => {
            const next = [...prev];
            next[turn.index] = champion;
            return next;
          });
        } else {
          setBluePicks((prev) => {
            const next = [...prev];
            next[turn.index] = champion;
            return next;
          });
        }
      } else {
        if (isBan) {
          setRedBans((prev) => {
            const next = [...prev];
            next[turn.index] = champion;
            return next;
          });
        } else {
          setRedPicks((prev) => {
            const next = [...prev];
            next[turn.index] = champion;
            return next;
          });
        }
      }

      // Forward action to ML (ignore NONE placeholder).
      if (champion.name !== "none") {
        const side = isBlue ? "blue" : "red";
        const promise = isBan
          ? invoke("ml_ban", { champion: champion.id })
          : invoke("ml_pick", { side, champion: champion.id });

        promise
          .then(() => refreshRecommendationsForTurn(currentTurn + 1))
          .catch((err) => {
            console.error("Failed to update ML:", err);
            setMlError("Failed to send draft action to ML");
          });
      } else {
        // Still refresh suggestions when a timer auto-locks NONE.
        refreshRecommendationsForTurn(currentTurn + 1);
      }

      setCurrentTurn(currentTurn + 1);
      setStagedChampion(null);
    },
    [currentTurn, allLockedNames, refreshRecommendationsForTurn]
  );

  const isDraftFinalized = isFinalized && isDraftComplete;
  const hasMoreGames = gameNumber < config.numGames;

  const handleSwap = useCallback((team: "blue" | "red", index: number) => {
    // Swapping is now allowed even during the draft as long as both slots have champions
    // (though in practice it's most useful when many champions are picked)
    
    if (swapSource) {
      if (swapSource.team === team) {
        if (swapSource.index !== index) {
          // Perform swap within the same team
          const setPicks = team === "blue" ? setBluePicks : setRedPicks;
          setPicks((prev) => {
            const next = [...prev];
            const temp = next[swapSource.index];
            next[swapSource.index] = next[index];
            next[index] = temp;
            return next;
          });
        }
        setSwapSource(null);
      } else {
        // Switch source to the new team/slot
        setSwapSource({ team, index });
      }
    } else {
      // Only allow selecting a non-null pick as source
      const currentPicks = team === "blue" ? bluePicks : redPicks;
      if (currentPicks[index]) {
        setSwapSource({ team, index });
      }
    }
  }, [bluePicks, redPicks, swapSource]);

  const handleNextGame = () => {
    const newLocked = new Set(globalLockedChampions);

    if (config.mode === "Fearless") {
      [...bluePicks, ...redPicks].forEach((c) => {
        if (c && c.name !== "none") newLocked.add(c.name);
      });
    } else if (config.mode === "Ironman") {
      [...blueBans, ...redBans, ...bluePicks, ...redPicks].forEach((c) => {
        if (c && c.name !== "none") newLocked.add(c.name);
      });
    }

    setGlobalLockedChampions(newLocked);
    setGameNumber((prev) => prev + 1);
    lastHandledTurnRef.current = -1;

    // Tell ML we are moving to the next match (preserves Fearless/Ironman carry-over).
    invoke("ml_next_game")
      .then(() => refreshRecommendationsForTurn(0))
      .catch((err) => {
        console.error("Failed to advance ML to next game:", err);
        setMlError("Failed to advance ML to next game");
      });

    setBlueBans(Array(5).fill(null));
    setRedBans(Array(5).fill(null));
    setBluePicks(Array(5).fill(null));
    setRedPicks(Array(5).fill(null));
    setSwapSource(null);
    setIsFinalized(false);
    setCurrentTurn(0);
    setTimeLeft(30);
    setSearchTerm("");
  };

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

  const effectiveBlueBans = useMemo(() => {
    if (!stagedChampion || isDraftComplete) return blueBans;
    const turn = DRAFT_SEQUENCE[currentTurn];
    if (turn.team === "blue" && turn.type === "ban") {
      const next = [...blueBans];
      next[turn.index] = stagedChampion;
      return next;
    }
    return blueBans;
  }, [blueBans, stagedChampion, currentTurn, isDraftComplete]);

  const effectiveRedBans = useMemo(() => {
    if (!stagedChampion || isDraftComplete) return redBans;
    const turn = DRAFT_SEQUENCE[currentTurn];
    if (turn.team === "red" && turn.type === "ban") {
      const next = [...redBans];
      next[turn.index] = stagedChampion;
      return next;
    }
    return redBans;
  }, [redBans, stagedChampion, currentTurn, isDraftComplete]);

  const effectiveBluePicks = useMemo(() => {
    if (!stagedChampion || isDraftComplete) return bluePicks;
    const turn = DRAFT_SEQUENCE[currentTurn];
    if (turn.team === "blue" && turn.type === "pick") {
      const next = [...bluePicks];
      next[turn.index] = stagedChampion;
      return next;
    }
    return bluePicks;
  }, [bluePicks, stagedChampion, currentTurn, isDraftComplete]);

  const effectiveRedPicks = useMemo(() => {
    if (!stagedChampion || isDraftComplete) return redPicks;
    const turn = DRAFT_SEQUENCE[currentTurn];
    if (turn.team === "red" && turn.type === "pick") {
      const next = [...redPicks];
      next[turn.index] = stagedChampion;
      return next;
    }
    return redPicks;
  }, [redPicks, stagedChampion, currentTurn, isDraftComplete]);

  return (
    <div 
      className="flex flex-col h-full w-full p-4 bg-[var(--bg-color)] text-[var(--text-primary)] font-sans box-border relative overflow-hidden"
      style={{ 
        '--team-accent': teamHighlightColor, 
        '--team-accent-shadow': teamHighlightShadow 
      } as React.CSSProperties}
    >
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[var(--brand-primary)] font-black uppercase tracking-[0.2em] bg-[var(--surface-color)] px-6 py-1.5 border border-[var(--border-color)] rounded-full text-xs lg:text-sm z-10">
        Game {gameNumber} / {config.numGames} <span className="mx-2 text-[var(--text-muted)] opacity-30">|</span> {config.mode}
      </div>

      {isDraftFinalized && (
        <div className="absolute inset-0 bg-[var(--bg-color)]/80 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-[var(--surface-color)] p-10 border-2 border-[var(--border-color)] rounded-2xl flex flex-col items-center gap-8 max-w-xl w-full mx-4">
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-4xl font-black uppercase tracking-tight text-white">Draft Complete</h2>
              <div className="h-1 w-16 bg-[var(--brand-primary)] rounded-full" />
            </div>
            
            {hasMoreGames ? (
              <div className="flex flex-col items-center gap-6 w-full">
                <div className="flex items-center gap-8 bg-[var(--bg-color)] p-6 rounded-xl border border-[var(--border-color)] w-full justify-center">
                  <div className="flex flex-col items-center gap-1 min-w-[140px]">
                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">Blue Side</span>
                    <span className="text-xl font-black uppercase tracking-tight text-[var(--accent-blue)]">{isTeam1Blue ? config.team1 : config.team2}</span>
                  </div>
                  
                  <button
                    onClick={() => {
                      const nextIsTeam1Blue = !isTeam1Blue;
                      setIsTeam1Blue(nextIsTeam1Blue);
                      const nextBlue = nextIsTeam1Blue ? config.team1 : config.team2;
                      const nextRed = nextIsTeam1Blue ? config.team2 : config.team1;
                      invoke("ml_set_sides", { blueTeam: nextBlue, redTeam: nextRed })
                        .then(() => refreshRecommendations())
                        .catch((err) => {
                          console.error("Failed to update ML sides:", err);
                          setMlError("Failed to update ML sides");
                        });
                    }}
                    className="p-3 bg-[var(--surface-color)] hover:bg-[var(--surface-color-hover)] border border-[var(--border-color)] rounded-full text-[var(--brand-primary)] transition-all group"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </button>

                  <div className="flex flex-col items-center gap-1 min-w-[140px]">
                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">Red Side</span>
                    <span className="text-xl font-black uppercase tracking-tight text-[var(--accent-red)]">{isTeam1Blue ? config.team2 : config.team1}</span>
                  </div>
                </div>

                <button
                  onClick={handleNextGame}
                  className="group relative bg-[var(--brand-primary)] hover:brightness-110 text-[var(--bg-color)] px-10 py-4 font-black uppercase tracking-[0.2em] rounded-xl transition-all transform active:scale-95 text-sm"
                >
                  Start Game {gameNumber + 1}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6">
                <p className="text-[var(--text-muted)] uppercase tracking-[0.3em] font-black text-xs">Series Finished</p>
                <button
                  onClick={onBack}
                  className="bg-[var(--brand-primary)] hover:brightness-110 text-[var(--bg-color)] px-10 py-4 font-black uppercase tracking-[0.2em] rounded-xl transition-all"
                >
                  Back to Setup
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-1">
        <div className="flex flex-col gap-2">
          <div className="team-name text-base font-black uppercase tracking-tighter text-[var(--accent-blue)] flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[var(--accent-blue)] text-[var(--bg-color)] rounded text-[9px]">BLUE</span>
            {blueTeamName}
          </div>
          <div className="ban-slot-container flex gap-1.5">
            {effectiveBlueBans.map((ban, i) => (
              <BanSlot
                key={i}
                ban={ban}
                team="blue"
                isActive={!isDraftComplete && DRAFT_SEQUENCE[currentTurn].team === "blue" && DRAFT_SEQUENCE[currentTurn].type === "ban" && DRAFT_SEQUENCE[currentTurn].index === i}
                isLowTime={isLowTime && !isDraftComplete && DRAFT_SEQUENCE[currentTurn].team === "blue" && DRAFT_SEQUENCE[currentTurn].type === "ban"}
                animationDuration={blinkDuration}
              />
            ))}
          </div>
          <button
            onClick={onBack}
            className="mt-1 flex items-center justify-center gap-1.5 px-2 py-1 bg-[var(--surface-color)] border border-[var(--border-color)] rounded text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-white hover:border-[var(--text-secondary)] transition-all group w-fit"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-2.5 w-2.5 transform group-hover:-translate-x-1 transition-transform"
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
            Abort
          </button>
        </div>

        <TimerDisplay
          timeLeft={timeLeft}
          currentTurn={currentTurn}
          draftSequence={DRAFT_SEQUENCE}
          blueTeamName={blueTeamName}
          redTeamName={redTeamName}
        />

        <div className="flex flex-col gap-2 items-end">
          <div className="team-name text-base font-black uppercase tracking-tighter text-[var(--accent-red)] flex items-center gap-2">
            {redTeamName}
            <span className="px-2 py-0.5 bg-[var(--accent-red)] text-[var(--bg-color)] rounded text-[9px]">RED</span>
          </div>
          <div className="ban-slot-container flex gap-1.5">
            {effectiveRedBans.map((ban, i) => (
              <BanSlot
                key={i}
                ban={ban}
                team="red"
                isActive={!isDraftComplete && DRAFT_SEQUENCE[currentTurn].team === "red" && DRAFT_SEQUENCE[currentTurn].type === "ban" && DRAFT_SEQUENCE[currentTurn].index === i}
                isLowTime={isLowTime && !isDraftComplete && DRAFT_SEQUENCE[currentTurn].team === "red" && DRAFT_SEQUENCE[currentTurn].type === "ban"}
                animationDuration={blinkDuration}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 justify-between gap-4 min-h-0 w-full">
        <div className="pick-column flex-1 flex flex-col gap-2 min-w-[180px]">
          <div className="scoreboard flex flex-col items-center p-1.5 bg-[var(--surface-color)] border border-[var(--border-color)] rounded-lg mb-[10px] z-10">
            <span className="scoreboard-label text-[9px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">Blue Win Rate</span>
            <span className="scoreboard-value text-lg font-black text-[var(--accent-blue)] tracking-tighter">
              {((mlSuggest?.blue_winrate ?? 0.5) * 100).toFixed(1)}%
            </span>
          </div>
          {effectiveBluePicks.map((pick, i) => (
              <PickSlot
                key={i}
                pick={pick}
                index={i}
                team="blue"
                playerName={getPlayerName("blue", i)}
                isActive={!isDraftComplete && DRAFT_SEQUENCE[currentTurn].team === "blue" && DRAFT_SEQUENCE[currentTurn].type === "pick" && DRAFT_SEQUENCE[currentTurn].index === i}
                isLowTime={isLowTime && !isDraftComplete && DRAFT_SEQUENCE[currentTurn].team === "blue" && DRAFT_SEQUENCE[currentTurn].type === "pick"}
                onClick={() => handleSwap("blue", i)}
                isSwapSource={swapSource?.team === "blue" && swapSource.index === i}
                animationDuration={blinkDuration}
              />
          ))}
        </div>

        <div className="flex-none flex flex-col gap-2 w-[800px] mx-auto">
          <div className="flex flex-col items-end">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[180px] h-[28px] border border-[var(--border-color)] bg-[var(--surface-color)] px-3 text-[11px] focus:outline-none focus:border-[var(--brand-primary)] transition-all rounded-lg uppercase font-black tracking-widest text-[var(--text-primary)] placeholder:text-[var(--text-muted)] placeholder:opacity-50"
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="flex-[2.0] border border-[var(--border-color)] bg-[var(--surface-color)] overflow-y-auto p-3 relative no-scrollbar rounded-xl shadow-inner">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(55px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-3">
              {filteredChampions.map((champ) => (
                <ChampionCard
                  key={champ.id}
                  champion={champ}
                  isSelected={allLockedNames.has(champ.name)}
                  isStaged={stagedChampion?.name === champ.name}
                  onSelect={(c) => setStagedChampion(prev => prev?.name === c.name ? null : c)}
                  highlightColor={teamHighlightColor}
                />
              ))}
            </div>
          </div>
          <button
            onClick={() => stagedChampion && handleSelectChampion(stagedChampion)}
            disabled={!stagedChampion}
            className={`w-full py-2.5 rounded-xl font-black uppercase tracking-[0.2em] text-sm transition-all transform active:scale-[0.98] border-2 ${
              stagedChampion 
                ? "text-[var(--bg-color)] brightness-110" 
                : "bg-[var(--surface-color)] border-[var(--border-color)] text-[var(--text-muted)] cursor-not-allowed opacity-50"
            }`}
            style={stagedChampion ? { 
              backgroundColor: teamHighlightColor, 
              borderColor: teamHighlightColor
            } : {}}
          >
            Lock Champion
          </button>
          <div className="flex-[1.8] border border-[var(--border-color)] bg-[var(--surface-color)] rounded-xl overflow-hidden relative shadow-md">
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

                <div className="recommendation-text flex-1 bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl p-3 text-[17px] leading-relaxed text-[var(--text-secondary)] italic overflow-y-auto no-scrollbar whitespace-pre-line shadow-inner">
                  {selectedRec.rec.tactical || "No detailed analysis available."}
                </div>
              </div>
            ) : (
              <div className="w-full h-full p-2 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--team-accent)] whitespace-nowrap">
                      {suggestContext.label}
                    </span>
                    <div className="flex gap-1 overflow-x-auto no-scrollbar">
                      {UI_ROLES.map((role) => (
                        <button
                          key={role}
                          onClick={() => {
                            setSelectedRole(role);
                          }}
                          className={`px-2 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            selectedRole === role
                              ? "bg-[var(--team-accent)] border-[var(--team-accent)] text-[var(--bg-color)]"
                              : "bg-[var(--surface-color)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-white hover:border-[var(--text-secondary)]"
                          }`}
                          title={role}
                        >
                          <RoleIcon role={role} active={selectedRole === role} />
                          <span className="hidden xl:inline">
                            {role === "MIDDLE" ? "MID" : role === "BOTTOM" ? "ADC" : role === "UTILITY" ? "SUPP" : role}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {mlError && (
                  <div className="text-[var(--accent-red)] text-[10px] font-black uppercase tracking-widest px-1 animate-pulse">
                    ⚠️ {mlError}
                  </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-1 pb-1">
                  {mlSuggest ? (
                    <div className="grid grid-cols-4 lg:grid-cols-6 gap-2">
                      {visibleRecommendations.map(({ rec, champ }) => (
                        <div
                          key={`${selectedRole}-${rec.champion}`}
                          className="group flex flex-col items-center gap-1.5 border border-[var(--border-color)] bg-[var(--bg-color)] rounded-lg p-2 hover:border-[var(--team-accent)] transition-all cursor-pointer hover:bg-[var(--surface-color)] hover:scale-[1.02]"
                          onClick={() => {
                            setSelectedRec({ rec, champ });
                            if (champ) setStagedChampion(champ);
                          }}
                        >
                          <div className="relative">
                            {champ ? (
                              <img
                                src={champ.icon}
                                alt={champ.name}
                                className="w-14 h-14 border-2 border-[var(--border-color)] rounded-lg group-hover:border-[var(--team-accent)] transition-all"
                              />
                            ) : (
                              <div className="w-14 h-14 border-2 border-[var(--border-color)] bg-[var(--surface-color)] rounded-lg" />
                            )}
                            <div className="absolute -top-1 -right-1 bg-[var(--team-accent)] text-[var(--bg-color)] text-[8px] font-black px-1 rounded border border-[var(--bg-color)]">
                              {(rec.score * 100).toFixed(0)}%
                            </div>
                          </div>

                          <div className="w-full text-center">
                            <div className="truncate font-black uppercase tracking-tighter text-[9px] text-[var(--text-secondary)] group-hover:text-white">
                              {champ ? champ.name : rec.champion}
                            </div>
                          </div>
                        </div>
                      ))}

                      {visibleRecommendations.length === 0 && (
                        <div className="col-span-full text-[var(--text-muted)] text-[9px] font-black uppercase tracking-widest text-center py-4 opacity-40">
                          No recommendations
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-[9px] font-black uppercase tracking-widest animate-pulse">
                      Analyzing...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pick-column flex-1 flex flex-col gap-2 min-w-[180px]">
          <div className="scoreboard flex flex-col items-center p-1.5 bg-[var(--surface-color)] border border-[var(--border-color)] rounded-lg mb-[10px] z-10">
            <span className="scoreboard-label text-[9px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">Red Win Rate</span>
            <span className="scoreboard-value text-lg font-black text-[var(--accent-red)] tracking-tighter">
              {((mlSuggest?.red_winrate ?? 0.5) * 100).toFixed(1)}%
            </span>
          </div>
          {effectiveRedPicks.map((pick, i) => (
            <PickSlot
              key={i}
              pick={pick}
              index={i}
              team="red"
              playerName={getPlayerName("red", i)}
              isActive={!isDraftComplete && DRAFT_SEQUENCE[currentTurn].team === "red" && DRAFT_SEQUENCE[currentTurn].type === "pick" && DRAFT_SEQUENCE[currentTurn].index === i}
              isLowTime={isLowTime && !isDraftComplete && DRAFT_SEQUENCE[currentTurn].team === "red" && DRAFT_SEQUENCE[currentTurn].type === "pick"}
              onClick={() => handleSwap("red", i)}
              isSwapSource={swapSource?.team === "red" && swapSource.index === i}
              animationDuration={blinkDuration}
            />
          ))}

          {isDraftComplete && !isFinalized && (
            <div className="mt-auto pt-2 animate-in slide-in-from-bottom-4 duration-500">
              <button
                onClick={() => setIsFinalized(true)}
                className="w-full group relative bg-[var(--brand-primary)] hover:brightness-110 text-[var(--bg-color)] py-4 font-black uppercase tracking-[0.2em] rounded-xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
              >
                <span>Finalize</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Drafter;
