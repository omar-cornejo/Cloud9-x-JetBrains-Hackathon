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
      <div className="flex flex-col items-center gap-6 w-full max-w-[320px]">
        <div className={`text-sm font-black uppercase tracking-[0.3em] px-6 py-2 rounded-full border-2 ${isBlue ? 'text-[var(--accent-blue)] border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/10' : 'text-[var(--accent-red)] border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10'}`}>
          {isBlue ? "Blue Side" : "Red Side"}
        </div>
        <div className="flex items-center gap-4 bg-[var(--surface-color)] px-4 py-2 rounded-xl border border-[var(--border-color)] w-full justify-between shadow-md transition-all group/league">
          <button onClick={() => handleLeagueChange(side, -1)} className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-all text-2xl font-black">
            &lt;
          </button>
          <span className="text-sm font-black uppercase tracking-[0.2em] text-white">{league}</span>
          <button onClick={() => handleLeagueChange(side, 1)} className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-all text-2xl font-black">
            &gt;
          </button>
        </div>

        <div className="relative group w-full aspect-square flex items-center justify-center">
          <button 
            onClick={() => handleTeamChange(side, -1)}
            className="absolute left-[-40px] z-10 text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-all text-4xl font-black opacity-0 group-hover:opacity-100 transform"
          >
            &lt;
          </button>
          
          <div className="relative w-48 h-48 flex items-center justify-center group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 ease-out">
            <img 
              src={getTeamLogo(currentTeam)} 
              alt={currentTeam}
              className="w-full h-full object-contain"
            />
          </div>

          <button 
            onClick={() => handleTeamChange(side, 1)}
            className="absolute right-[-40px] z-10 text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-all text-4xl font-black opacity-0 group-hover:opacity-100 transform"
          >
            &gt;
          </button>
        </div>
        
        <div className="text-3xl font-black uppercase tracking-tighter text-center h-16 flex items-center text-white">
          {currentTeam}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-color)] text-[var(--text-primary)] p-6 font-sans overflow-hidden relative">
      <button
        onClick={onBack}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 px-4 py-2 bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl text-[13px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-white hover:border-[var(--text-secondary)] transition-all group shadow-lg backdrop-blur-md"
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
        Back
      </button>

      <h1 className="text-6xl font-black mb-10 text-center uppercase tracking-tighter text-white animate-in slide-in-from-top-4 duration-1000">
        Draft <span className="text-[var(--brand-primary)]">Setup</span>
      </h1>

      <div className="flex items-center justify-center w-full gap-12 max-w-[1200px] animate-in fade-in duration-700">
        <TeamSelector side={1} />

        <div className="flex flex-col gap-8 bg-[var(--surface-color)] p-8 rounded-3xl border-2 border-[var(--border-color)] shadow-xl scale-100 relative overflow-hidden group/panel animate-in zoom-in-95 duration-700">
          <div className="flex flex-col gap-3 relative z-10">
            <button
              onClick={() => setIsTeam1Blue(!isTeam1Blue)}
              className="flex items-center justify-center gap-4 px-6 py-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-[13px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] hover:text-white hover:border-[var(--text-secondary)] transition-all group shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform group-hover:rotate-180 transition-transform duration-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Swap Sides
            </button>
          </div>

          <div className="flex flex-col gap-4 relative z-10">
            <label className="text-[12px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] text-center opacity-80">Ruleset</label>
            <div className="grid grid-cols-3 gap-3">
              {(["Normal", "Fearless", "Ironman"] as GameMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={`py-3 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest border-2 transition-all ${
                    mode === m
                      ? "bg-[var(--brand-primary)] border-[var(--brand-primary)] text-[var(--bg-color)]"
                      : "bg-[var(--bg-color)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-secondary)] hover:text-white"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 relative z-10">
            <label className="text-[12px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] text-center opacity-80">Games in Series</label>
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setNumGames(n)}
                  disabled={mode !== "Normal" && n === 1}
                  className={`flex-1 py-3 rounded-xl text-[16px] font-black border-2 transition-all ${
                    numGames === n
                      ? "bg-[var(--brand-primary)] border-[var(--brand-primary)] text-[var(--bg-color)]"
                      : "bg-[var(--bg-color)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-secondary)] hover:text-white"
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
            className={`mt-4 font-black py-5 rounded-2xl uppercase tracking-[0.3em] transition-all transform active:scale-[0.95] text-base border-2 relative z-10 ${
              isSameTeam 
                ? "bg-[var(--surface-color)] text-[var(--text-muted)] cursor-not-allowed border-[var(--border-color)] opacity-40" 
                : "bg-[var(--brand-primary)] border-[var(--brand-primary)] hover:brightness-110 text-[var(--bg-color)] shadow-lg"
            }`}
          >
            Launch Drafter
          </button>
          
          {isSameTeam && (
            <p className="text-[13px] text-[var(--accent-red)] font-black uppercase text-center animate-pulse tracking-[0.2em] relative z-10">
              Select different teams
            </p>
          )}
        </div>

        <TeamSelector side={2} />
      </div>
    </div>
  );
}
