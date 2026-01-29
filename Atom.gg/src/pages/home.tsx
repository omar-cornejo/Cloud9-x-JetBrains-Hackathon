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
    <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-color)] text-[var(--text-primary)] p-6 font-sans overflow-hidden">
      <div className="flex flex-col items-center gap-3 mb-12">
        <h1 className="text-7xl font-black text-center uppercase tracking-tighter text-white">
          Atom<span className="text-[var(--brand-primary)]">.gg</span>
        </h1>
        <div className="h-1.5 w-24 bg-[var(--brand-primary)] rounded-full" />
      </div>

      <div className="flex flex-col gap-6 w-full max-w-md">
        <button
          onClick={() => onSelectMode("simulator")}
          className="group relative bg-[var(--surface-color)] hover:bg-[var(--surface-color-hover)] border-2 border-[var(--border-color)] hover:border-[var(--brand-primary)] p-6 rounded-2xl transition-all duration-300 transform active:scale-[0.98] shadow-lg overflow-hidden"
        >
          <div className="relative z-10 flex flex-col items-center gap-2">
            <span className="text-2xl font-black uppercase tracking-tight text-white group-hover:text-[var(--brand-primary)] transition-colors">
              Draft Simulator
            </span>
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] group-hover:text-white transition-colors opacity-60">
              Professional Training Tool
            </span>
          </div>
        </button>

        <div className="relative">
          <button
            onClick={handleClientClick}
            className={`group relative w-full border-2 p-6 rounded-2xl transition-all duration-300 transform shadow-lg overflow-hidden ${
              isLcuAvailable 
                ? "bg-[var(--surface-color)] hover:bg-[var(--surface-color-hover)] border-[var(--border-color)] hover:border-[var(--brand-primary)] active:scale-[0.98]" 
                : "bg-[var(--surface-color)]/50 border-[var(--border-color)] cursor-not-allowed opacity-60"
            }`}
          >
            <div className="relative z-10 flex flex-col items-center gap-2">
              <span className={`text-2xl font-black uppercase tracking-tight transition-colors ${isLcuAvailable ? "text-white group-hover:text-[var(--brand-primary)]" : "text-[var(--text-muted)]"}`}>
                Client Draft
              </span>
              <span className={`text-[11px] font-black uppercase tracking-[0.3em] transition-colors ${isLcuAvailable ? "text-[var(--text-muted)] group-hover:text-white opacity-60" : "text-[var(--text-muted)] opacity-40"}`}>
                {isLcuAvailable === false ? "Client Required" : "LCU Integration"}
              </span>
            </div>
          </button>
          
          {showLcuError && (
            <div className="absolute -bottom-12 left-0 right-0 text-center animate-bounce">
              <span className="text-[var(--accent-red)] text-[10px] font-black uppercase tracking-widest bg-[var(--surface-color)] px-4 py-2 border border-[var(--accent-red)]/30 rounded-full shadow-lg">
                The League Client must be running
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 flex gap-8 text-[var(--text-muted)] font-black uppercase tracking-[0.4em] text-[10px] opacity-30">
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
