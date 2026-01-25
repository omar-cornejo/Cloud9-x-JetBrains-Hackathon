import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface HomeProps {
  onSelectMode: (mode: "simulator" | "client") => void;
}

export function Home({ onSelectMode }: HomeProps) {
  const [isLcuAvailable, setIsLcuAvailable] = useState<boolean | null>(null);
  const [showLcuError, setShowLcuError] = useState(false);

  useEffect(() => {
    const checkLcu = async () => {
      try {
        const available = await invoke<boolean>("is_lcu_available");
        setIsLcuAvailable(available);
      } catch (err) {
        console.error("Failed to check LCU availability:", err);
        setIsLcuAvailable(false);
      }
    };

    checkLcu();
    // Check every 5 seconds to update status if client is opened/closed
    const interval = setInterval(checkLcu, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleClientClick = () => {
    if (isLcuAvailable) {
      onSelectMode("client");
    } else {
      setShowLcuError(true);
      setTimeout(() => setShowLcuError(false), 3000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#121212] text-white p-10 font-sans overflow-hidden">
      <div className="flex flex-col items-center gap-4 mb-16">
        <h1 className="text-8xl font-black text-center uppercase tracking-[0.2em] text-[#3498db] drop-shadow-[0_0_30px_rgba(52,152,219,0.4)]">
          Atom.gg
        </h1>
        <div className="h-1.5 w-32 bg-[#3498db] rounded-full shadow-[0_0_15px_rgba(52,152,219,0.6)]" />
      </div>

      <div className="flex flex-col gap-6 w-full max-w-md">
        <button
          onClick={() => onSelectMode("simulator")}
          className="group relative bg-[#1a1a1a] hover:bg-[#3498db] border-2 border-[#333] hover:border-[#3498db] p-8 rounded-2xl transition-all duration-300 transform hover:scale-[1.05] active:scale-[0.98] shadow-xl overflow-hidden"
        >
          <div className="relative z-10 flex flex-col items-center gap-2">
            <span className="text-2xl font-black uppercase tracking-widest group-hover:text-white transition-colors">
              Draft Simulator
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#666] group-hover:text-white/70 transition-colors">
              Professional Training Tool
            </span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] transition-transform" />
        </button>

        <div className="relative">
          <button
            onClick={handleClientClick}
            className={`group relative w-full border-2 p-8 rounded-2xl transition-all duration-300 transform shadow-xl overflow-hidden ${
              isLcuAvailable 
                ? "bg-[#1a1a1a] hover:bg-[#3498db] border-[#333] hover:border-[#3498db] hover:scale-[1.05] active:scale-[0.98]" 
                : "bg-[#1a1a1a]/50 border-[#222] cursor-not-allowed opacity-60"
            }`}
          >
            <div className="relative z-10 flex flex-col items-center gap-2">
              <span className={`text-2xl font-black uppercase tracking-widest transition-colors ${isLcuAvailable ? "group-hover:text-white" : "text-gray-500"}`}>
                Client Draft
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-[0.3em] transition-colors ${isLcuAvailable ? "text-[#666] group-hover:text-white/70" : "text-gray-600"}`}>
                {isLcuAvailable === false ? "Client Required" : "LCU Integration"}
              </span>
            </div>
            {isLcuAvailable && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] transition-transform" />
            )}
          </button>
          
          {showLcuError && (
            <div className="absolute -bottom-16 left-0 right-0 text-center animate-bounce">
              <span className="text-red-500 text-xs font-bold uppercase tracking-wider">
                To use Atom.gg live drafting, you need to have the LOL client running
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-20 flex gap-8 text-[#333] font-black uppercase tracking-[0.5em] text-[10px]">
        <span>v0.1.0</span>
        <span>•</span>
        <span>Cloud9 x JetBrains</span>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}
