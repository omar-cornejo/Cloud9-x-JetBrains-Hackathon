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
    <div className="flex flex-col items-center justify-center px-8 py-3 lg:px-12 lg:py-4 bg-[var(--surface-color)] border-2 border-[var(--border-color)] mt-1 rounded-xl relative overflow-hidden">
      <div
        className={`text-3xl lg:text-4xl font-black leading-none tracking-tighter transition-all duration-300 ${
          timeLeft <= 10 ? "text-[var(--brand-primary)] animate-pulse" : "text-[var(--brand-primary)]"
        }`}
      >
        {timeLeft}
      </div>
      <div className="text-[11px] lg:text-[12px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-black mt-1">
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
                activeTurn.team === "blue"
                  ? "text-[var(--accent-blue)]"
                  : "text-[var(--accent-red)]"
              }
            >
              {activeTurn.type.toUpperCase()}
            </span>
          </div>
        ) : (
          <span className="text-[var(--brand-primary)] animate-pulse">DRAFT COMPLETE</span>
        )}
      </div>
    </div>
  );
}
