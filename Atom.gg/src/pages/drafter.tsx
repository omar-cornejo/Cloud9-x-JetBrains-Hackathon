import { useEffect, useState, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Champion, DraftConfig, TeamPlayers } from "../types/draft";
import { DRAFT_SEQUENCE, NONE_CHAMPION } from "../constants/draft";
import { BanSlot } from "../components/BanSlot";
import { PickSlot } from "../components/PickSlot";
import { ChampionCard } from "../components/ChampionCard";
import { TimerDisplay } from "../components/TimerDisplay";
import "./drafter.css";

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

  const [blueBans, setBlueBans] = useState<(Champion | null)[]>(Array(5).fill(null));
  const [redBans, setRedBans] = useState<(Champion | null)[]>(Array(5).fill(null));
  const [bluePicks, setBluePicks] = useState<(Champion | null)[]>(Array(5).fill(null));
  const [redPicks, setRedPicks] = useState<(Champion | null)[]>(Array(5).fill(null));

  const [team1Players, setTeam1Players] = useState<TeamPlayers | null>(null);
  const [team2Players, setTeam2Players] = useState<TeamPlayers | null>(null);

  const blueTeamPlayers = isTeam1Blue ? team1Players : team2Players;
  const redTeamPlayers = isTeam1Blue ? team2Players : team1Players;

  const blueTeamName = isTeam1Blue ? config.team1 : config.team2;
  const redTeamName = isTeam1Blue ? config.team2 : config.team1;

  const [currentTurn, setCurrentTurn] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);

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

  useEffect(() => {
    invoke<Champion[]>("get_all_champions")
      .then((data) => {
        setChampions(data);
      })
      .catch((err) => {
        console.error("Failed to fetch champions:", err);
      });

    // Fetch team players
    invoke<TeamPlayers>("get_team_players", { teamName: config.team1 })
      .then((data) => setTeam1Players(data))
      .catch((err) => console.error(`Failed to fetch players for ${config.team1}:`, err));

    invoke<TeamPlayers>("get_team_players", { teamName: config.team2 })
      .then((data) => setTeam2Players(data))
      .catch((err) => console.error(`Failed to fetch players for ${config.team2}:`, err));
  }, [config.team1, config.team2]);

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
      setCurrentTurn((prev) => prev + 1);
      setStagedChampion(null);
    },
    [currentTurn, allLockedNames]
  );

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

    setBlueBans(Array(5).fill(null));
    setRedBans(Array(5).fill(null));
    setBluePicks(Array(5).fill(null));
    setRedPicks(Array(5).fill(null));
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

  const isDraftComplete = currentTurn >= DRAFT_SEQUENCE.length;
  const hasMoreGames = gameNumber < config.numGames;

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

      {isDraftComplete && (
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
                    onClick={() => setIsTeam1Blue(!isTeam1Blue)}
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
              <BanSlot key={i} ban={ban} />
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
              <BanSlot key={i} ban={ban} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 justify-between gap-8 min-h-0">
        <div className="flex flex-col gap-5 w-[220px]">
          {effectiveBluePicks.map((pick, i) => (
            <PickSlot
              key={i}
              pick={pick}
              index={i}
              team="blue"
              playerName={getPlayerName("blue", i)}
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
            <div className="text-[#333] text-2xl font-black text-center uppercase tracking-[0.3em]">
              Recommendations
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 w-[220px]">
          {effectiveRedPicks.map((pick, i) => (
            <PickSlot
              key={i}
              pick={pick}
              index={i}
              team="red"
              playerName={getPlayerName("red", i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Drafter;
