import { Champion } from "../types/draft";

interface BanSlotProps {
  ban: Champion | null;
  isActive?: boolean;
  animationDuration?: string;
}

export function BanSlot({ ban, isActive, animationDuration }: BanSlotProps) {
  return (
    <div className={`w-[45px] h-[45px] lg:w-[55px] lg:h-[55px] border-2 bg-[var(--surface-color)] transition-all duration-300 flex items-center justify-center overflow-hidden shadow-lg ${
      isActive ? "animate-smooth-pulse z-20" : "border-[var(--border-color)] hover:border-[var(--text-muted)]"
    }`}
    style={isActive && animationDuration ? { animationDuration } : {}}
    >
      {ban && (
        <img
          src={ban.icon}
          alt={ban.name}
          className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
        />
      )}
    </div>
  );
}
