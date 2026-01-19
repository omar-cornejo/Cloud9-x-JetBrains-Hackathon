import { Champion } from "../types/draft";

interface BanSlotProps {
  ban: Champion | null;
}

export function BanSlot({ ban }: BanSlotProps) {
  return (
    <div className="w-[50px] h-[50px] border-2 border-[#444] bg-[#1e1e1e] transition-colors hover:border-[#888] flex items-center justify-center overflow-hidden">
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
