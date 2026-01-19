import { useEffect, useState, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Champion } from "../types/draft";
import { DRAFT_SEQUENCE, NONE_CHAMPION } from "../constants/draft";
import { BanSlot } from "../components/BanSlot";
import { PickSlot } from "../components/PickSlot";
import { ChampionCard } from "../components/ChampionCard";
import { TimerDisplay } from "../components/TimerDisplay";
import "./drafter.css";

function Drafter() {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [blueBans, setBlueBans] = useState<(Champion | null)[]>([
    null,
    null,
    null,
    null,
    null,
  ]);
  const [redBans, setRedBans] = useState<(Champion | null)[]>([
    null,
    null,
    null,
    null,
    null,
  ]);
  const [bluePicks, setBluePicks] = useState<(Champion | null)[]>([
    null,
    null,
    null,
    null,
    null,
  ]);
  const [redPicks, setRedPicks] = useState<(Champion | null)[]>([
    null,
    null,
    null,
    null,
    null,
  ]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);

  const selectedNames = useMemo(() => {
    return new Set(
      [...blueBans, ...redBans, ...bluePicks, ...redPicks]
        .filter((c) => c !== null && c.name !== "none")
        .map((c) => c!.name)
    );
  }, [blueBans, redBans, bluePicks, redPicks]);

  useEffect(() => {
    invoke<Champion[]>("get_all_champions")
      .then((data) => {
        setChampions(data);
      })
      .catch((err) => {
        console.error("Failed to fetch champions:", err);
      });
  }, []);

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

  const handleSelectChampion = useCallback((champion: Champion) => {
    if (currentTurn >= DRAFT_SEQUENCE.length) return;
    if (champion.name !== "none" && selectedNames.has(champion.name)) return;

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
  }, [currentTurn, selectedNames]);

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

  return (
    <div className="flex flex-col h-full w-full p-5 bg-[#121212] text-white font-sans box-border">
      <div className="flex justify-between items-start mb-8">
        <div className="flex flex-col gap-2">
          <div className="text-lg font-bold uppercase tracking-widest">
            Blue team bans
          </div>
          <div className="flex gap-1.5">
            {blueBans.map((ban, i) => (
              <BanSlot key={i} ban={ban} />
            ))}
          </div>
        </div>

        <TimerDisplay
          timeLeft={timeLeft}
          currentTurn={currentTurn}
          draftSequence={DRAFT_SEQUENCE}
        />

        <div className="flex flex-col gap-2">
          <div className="text-lg font-bold uppercase tracking-widest text-right">
            Red team bans
          </div>
          <div className="flex gap-1.5">
            {redBans.map((ban, i) => (
              <BanSlot key={i} ban={ban} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 justify-between gap-8 min-h-0">
        <div className="flex flex-col gap-5 w-[220px]">
          {bluePicks.map((pick, i) => (
            <PickSlot key={i} pick={pick} index={i} team="blue" />
          ))}
        </div>

        <div className="flex-1 flex flex-col gap-5 min-w-0">
          <div className="flex justify-end">
            <input
              type="text"
              placeholder="Search champion..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[200px] h-[35px] border border-[#444] bg-[#252525] px-3 text-sm focus:outline-none focus:border-[#3498db] transition-colors"
            />
          </div>
          <div className="flex-[3] border-2 border-[#333] bg-[#1a1a1a] overflow-y-auto p-4 relative no-scrollbar">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-4">
              {filteredChampions.map((champ) => (
                <ChampionCard
                  key={champ.id}
                  champion={champ}
                  isSelected={selectedNames.has(champ.name)}
                  onSelect={handleSelectChampion}
                />
              ))}
            </div>
          </div>
          <div className="flex-1 border-2 border-[#333] bg-[#1a1a1a] flex items-center justify-center">
            <div className="text-[#666] text-2xl font-bold text-center uppercase tracking-[2px]">
              champion recommendations
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 w-[220px]">
          {redPicks.map((pick, i) => (
            <PickSlot key={i} pick={pick} index={i} team="red" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Drafter;
