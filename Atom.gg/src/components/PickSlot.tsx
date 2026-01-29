import { Champion } from "../types/draft";

interface PickSlotProps {
  pick: Champion | null;
  ban?: Champion | null;
  index: number;
  team: "blue" | "red";
  playerName?: string;
  isActive?: boolean;
  isLowTime?: boolean;
  onClick?: () => void;
  isSwapSource?: boolean;
  animationDuration?: string;
}

export function PickSlot({ pick, ban, index, team, playerName, isActive, isLowTime, onClick, isSwapSource, animationDuration }: PickSlotProps) {
  const isBlue = team === "blue";
  const borderClass = isBlue ? "border-l-[var(--accent-blue)] border-l-[6px]" : "border-r-[var(--accent-red)] border-r-[6px]";
  const pulseClass = isLowTime
    ? (isBlue ? "animate-intense-pulse-blue" : "animate-intense-pulse-red")
    : (isBlue ? "animate-smooth-pulse-blue" : "animate-smooth-pulse-red");

  return (
      <div
          onClick={onClick}
          className={`pick-slot h-[80px] lg:h-[95px] border-2 bg-[var(--surface-color)] flex items-center ${borderClass} relative group transition-all duration-300 ${
              isActive ? `${pulseClass} z-20` : "border-[var(--border-color)] hover:border-[var(--text-muted)]"
          } ${isSwapSource ? "border-yellow-400 scale-[1.03] z-30 shadow-lg" : ""} ${onClick ? "cursor-pointer" : ""}`}
          style={isActive && animationDuration ? { animationDuration } : {}}
      >
        {ban && (
            <div className={`absolute bottom-0 ${isBlue ? 'right-0 translate-x-1/2 translate-y-1/2' : 'left-0 -translate-x-1/2 translate-y-1/2'} z-20`}>
              <div className="relative w-8 h-8 border-2 border-[var(--accent-red)] rounded-full overflow-hidden bg-[var(--bg-color)]">
                <img
                    src={ban.icon}
                    alt={`Banned ${ban.name}`}
                    className="w-full h-full object-cover grayscale opacity-60"
                />
              </div>
            </div>
        )}

        {pick ? (
            <>
              <img
                  src={pick.splash}
                  alt={pick.name}
                  className={`pick-slot-image absolute inset-0 w-full h-full ${pick.name === 'none' ? 'object-contain p-2' : 'object-cover object-top'} opacity-60 group-hover:opacity-90 transition-all duration-700`}
              />
              <div className={`absolute inset-0 bg-gradient-to-r ${isBlue ? 'from-black/95 via-black/40 to-transparent' : 'from-transparent via-black/40 to-black/95'}`} />
              <div className={`relative z-10 w-full px-4 flex flex-col ${isBlue ? "items-start" : "items-end"}`}>
                {playerName && (
                    <span className={`pick-slot-player text-[10px] font-black uppercase tracking-[0.2em] ${isBlue ? 'text-[var(--accent-blue)]' : 'text-[var(--accent-red)]'} mb-[-2px] opacity-90`}>
                {playerName}
              </span>
                )}
                <span className="truncate uppercase text-lg lg:text-xl font-black tracking-tighter text-white">
              {pick.name}
            </span>
              </div>
            </>
        ) : (
            <div className={`w-full px-4 flex flex-col ${isBlue ? "items-start" : "items-end"}`}>
              {playerName && (
                  <span className={`pick-slot-player text-[10px] font-black uppercase tracking-[0.2em] ${isBlue ? 'text-[var(--accent-blue)]' : 'text-[var(--accent-red)]'} mb-1 opacity-60`}>
              {playerName}
            </span>
              )}
              <span className="text-[var(--text-muted)] uppercase text-[12px] tracking-[0.1em] font-black opacity-40">
            SELECT
          </span>
            </div>
        )}
      </div>
  );
}
