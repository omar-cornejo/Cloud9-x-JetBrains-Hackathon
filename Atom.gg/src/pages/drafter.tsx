import { useEffect, useState, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Champion, DraftConfig, TeamPlayers } from "../types/draft";
import type { MlRole, MlSuggestPayload, MlResponse, MlRecommendation } from "../types/ml";
import { DRAFT_SEQUENCE, NONE_CHAMPION } from "../constants/draft";
import { BanSlot } from "../components/BanSlot";
import { PickSlot } from "../components/PickSlot";
import { ChampionCard } from "../components/ChampionCard";
import { TimerDisplay } from "../components/TimerDisplay";
import "./drafter.css";

const ALL_ROLES: MlRole[] = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const UI_ROLES: MlRole[] = ["ALL", ...ALL_ROLES];

function roleIconUrl(role: MlRole): string {
  const lane =
    role === "TOP" ? "top" :
    role === "JUNGLE" ? "jungle" :
    role === "MIDDLE" ? "middle" :
    role === "BOTTOM" ? "bottom" :
    role === "UTILITY" ? "utility" :
    "fill";
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${lane}.png`;
}

function RoleIcon({ role, active }: { role: MlRole; active: boolean }) {
  return (
    <img
      src={roleIconUrl(role)}
      alt={role}
      className={`w-6 h-6 rounded ${active ? "opacity-100" : "opacity-70"}`}
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
  const [gameNumber, setGameNumber] = useState(1);
  const [isTeam1Blue, setIsTeam1Blue] = useState(config.isTeam1Blue);
  const [globalLockedChampions, setGlobalLockedChampions] = useState<Set<string>>(new Set());

  const [selectedRole, setSelectedRole] = useState<MlRole>("ALL");
  const [mlSuggest, setMlSuggest] = useState<MlSuggestPayload | null>(null);
  const [mlError, setMlError] = useState<string | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);

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

    const label = isBanMode ? "Ban Suggestions" : "Pick Suggestions";
    return { isBanMode, mySide, analyzeSide, label };
  }, [currentTurn]);

  const refreshRecommendationsForTurn = useCallback(async (idx: number) => {
    try {
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

    return recs
      .map((rec) => ({ rec, champ: resolveChampion(rec.champion) }))
      .filter(({ champ }) => !champ || !allLockedNames.has(champ.name));
  }, [mlSuggest, selectedRole, resolveChampion, allLockedNames]);

  useEffect(() => {
    invoke<Champion[]>("get_all_champions")
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
          handleSelectChampion(NONE_CHAMPION);
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
      if (champion.name !== "none" && allLockedNames.has(champion.name)) return;

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

      setCurrentTurn((prev) => prev + 1);
      setStagedChampion(null);
    },
    [currentTurn, allLockedNames, refreshRecommendationsForTurn]
  );

  const isDraftComplete = currentTurn >= DRAFT_SEQUENCE.length;
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
    <div className="flex flex-col h-full w-full p-5 bg-[#121212] text-white font-sans box-border relative overflow-hidden">
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-[#3498db] font-black uppercase tracking-[0.2em] bg-[#1a1a1a] px-6 py-1.5 border-2 border-[#333] rounded-full text-xs shadow-xl z-10">
        Game {gameNumber} / {config.numGames} <span className="mx-2 text-[#444]">|</span> {config.mode} Mode
      </div>

      {isDraftFinalized && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-[#1a1a1a] p-12 border-2 border-[#3498db] rounded-2xl flex flex-col items-center gap-8 shadow-[0_0_50px_rgba(52,152,219,0.2)]">
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-4xl font-black uppercase tracking-[0.1em]">Draft Complete</h2>
              <div className="h-1 w-20 bg-[#3498db] rounded-full" />
            </div>
            
            {hasMoreGames ? (
              <div className="flex flex-col items-center gap-6">
                <div className="flex items-center gap-8 bg-[#252525] p-6 rounded-xl border border-[#333]">
                  <div className="flex flex-col items-center gap-2 min-w-[150px]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#666]">Blue Side</span>
                    <span className="text-xl font-black uppercase tracking-widest text-[#3498db]">{isTeam1Blue ? config.team1 : config.team2}</span>
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
                    className="p-3 bg-[#1a1a1a] hover:bg-[#333] border border-[#444] rounded-full text-[#3498db] transition-all group"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </button>

                  <div className="flex flex-col items-center gap-2 min-w-[150px]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#666]">Red Side</span>
                    <span className="text-xl font-black uppercase tracking-widest text-[#e74c3c]">{isTeam1Blue ? config.team2 : config.team1}</span>
                  </div>
                </div>

                <button
                  onClick={handleNextGame}
                  className="group relative bg-[#3498db] hover:bg-[#2980b9] text-white px-12 py-5 font-black uppercase tracking-[0.2em] rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(52,152,219,0.3)]"
                >
                  Start Game {gameNumber + 1}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6">
                <p className="text-[#666] uppercase tracking-[0.3em] font-bold text-sm">Series Finished</p>
                <button
                  onClick={onBack}
                  className="bg-[#3498db] hover:bg-[#2980b9] text-white px-12 py-5 font-black uppercase tracking-[0.2em] rounded-lg transition-all"
                >
                  Back to Setup
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-8">
        <div className="flex flex-col gap-2">
          <div className="text-lg font-bold uppercase tracking-widest text-[#3498db]">
            {blueTeamName} <span className="text-[#666]">bans</span>
          </div>
          <div className="flex gap-1.5">
            {effectiveBlueBans.map((ban, i) => (
              <BanSlot
                key={i}
                ban={ban}
                isActive={!isDraftComplete && DRAFT_SEQUENCE[currentTurn].team === "blue" && DRAFT_SEQUENCE[currentTurn].type === "ban" && DRAFT_SEQUENCE[currentTurn].index === i}
              />
            ))}
          </div>
          <button
            onClick={onBack}
            className="mt-2 flex items-center justify-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-[10px] font-bold uppercase tracking-widest text-[#666] hover:text-white hover:border-[#444] transition-all group w-fit"
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
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
        </div>

        <TimerDisplay
          timeLeft={timeLeft}
          currentTurn={currentTurn}
          draftSequence={DRAFT_SEQUENCE}
          blueTeamName={blueTeamName}
          redTeamName={redTeamName}
        />

        <div className="flex flex-col gap-2">
          <div className="text-lg font-bold uppercase tracking-widest text-right text-[#e74c3c]">
            {redTeamName} <span className="text-[#666]">bans</span>
          </div>
          <div className="flex gap-1.5">
            {effectiveRedBans.map((ban, i) => (
              <BanSlot
                key={i}
                ban={ban}
                isActive={!isDraftComplete && DRAFT_SEQUENCE[currentTurn].team === "red" && DRAFT_SEQUENCE[currentTurn].type === "ban" && DRAFT_SEQUENCE[currentTurn].index === i}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 justify-between gap-8 min-h-0">
        <div className="flex flex-col gap-5 w-[220px]">
          {mlSuggest && typeof mlSuggest.blue_winrate === "number" && (
            <div className="flex flex-col items-center p-2 bg-[#1a1a1a] border border-[#333] rounded-lg mb-[-10px]">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#666]">Blue Winrate</span>
              <span className="text-xl font-black text-[#3498db]">{(mlSuggest.blue_winrate * 100).toFixed(1)}%</span>
            </div>
          )}
          {effectiveBluePicks.map((pick, i) => (
              <PickSlot
                key={i}
                pick={pick}
                index={i}
                team="blue"
                playerName={getPlayerName("blue", i)}
                isActive={!isDraftComplete && DRAFT_SEQUENCE[currentTurn].team === "blue" && DRAFT_SEQUENCE[currentTurn].type === "pick" && DRAFT_SEQUENCE[currentTurn].index === i}
                onClick={() => handleSwap("blue", i)}
                isSwapSource={swapSource?.team === "blue" && swapSource.index === i}
              />
          ))}
        </div>

        <div className="flex-1 flex flex-col gap-5 min-w-0">
          <div className="flex flex-col items-end gap-3">
            <input
              type="text"
              placeholder="Search champion..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[200px] h-[40px] border border-[#444] bg-[#252525] px-4 text-sm focus:outline-none focus:border-[#3498db] transition-colors rounded-lg uppercase font-bold tracking-widest"
            />
          </div>
          <div className="flex-[3] border-2 border-[#333] bg-[#1a1a1a] overflow-y-auto p-4 relative no-scrollbar rounded-lg shadow-inner">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-4">
              {filteredChampions.map((champ) => (
                <ChampionCard
                  key={champ.id}
                  champion={champ}
                  isSelected={allLockedNames.has(champ.name)}
                  isStaged={stagedChampion?.name === champ.name}
                  onSelect={(c) => setStagedChampion(prev => prev?.name === c.name ? null : c)}
                />
              ))}
            </div>
          </div>
          <button
            onClick={() => stagedChampion && handleSelectChampion(stagedChampion)}
            disabled={!stagedChampion}
            className={`w-full py-3 rounded-lg font-black uppercase tracking-[0.2em] transition-all transform active:scale-95 ${
              stagedChampion 
                ? "bg-[#3498db] hover:bg-[#2980b9] text-white shadow-[0_0_20px_rgba(52,152,219,0.3)]" 
                : "bg-[#222] text-[#444] cursor-not-allowed border border-[#333]"
            }`}
          >
            Confirm
          </button>
          <div className="flex-1 border-2 border-[#333] bg-[#1a1a1a] flex items-center justify-center rounded-lg">
            <div className="w-full h-full p-4 flex flex-col gap-3">
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

              {mlSuggest && (
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#444]">
                  ML: {mlSuggest.target_side} {mlSuggest.is_ban_mode ? "BAN" : "PICK"}
                </div>
              )}

              {mlSuggest && typeof mlSuggest.blue_winrate === "number" && typeof mlSuggest.red_winrate === "number" && (
                <div className="text-[10px] font-black uppercase tracking-widest text-[#555]">
                  Winrate: <span className="text-[#3498db]">{blueTeamName}</span> {(mlSuggest.blue_winrate * 100).toFixed(1)}% |{" "}
                  <span className="text-[#e74c3c]">{redTeamName}</span> {(mlSuggest.red_winrate * 100).toFixed(1)}%
                </div>
              )}

              <div className="flex gap-2">
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
                  >
                    <RoleIcon role={role} active={selectedRole === role} />
                    {role === "MIDDLE" ? "MID" : role === "BOTTOM" ? "ADC" : role === "UTILITY" ? "SUPPORT" : role === "ALL" ? "TODOS" : role}
                  </button>
                ))}
              </div>

              {mlError && (
                <div className="text-[#e74c3c] text-xs font-bold uppercase tracking-widest">
                  {mlError}
                </div>
              )}

              <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
                {mlSuggest ? (
                  <div className="flex flex-col gap-2">
                    {visibleRecommendations.map(({ rec, champ }) => {
                      return (
                        <div
                          key={`${selectedRole}-${rec.champion}`}
                          className="flex items-center gap-3 border border-[#333] bg-[#141414] rounded-lg p-3 hover:border-[#3498db] transition-colors cursor-pointer"
                          onClick={() => {
                            if (champ) {
                              setStagedChampion((prev) => (prev?.name === champ.name ? null : champ));
                            }
                          }}
                        >
                          {champ ? (
                            <img
                              src={champ.icon}
                              alt={champ.name}
                              className="w-10 h-10 border border-[#333]"
                            />
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
                      );
                    })}

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
          </div>
        </div>

        <div className="flex flex-col gap-5 w-[220px]">
          {mlSuggest && typeof mlSuggest.red_winrate === "number" && (
            <div className="flex flex-col items-center p-2 bg-[#1a1a1a] border border-[#333] rounded-lg mb-[-10px]">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#666]">Red Winrate</span>
              <span className="text-xl font-black text-[#e74c3c]">{(mlSuggest.red_winrate * 100).toFixed(1)}%</span>
            </div>
          )}
          {effectiveRedPicks.map((pick, i) => (
            <PickSlot
              key={i}
              pick={pick}
              index={i}
              team="red"
              playerName={getPlayerName("red", i)}
              isActive={!isDraftComplete && DRAFT_SEQUENCE[currentTurn].team === "red" && DRAFT_SEQUENCE[currentTurn].type === "pick" && DRAFT_SEQUENCE[currentTurn].index === i}
              onClick={() => handleSwap("red", i)}
              isSwapSource={swapSource?.team === "red" && swapSource.index === i}
            />
          ))}
        </div>
      </div>

      {isDraftComplete && !isFinalized && (
        <div className="absolute bottom-8 right-8 z-40 animate-in slide-in-from-bottom-4 duration-500">
          <button
            onClick={() => setIsFinalized(true)}
            className="group relative bg-[#3498db] hover:bg-[#2980b9] text-white px-8 py-4 font-black uppercase tracking-[0.2em] rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(52,152,219,0.4)] flex items-center gap-3"
          >
            <span>Finalize Draft</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default Drafter;
