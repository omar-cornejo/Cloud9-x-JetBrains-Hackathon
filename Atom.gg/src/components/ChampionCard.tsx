import { Champion } from "../types/draft";

interface ChampionCardProps {
  champion: Champion;
  isSelected: boolean;
  onSelect: (champion: Champion) => void;
}

export function ChampionCard({ champion, isSelected, onSelect }: ChampionCardProps) {
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
        className="w-[60px] h-[60px] border-2 border-[#333] group-hover:border-[#3498db] transition-colors"
      />
      <span className="text-[10px] text-center truncate w-full text-[#ccc] group-hover:text-white">
        {champion.name}
      </span>
    </div>
  );
}
