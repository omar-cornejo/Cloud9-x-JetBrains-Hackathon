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
      <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-color)] text-[var(--text-primary)] p-10 font-sans overflow-y-auto">
        <div className="flex flex-col items-center gap-5 mb-10">
          <h1 className="text-7xl font-black text-center uppercase tracking-tight text-white">
            Live <span className="text-[var(--accent-blue)]">Draft</span>
          </h1>
          <p className="text-[var(--text-muted)] font-black uppercase tracking-[0.3em] text-[11px] opacity-60">
            Scanning for LCU Match Patterns...
          </p>
        </div>

        <div className="bg-[var(--surface-color)] border-2 border-[var(--border-color)] p-12 rounded-3xl shadow-2xl flex flex-col items-center gap-10 w-full max-w-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--accent-blue)] to-transparent opacity-20" />
          <div className="flex flex-col items-center gap-8 py-6">
            <div className="relative">
              <div className="w-24 h-24 border-4 border-[var(--accent-blue)]/10 border-t-[var(--accent-blue)] rounded-full animate-spin shadow-[0_0_30px_rgba(0,209,255,0.15)]"></div>
            </div>
            
            <div className="flex flex-col items-center gap-3">
              <p className="text-2xl font-black text-white text-center uppercase tracking-tight">
                Automatic Integration
              </p>
              <p className="text-[var(--text-secondary)] text-center max-w-sm font-medium leading-relaxed italic">
                The AI drafter will launch as soon as you enter champion select in your League client.
              </p>
            </div>
          </div>
        </div>

        <button
            onClick={onBack}
            className="mt-12 text-[var(--text-muted)] hover:text-[var(--accent-blue)] font-black uppercase tracking-[0.25em] text-[11px] transition-all duration-300 flex items-center gap-3"
        >
          <span className="text-lg">←</span> Back Home
        </button>
      </div>
  );
}