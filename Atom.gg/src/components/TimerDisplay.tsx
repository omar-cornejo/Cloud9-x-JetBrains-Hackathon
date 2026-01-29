import { DraftTurn } from "../types/draft";

interface TimerDisplayProps {
  timeLeft: number;
  currentTurn: number;
  draftSequence: DraftTurn[];
  blueTeamName: string;
  redTeamName: string;
}

export function TimerDisplay({ 
  timeLeft, 
  currentTurn, 
  draftSequence,
  blueTeamName,
  redTeamName 
}: TimerDisplayProps) {
  const activeTurn = draftSequence[currentTurn];
  const isComplete = currentTurn >= draftSequence.length;

  return (
    <div className="flex flex-col items-center justify-center px-10 py-4 lg:px-16 lg:py-6 bg-[var(--surface-color)] border-2 border-[var(--border-color)] shadow-[0_10px_30px_rgba(0,0,0,0.5)] mt-2 rounded-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--accent-blue)] to-transparent opacity-30" />
      <div
        className={`text-4xl lg:text-5xl font-black leading-none tracking-tighter transition-all duration-300 ${
          timeLeft <= 10 ? "text-[var(--accent-red)] drop-shadow-[0_0_15px_rgba(255,75,80,0.4)] animate-pulse" : "text-[var(--accent-blue)] drop-shadow-[0_0_15px_rgba(0,209,255,0.3)]"
        }`}
      >
        {timeLeft}
      </div>
      <div className="text-[13px] lg:text-[15px] uppercase tracking-[0.25em] text-[var(--text-muted)] font-black mt-2">
        {!isComplete ? (
          <div className="flex items-center gap-2">
            <span
              className={
                activeTurn.team === "blue"
                  ? "text-[var(--accent-blue)]"
                  : "text-[var(--accent-red)]"
              }
            >
              {activeTurn.team === "blue" ? blueTeamName : redTeamName}
            </span>
            <span className="opacity-40">•</span>
            <span
              className={
                activeTurn.type === "pick"
                  ? "text-[var(--accent-blue)]"
                  : "text-[var(--accent-red)]"
              }
            >
              {activeTurn.type.toUpperCase()}
            </span>
          </div>
        ) : (
          <span className="text-[var(--accent-blue)] animate-pulse">DRAFT COMPLETE</span>
        )}
      </div>
    </div>
  );
}
