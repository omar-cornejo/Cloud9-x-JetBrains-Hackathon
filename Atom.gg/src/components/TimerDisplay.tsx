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
    <div className="flex flex-col items-center justify-center px-8 py-3 lg:px-14 lg:py-5 bg-[#1a1a1a] border-2 border-[#333] shadow-lg mt-2">
      <div
        className={`text-3xl lg:text-4xl font-black leading-none ${
          timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-[#3498db]"
        }`}
      >
        {timeLeft}
      </div>
      <div className="text-[14px] lg:text-[17px] uppercase tracking-[2px] lg:tracking-[4px] text-[#666] font-bold mt-1">
        {!isComplete ? (
          <span>
            <span
              className={
                activeTurn.team === "blue"
                  ? "text-[#3498db]"
                  : "text-[#e74c3c]"
              }
            >
              {activeTurn.team === "blue" ? blueTeamName : redTeamName}
            </span>{" "}
            <span
              className={
                activeTurn.type === "pick"
                  ? "text-[#3498db]"
                  : "text-[#e74c3c]"
              }
            >
              {activeTurn.type}
            </span>
          </span>
        ) : (
          "Complete"
        )}
      </div>
    </div>
  );
}
