import { useState, useMemo } from "react";
import { DraftConfig, GameMode } from "../types/draft";
import { TEAMS, LEAGUES, getTeamLogo } from "../constants/teams";

interface SetupProps {
  onStart: (config: DraftConfig) => void;
  onBack: () => void;
}

export function Setup({ onStart, onBack }: SetupProps) {
  const [league1, setLeague1] = useState(LEAGUES[0]);
  const [team1Index, setTeam1Index] = useState(0);
  
  const [league2, setLeague2] = useState(LEAGUES[0]);
  const [team2Index, setTeam2Index] = useState(0);

  const [mode, setMode] = useState<GameMode>("Normal");
  const [numGames, setNumGames] = useState(1);
  const [isTeam1Blue, setIsTeam1Blue] = useState(true);

  const teams1 = useMemo(() => Object.keys(TEAMS[league1]), [league1]);
  const teams2 = useMemo(() => Object.keys(TEAMS[league2]), [league2]);

  const team1 = teams1[team1Index];
  const team2 = teams2[team2Index];

  const handleLeagueChange = (teamSide: 1 | 2, direction: number) => {
    if (teamSide === 1) {
      const currentIndex = LEAGUES.indexOf(league1);
      const nextIndex = (currentIndex + direction + LEAGUES.length) % LEAGUES.length;
      setLeague1(LEAGUES[nextIndex]);
      setTeam1Index(0);
    } else {
      const currentIndex = LEAGUES.indexOf(league2);
      const nextIndex = (currentIndex + direction + LEAGUES.length) % LEAGUES.length;
      setLeague2(LEAGUES[nextIndex]);
      setTeam2Index(0);
    }
  };

  const handleTeamChange = (teamSide: 1 | 2, direction: number) => {
    if (teamSide === 1) {
      const nextIndex = (team1Index + direction + teams1.length) % teams1.length;
      setTeam1Index(nextIndex);
    } else {
      const nextIndex = (team2Index + direction + teams2.length) % teams2.length;
      setTeam2Index(nextIndex);
    }
  };

  const handleModeChange = (newMode: GameMode) => {
    setMode(newMode);
    if (newMode !== "Normal" && numGames === 1) {
      setNumGames(2);
    }
  };

  const handleSubmit = () => {
    onStart({ team1, team2, isTeam1Blue, mode, numGames });
  };

  const isSameTeam = team1 === team2;

  const TeamSelector = ({ side }: { side: 1 | 2 }) => {
    const league = side === 1 ? league1 : league2;
    const teamIndex = side === 1 ? team1Index : team2Index;
    const teams = side === 1 ? teams1 : teams2;
    const currentTeam = teams[teamIndex];
    const isBlue = (side === 1 && isTeam1Blue) || (side === 2 && !isTeam1Blue);

    return (
      <div className="flex flex-col items-center gap-6 w-full max-w-[300px]">
        <div className={`text-xs font-black uppercase tracking-[0.3em] px-4 py-1 rounded-full border-2 ${isBlue ? 'text-[#3498db] border-[#3498db]/30 bg-[#3498db]/10' : 'text-[#e74c3c] border-[#e74c3c]/30 bg-[#e74c3c]/10'}`}>
          {isBlue ? "Blue Side" : "Red Side"}
        </div>
        <div className="flex items-center gap-4 bg-[#1a1a1a] px-4 py-2 rounded-lg border border-[#333] w-full justify-between">
          <button onClick={() => handleLeagueChange(side, -1)} className="text-[#3498db] hover:text-white transition-colors text-xl font-black">
            &lt;
          </button>
          <span className="text-sm font-black uppercase tracking-widest text-[#666]">{league}</span>
          <button onClick={() => handleLeagueChange(side, 1)} className="text-[#3498db] hover:text-white transition-colors text-xl font-black">
            &gt;
          </button>
        </div>

        <div className="relative group w-full aspect-square flex items-center justify-center">
          <button 
            onClick={() => handleTeamChange(side, -1)}
            className="absolute left-[-20px] z-10 text-[#3498db] hover:text-white transition-colors text-3xl font-black opacity-0 group-hover:opacity-100"
          >
            &lt;
          </button>
          
          <div className="relative w-full h-full flex items-center justify-center [perspective:1000px]">
             <div className="w-48 h-48 relative [transform-style:preserve-3d] transition-transform duration-500 hover:[transform:rotateY(12deg)]">
                <img 
                  src={getTeamLogo(currentTeam)} 
                  alt={currentTeam}
                  className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(52,152,219,0.2)]"
                  style={{
                    transform: 'translateZ(20px)',
                    filter: 'drop-shadow(10px 10px 15px rgba(0,0,0,0.5))'
                  }}
                />
             </div>
          </div>

          <button 
            onClick={() => handleTeamChange(side, 1)}
            className="absolute right-[-20px] z-10 text-[#3498db] hover:text-white transition-colors text-3xl font-black opacity-0 group-hover:opacity-100"
          >
            &gt;
          </button>
        </div>
        
        <div className="text-xl font-black uppercase tracking-widest text-center h-14 flex items-center">
          {currentTeam}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#121212] text-white p-10 font-sans overflow-hidden relative">
      <button
        onClick={onBack}
        className="absolute top-5 left-5 z-20 flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-xs font-bold uppercase tracking-widest text-[#666] hover:text-white hover:border-[#444] transition-all group"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform"
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

      <h1 className="text-5xl font-black mb-16 text-center uppercase tracking-[0.4em] text-[#3498db] drop-shadow-[0_0_15px_rgba(52,152,219,0.3)]">
        Draft Setup
      </h1>

      <div className="flex items-center justify-center w-full gap-20 max-w-7xl">
        <TeamSelector side={1} />

        <div className="flex flex-col gap-8 bg-[#1a1a1a]/50 p-8 rounded-2xl border border-[#333] backdrop-blur-sm scale-90">
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setIsTeam1Blue(!isTeam1Blue)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-[#252525] border border-[#444] rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] text-[#888] hover:text-white hover:border-[#3498db] transition-all group shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Swap Sides
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#666] text-center">Game Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {(["Normal", "Fearless", "Ironman"] as GameMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={`py-2 px-4 rounded text-[10px] font-bold uppercase tracking-widest border transition-all ${
                    mode === m
                      ? "bg-[#3498db] border-[#3498db] text-white shadow-[0_0_15px_rgba(52,152,219,0.3)]"
                      : "bg-[#252525] border-[#444] text-[#888] hover:border-[#666]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#666] text-center">Series</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setNumGames(n)}
                  disabled={mode !== "Normal" && n === 1}
                  className={`flex-1 py-2 rounded text-[10px] font-bold border transition-all ${
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
            disabled={isSameTeam}
            className={`mt-4 font-black py-4 rounded uppercase tracking-[0.3em] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg text-xs ${
              isSameTeam 
                ? "bg-[#222] text-[#444] cursor-not-allowed border border-[#333]" 
                : "bg-[#3498db] hover:bg-[#2980b9] text-white"
            }`}
          >
            Enter Drafter
          </button>
          
          {isSameTeam && (
            <p className="text-[10px] text-[#e74c3c] font-bold uppercase text-center animate-pulse">
              Teams must be different
            </p>
          )}
        </div>

        <TeamSelector side={2} />
      </div>
    </div>
  );
}
