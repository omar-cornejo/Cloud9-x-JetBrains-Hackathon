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
    <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-color)] text-[var(--text-primary)] p-10 font-sans overflow-hidden">
      <div className="flex flex-col items-center gap-4 mb-20">
        <h1 className="text-9xl font-black text-center uppercase tracking-tighter text-white drop-shadow-[0_0_40px_rgba(0,209,255,0.3)]">
          Atom<span className="text-[var(--accent-blue)]">.gg</span>
        </h1>
        <div className="h-2 w-36 bg-[var(--accent-blue)] rounded-full shadow-[0_0_20px_rgba(0,209,255,0.6)]" />
      </div>

      <div className="flex flex-col gap-8 w-full max-w-lg">
        <button
          onClick={() => onSelectMode("simulator")}
          className="group relative bg-[var(--surface-color)] hover:bg-[var(--surface-color-hover)] border-2 border-[var(--border-color)] hover:border-[var(--accent-blue)] p-10 rounded-3xl transition-all duration-300 transform hover:scale-[1.05] active:scale-[0.98] shadow-2xl overflow-hidden"
        >
          <div className="relative z-10 flex flex-col items-center gap-3">
            <span className="text-3xl font-black uppercase tracking-tight text-white group-hover:text-[var(--accent-blue)] transition-colors">
              Draft Simulator
            </span>
            <span className="text-[12px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)] group-hover:text-white transition-colors opacity-60">
              Professional Training Tool
            </span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] transition-transform" />
        </button>

        <div className="relative">
          <button
            onClick={handleClientClick}
            className={`group relative w-full border-2 p-10 rounded-3xl transition-all duration-300 transform shadow-2xl overflow-hidden ${
              isLcuAvailable 
                ? "bg-[var(--surface-color)] hover:bg-[var(--surface-color-hover)] border-[var(--border-color)] hover:border-[var(--accent-blue)] hover:scale-[1.05] active:scale-[0.98]" 
                : "bg-[var(--surface-color)]/50 border-[var(--border-color)] cursor-not-allowed opacity-60"
            }`}
          >
            <div className="relative z-10 flex flex-col items-center gap-3">
              <span className={`text-3xl font-black uppercase tracking-tight transition-colors ${isLcuAvailable ? "text-white group-hover:text-[var(--accent-blue)]" : "text-[var(--text-muted)]"}`}>
                Client Draft
              </span>
              <span className={`text-[12px] font-black uppercase tracking-[0.4em] transition-colors ${isLcuAvailable ? "text-[var(--text-muted)] group-hover:text-white opacity-60" : "text-[var(--text-muted)] opacity-40"}`}>
                {isLcuAvailable === false ? "Client Required" : "LCU Integration"}
              </span>
            </div>
            {isLcuAvailable && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] transition-transform" />
            )}
          </button>
          
          {showLcuError && (
            <div className="absolute -bottom-20 left-0 right-0 text-center animate-bounce">
              <span className="text-[var(--accent-red)] text-[11px] font-black uppercase tracking-widest bg-[var(--surface-color)] px-4 py-2 border border-[var(--accent-red)]/30 rounded-full shadow-lg">
                The League Client must be running
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-24 flex gap-10 text-[var(--text-muted)] font-black uppercase tracking-[0.6em] text-[11px] opacity-30">
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
