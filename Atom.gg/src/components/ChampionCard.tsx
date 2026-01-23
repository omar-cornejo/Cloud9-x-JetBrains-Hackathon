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
      className={`flex flex-col items-center gap-1 group cursor-pointer ${
        isSelected ? "opacity-20 grayscale pointer-events-none" : ""
      }`}
      onClick={() => onSelect(champion)}
    >
      <img
        src={champion.icon}
        alt={champion.name}
        className={`w-[60px] h-[60px] border-2 transition-all duration-200 ${
          isStaged 
            ? "border-[#3498db] scale-110 shadow-[0_0_15px_rgba(52,152,219,0.5)]" 
            : "border-[#333] group-hover:border-[#3498db]"
        }`}
      />
      <span className={`text-[10px] text-center truncate w-full transition-colors ${
        isStaged ? "text-[#3498db] font-bold" : "text-[#ccc] group-hover:text-white"
      }`}>
        {champion.name}
      </span>
    </div>
  );
}
