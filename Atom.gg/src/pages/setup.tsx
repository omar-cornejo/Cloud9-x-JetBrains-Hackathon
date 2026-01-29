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
      <div className="flex flex-col items-center gap-8 w-full max-w-[320px]">
        <div className={`text-[13px] font-black uppercase tracking-[0.3em] px-6 py-1.5 rounded-full border-2 ${isBlue ? 'text-[var(--accent-blue)] border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 shadow-[0_0_20px_rgba(0,209,255,0.15)]' : 'text-[var(--accent-red)] border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 shadow-[0_0_20px_rgba(255,75,80,0.15)]'}`}>
          {isBlue ? "Blue Side" : "Red Side"}
        </div>
        <div className="flex items-center gap-4 bg-[var(--surface-color)] px-5 py-3 rounded-xl border border-[var(--border-color)] w-full justify-between shadow-lg">
          <button onClick={() => handleLeagueChange(side, -1)} className="text-[var(--accent-blue)] hover:brightness-125 transition-all text-2xl font-black">
            &lt;
          </button>
          <span className="text-[13px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{league}</span>
          <button onClick={() => handleLeagueChange(side, 1)} className="text-[var(--accent-blue)] hover:brightness-125 transition-all text-2xl font-black">
            &gt;
          </button>
        </div>

        <div className="relative group w-full aspect-square flex items-center justify-center">
          <button 
            onClick={() => handleTeamChange(side, -1)}
            className="absolute left-[-30px] z-10 text-[var(--accent-blue)] hover:white transition-all text-4xl font-black opacity-0 group-hover:opacity-100"
          >
            &lt;
          </button>
          
          <div className="relative w-full h-full flex items-center justify-center [perspective:1000px]">
             <div className="w-56 h-56 relative [transform-style:preserve-3d] transition-transform duration-500 hover:[transform:rotateY(15deg)]">
                <img 
                  src={getTeamLogo(currentTeam)} 
                  alt={currentTeam}
                  className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                  style={{
                    transform: 'translateZ(30px)',
                  }}
                />
             </div>
          </div>

          <button 
            onClick={() => handleTeamChange(side, 1)}
            className="absolute right-[-30px] z-10 text-[var(--accent-blue)] hover:white transition-all text-4xl font-black opacity-0 group-hover:opacity-100"
          >
            &gt;
          </button>
        </div>
        
        <div className="text-2xl font-black uppercase tracking-tight text-center h-16 flex items-center text-white">
          {currentTeam}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-color)] text-[var(--text-primary)] p-10 font-sans overflow-hidden relative">
      <button
        onClick={onBack}
        className="absolute top-8 left-8 z-20 flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-white hover:border-[var(--text-secondary)] transition-all group shadow-lg"
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
            strokeWidth={2.5}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Home
      </button>

      <h1 className="text-6xl font-black mb-20 text-center uppercase tracking-tight text-white drop-shadow-[0_0_20px_rgba(0,209,255,0.2)]">
        Draft <span className="text-[var(--accent-blue)]">Setup</span>
      </h1>

      <div className="flex items-center justify-center w-full gap-24 max-w-7xl">
        <TeamSelector side={1} />

        <div className="flex flex-col gap-10 bg-[var(--surface-color)] p-10 rounded-3xl border-2 border-[var(--border-color)] backdrop-blur-md shadow-2xl scale-95 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-[var(--accent-blue)] to-transparent opacity-20" />
          
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setIsTeam1Blue(!isTeam1Blue)}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] hover:text-white hover:border-[var(--accent-blue)] transition-all group shadow-xl"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:rotate-180 transition-transform duration-500 text-[var(--accent-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Swap Sides
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] text-center opacity-60">Ruleset</label>
            <div className="grid grid-cols-3 gap-3">
              {(["Normal", "Fearless", "Ironman"] as GameMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={`py-3 px-5 rounded-lg text-[11px] font-black uppercase tracking-widest border-2 transition-all ${
                    mode === m
                      ? "bg-[var(--accent-blue)] border-[var(--accent-blue)] text-[var(--bg-color)] shadow-[0_10px_20px_rgba(0,209,255,0.2)]"
                      : "bg-[var(--bg-color)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-secondary)]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] text-center opacity-60">Games in Series</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setNumGames(n)}
                  disabled={mode !== "Normal" && n === 1}
                  className={`flex-1 py-3 rounded-lg text-[12px] font-black border-2 transition-all ${
                    numGames === n
                      ? "bg-[var(--accent-blue)] border-[var(--accent-blue)] text-[var(--bg-color)] shadow-[0_10px_20px_rgba(0,209,255,0.2)]"
                      : "bg-[var(--bg-color)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-secondary)]"
                  } ${mode !== "Normal" && n === 1 ? "opacity-10 cursor-not-allowed" : ""}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSameTeam}
            className={`mt-6 font-black py-5 rounded-xl uppercase tracking-[0.3em] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-2xl text-[13px] border-2 ${
              isSameTeam 
                ? "bg-[var(--surface-color)] text-[var(--text-muted)] cursor-not-allowed border-[var(--border-color)] opacity-40" 
                : "bg-[var(--accent-blue)] border-[var(--accent-blue)] hover:brightness-110 text-[var(--bg-color)]"
            }`}
          >
            Launch Drafter
          </button>
          
          {isSameTeam && (
            <p className="text-[11px] text-[var(--accent-red)] font-black uppercase text-center animate-pulse tracking-widest">
              Select different teams
            </p>
          )}
        </div>

        <TeamSelector side={2} />
      </div>
    </div>
  );
}
