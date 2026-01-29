import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LiveChampSelect } from "../components/LiveChampSelect";

interface ClientDraftProps {
  onBack: () => void;
}

export function ClientDraft({ onBack }: ClientDraftProps) {
  const [isLive, setIsLive] = useState(false);
  const [hasLiveSession, setHasLiveSession] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        await invoke("get_champ_select_session");
        setHasLiveSession(true);
        setIsLive(true);
      } catch {
        setHasLiveSession(false);
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 5000);
    return () => clearInterval(interval);
  }, []);

  if (isLive && hasLiveSession) {
    return <LiveChampSelect onBack={() => setIsLive(false)} onHome={onBack} />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-color)] text-[var(--text-primary)] p-6 font-sans overflow-y-auto">
      <div className="flex flex-col items-center gap-3 mb-8">
        <h1 className="text-5xl font-black text-center uppercase tracking-tight text-white">
          Live <span className="text-[var(--brand-primary)]">Draft</span>
        </h1>
        <p className="text-[var(--text-muted)] font-black uppercase tracking-[0.2em] text-[10px] opacity-60">
          Scanning for Match Patterns...
        </p>
      </div>

      <div className="bg-[var(--surface-color)] border-2 border-[var(--border-color)] p-8 rounded-2xl shadow-xl flex flex-col items-center gap-6 w-full max-w-lg relative overflow-hidden">
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-[var(--brand-primary)]/10 border-t-[var(--brand-primary)] rounded-full animate-spin"></div>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <p className="text-xl font-black text-white text-center uppercase tracking-tight">
              Automatic Integration
            </p>
            <p className="text-[var(--text-secondary)] text-center max-w-sm font-medium text-sm italic">
              The AI drafter will launch as soon as you enter champion select.
            </p>
          </div>
        </div>
      </div>

      <button
          onClick={onBack}
          className="mt-8 text-[var(--text-muted)] hover:text-[var(--brand-primary)] font-black uppercase tracking-[0.2em] text-[10px] transition-all duration-300 flex items-center gap-2"
      >
        <span>←</span> Back Home
      </button>
    </div>
  );
}