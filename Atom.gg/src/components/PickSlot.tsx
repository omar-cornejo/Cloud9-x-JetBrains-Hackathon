import { Champion } from "../types/draft";

interface PickSlotProps {
  pick: Champion | null;
  ban?: Champion | null;
  index: number;
  team: "blue" | "red";
  playerName?: string;
  isActive?: boolean;
  onClick?: () => void;
  isSwapSource?: boolean;
  animationDuration?: string;
}

export function PickSlot({ pick, ban, index, team, playerName, isActive, onClick, isSwapSource, animationDuration }: PickSlotProps) {
  const isBlue = team === "blue";
  const borderClass = isBlue ? "border-l-[var(--accent-blue)] border-l-[6px]" : "border-r-[var(--accent-red)] border-r-[6px]";

  return (
      <div
          onClick={onClick}
          className={`h-[90px] lg:h-[110px] border-2 bg-[var(--surface-color)] flex items-center shadow-[0_8px_16px_rgba(0,0,0,0.4)] ${borderClass} relative group transition-all duration-300 ${
              isActive ? "animate-smooth-pulse z-20" : "border-[var(--border-color)] hover:border-[var(--text-muted)]"
          } ${isSwapSource ? "border-yellow-400 scale-[1.03] z-30 shadow-[0_0_25px_rgba(250,204,21,0.3)]" : ""} ${onClick ? "cursor-pointer" : ""}`}
          style={isActive && animationDuration ? { animationDuration } : {}}
      >
        {ban && (
            <div className={`absolute bottom-0 ${isBlue ? 'right-0 translate-x-1/2 translate-y-1/2' : 'left-0 -translate-x-1/2 translate-y-1/2'} z-20`}>
              <div className="relative w-10 h-10 border-2 border-[var(--accent-red)] rounded-full overflow-hidden bg-[var(--bg-color)] shadow-xl transform group-hover:scale-110 transition-transform duration-300">
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
                  className={`absolute inset-0 w-full h-full ${pick.name === 'none' ? 'object-contain p-4' : 'object-cover object-top'} opacity-60 group-hover:opacity-90 group-hover:scale-[1.02] transition-all duration-700`}
              />
              <div className={`absolute inset-0 bg-gradient-to-r ${isBlue ? 'from-black/95 via-black/40 to-transparent' : 'from-transparent via-black/40 to-black/95'}`} />
              <div className={`relative z-10 w-full px-5 flex flex-col ${isBlue ? "items-start" : "items-end"}`}>
                {playerName && (
                    <span className={`text-[11px] font-black uppercase tracking-[0.25em] ${isBlue ? 'text-[var(--accent-blue)]' : 'text-[var(--accent-red)]'} mb-[-2px] drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] opacity-90`}>
                {playerName}
              </span>
                )}
                <span className="truncate uppercase text-xl lg:text-2xl font-black tracking-tighter text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.9)]">
              {pick.name}
            </span>
              </div>
            </>
        ) : (
            <div className={`w-full px-5 flex flex-col ${isBlue ? "items-start" : "items-end"}`}>
              {playerName && (
                  <span className={`text-[11px] font-black uppercase tracking-[0.25em] ${isBlue ? 'text-[var(--accent-blue)]' : 'text-[var(--accent-red)]'} mb-1 opacity-60`}>
              {playerName}
            </span>
              )}
              <span className="text-[var(--text-muted)] uppercase text-[13px] tracking-[0.15em] font-black opacity-40">
            SELECT CHAMPION
          </span>
            </div>
        )}
      </div>
  );
}
