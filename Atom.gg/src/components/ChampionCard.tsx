import { Champion } from "../types/draft";

interface ChampionCardProps {
  champion: Champion;
  isSelected: boolean;
  isStaged?: boolean;
  onSelect: (champion: Champion) => void;
}

export function ChampionCard({ champion, isSelected, isStaged, onSelect }: ChampionCardProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 group cursor-pointer ${
        isSelected ? "opacity-20 grayscale pointer-events-none" : ""
      }`}
      onClick={() => onSelect(champion)}
    >
      <div className="relative">
        <img
          src={champion.icon}
          alt={champion.name}
          className={`w-[55px] h-[55px] lg:w-[65px] lg:h-[65px] border-2 transition-all duration-300 rounded-sm ${
            isStaged 
              ? "border-[var(--accent-blue)] scale-110 shadow-[0_0_20px_rgba(0,209,255,0.4)] z-10" 
              : "border-[var(--border-color)] group-hover:border-[var(--text-secondary)]"
          }`}
        />
        {isStaged && (
          <div className="absolute inset-0 bg-[var(--accent-blue)]/10 animate-pulse pointer-events-none" />
        )}
      </div>
      <span className={`text-[12px] text-center truncate w-full transition-colors tracking-tight ${
        isStaged ? "text-[var(--accent-blue)] font-black" : "text-[var(--text-secondary)] group-hover:text-white font-bold"
      }`}>
        {champion.name}
      </span>
    </div>
  );
}
