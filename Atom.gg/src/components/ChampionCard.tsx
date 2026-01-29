import { Champion } from "../types/draft";

interface ChampionCardProps {
  champion: Champion;
  isSelected: boolean;
  isStaged?: boolean;
  onSelect: (champion: Champion) => void;
  highlightColor?: string;
}

export function ChampionCard({ champion, isSelected, isStaged, onSelect, highlightColor }: ChampionCardProps) {
  const activeColor = highlightColor || "var(--brand-primary)";

  return (
    <div
      className={`flex flex-col items-center gap-1 group cursor-pointer ${
        isSelected ? "opacity-20 grayscale pointer-events-none" : ""
      }`}
      onClick={() => onSelect(champion)}
    >
      <div className="relative">
        <img
          src={champion.icon}
          alt={champion.name}
          className={`w-[45px] h-[45px] lg:w-[50px] lg:h-[50px] border-2 transition-all duration-300 rounded-sm ${
            isStaged 
              ? "scale-105 z-10" 
              : "border-[var(--border-color)] group-hover:border-[var(--text-secondary)]"
          }`}
          style={isStaged ? { borderColor: activeColor } : {}}
        />
      </div>
      <span 
        className={`text-[11px] text-center truncate w-full transition-colors tracking-tight ${
          isStaged ? "font-black" : "text-[var(--text-secondary)] group-hover:text-white font-bold"
        }`}
        style={isStaged ? { color: activeColor } : {}}
      >
        {champion.name}
      </span>
    </div>
  );
}
