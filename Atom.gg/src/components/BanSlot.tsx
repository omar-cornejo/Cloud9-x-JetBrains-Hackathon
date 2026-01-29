import { Champion } from "../types/draft";

interface BanSlotProps {
  ban: Champion | null;
  isActive?: boolean;
}

export function BanSlot({ ban, isActive }: BanSlotProps) {
  return (
    <div className={`w-[40px] h-[40px] lg:w-[50px] lg:h-[50px] border-2 bg-[#1e1e1e] transition-colors flex items-center justify-center overflow-hidden ${
      isActive ? "animate-smooth-pulse z-20" : "border-[#444] hover:border-[#888]"
    }`}>
      {ban && (
        <img
          src={ban.icon}
          alt={ban.name}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}
