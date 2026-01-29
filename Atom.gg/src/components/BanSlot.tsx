import { Champion } from "../types/draft";

interface BanSlotProps {
  ban: Champion | null;
  team: "blue" | "red";
  isActive?: boolean;
  isLowTime?: boolean;
  animationDuration?: string;
}

export function BanSlot({ ban, team, isActive, isLowTime, animationDuration }: BanSlotProps) {
  const isBlue = team === "blue";
  const blinkClass = isLowTime 
    ? (isBlue ? "animate-intense-pulse-blue" : "animate-intense-pulse-red")
    : (isBlue ? "animate-blink-blue" : "animate-blink-red");
  const teamColor = isBlue ? "var(--accent-blue)" : "var(--accent-red)";

  return (
    <div className={`ban-slot w-[42px] h-[42px] lg:w-[48px] lg:h-[48px] border-2 bg-[var(--surface-color)] transition-all duration-300 flex items-center justify-center overflow-hidden ${
      isActive ? `${blinkClass} z-20` : ban ? "" : "border-[var(--border-color)] hover:border-[var(--text-muted)]"
    }`}
    style={{
      ...(isActive && animationDuration ? { animationDuration } : {}),
      ...(ban && !isActive ? { borderColor: teamColor } : {})
    }}
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
