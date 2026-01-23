import { useState } from "react";
import { DraftConfig, GameMode } from "../types/draft";

interface SetupProps {
  onStart: (config: DraftConfig) => void;
}

export function Setup({ onStart }: SetupProps) {
  const [team1, setTeam1] = useState("Team 1");
  const [team2, setTeam2] = useState("Team 2");
  const [mode, setMode] = useState<GameMode>("Normal");
  const [numGames, setNumGames] = useState(1);

  const handleModeChange = (newMode: GameMode) => {
    setMode(newMode);
    if (newMode !== "Normal" && numGames === 1) {
      setNumGames(2);
    }
  };

  const handleSubmit = () => {
    onStart({ team1, team2, mode, numGames });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#121212] text-white p-10 font-sans">
      <div className="bg-[#1a1a1a] p-10 rounded-xl border-2 border-[#333] w-full max-w-lg shadow-2xl">
        <h1 className="text-4xl font-black mb-10 text-center uppercase tracking-[0.2em] text-[#3498db]">
          Draft Setup
        </h1>

        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#666]">Blue Team</label>
              <input
                type="text"
                value={team1}
                onChange={(e) => setTeam1(e.target.value)}
                className="bg-[#252525] border border-[#444] p-3 rounded text-sm focus:outline-none focus:border-[#3498db] transition-colors"
                placeholder="Enter team name..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#666]">Red Team</label>
              <input
                type="text"
                value={team2}
                onChange={(e) => setTeam2(e.target.value)}
                className="bg-[#252525] border border-[#444] p-3 rounded text-sm focus:outline-none focus:border-[#3498db] transition-colors"
                placeholder="Enter team name..."
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[#666]">Game Mode</label>
            <div className="grid grid-cols-3 gap-3">
              {(["Normal", "Fearless", "Ironman"] as GameMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={`py-3 rounded text-sm font-bold uppercase tracking-widest border-2 transition-all ${
                    mode === m
                      ? "bg-[#3498db] border-[#3498db] text-white shadow-[0_0_15px_rgba(52,152,219,0.3)]"
                      : "bg-[#252525] border-[#444] text-[#888] hover:border-[#666]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#555] italic text-center mt-1">
              {mode === "Normal" && "Standard bans and picks for each game independently."}
              {mode === "Fearless" && "Champions picked in previous games cannot be picked again."}
              {mode === "Ironman" && "Champions picked or banned in previous games are locked out."}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[#666]">Series Length (Best of)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setNumGames(n)}
                  disabled={mode !== "Normal" && n === 1}
                  className={`flex-1 py-3 rounded text-sm font-bold border-2 transition-all ${
                    numGames === n
                      ? "bg-[#3498db] border-[#3498db] text-white shadow-[0_0_15px_rgba(52,152,219,0.3)]"
                      : "bg-[#252525] border-[#444] text-[#888] hover:border-[#666]"
                  } ${mode !== "Normal" && n === 1 ? "opacity-20 cursor-not-allowed" : ""}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            className="mt-6 bg-[#3498db] hover:bg-[#2980b9] text-white font-black py-4 rounded uppercase tracking-[0.3em] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
          >
            Enter Drafter
          </button>
        </div>
      </div>
    </div>
  );
}
