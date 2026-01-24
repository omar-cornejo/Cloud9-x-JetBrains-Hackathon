import { Champion } from "../types/draft";

interface PickSlotProps {
  pick: Champion | null;
  index: number;
  team: "blue" | "red";
  playerName?: string;
}

export function PickSlot({ pick, index, team, playerName }: PickSlotProps) {
  const isBlue = team === "blue";
  const borderClass = isBlue ? "border-l-[#3498db] border-l-[5px]" : "border-r-[#e74c3c] border-r-[5px]";

  return (
    <div
      className={`h-[100px] border-2 border-[#333] bg-[#1a1a1a] flex items-center shadow-[0_4px_6px_rgba(0,0,0,0.3)] ${borderClass} relative overflow-hidden group transition-all`}
    >
      {pick ? (
        <>
          <img
            src={pick.splash}
            alt={pick.name}
            className={`absolute inset-0 w-full h-full ${pick.name === 'none' ? 'object-contain p-4' : 'object-cover object-center'} opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500`}
          />
          <div className={`absolute inset-0 bg-gradient-to-r ${isBlue ? 'from-black/90 via-black/40 to-transparent' : 'from-transparent via-black/40 to-black/90'}`} />
          <div className={`relative z-10 w-full px-4 flex flex-col ${isBlue ? "items-start" : "items-end"}`}>
            {playerName && (
              <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isBlue ? 'text-[#3498db]' : 'text-[#e74c3c]'} mb-[-4px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]`}>
                {playerName}
              </span>
            )}
            <span className="truncate uppercase text-lg font-black tracking-tighter text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
              {pick.name}
            </span>
          </div>
        </>
      ) : (
        <div className={`w-full px-4 flex flex-col ${isBlue ? "items-start" : "items-end"}`}>
          {playerName && (
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isBlue ? 'text-[#3498db]' : 'text-[#e74c3c]'} mb-1`}>
              {playerName}
            </span>
          )}
          <span className="text-[#444] uppercase text-xs tracking-widest font-bold">
            champ {index + 1}
          </span>
        </div>
      )}
    </div>
  );
}
