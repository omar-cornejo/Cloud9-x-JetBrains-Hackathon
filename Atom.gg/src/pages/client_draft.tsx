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
      <div className="flex flex-col items-center justify-center h-full w-full bg-[#121212] text-white p-10 font-sans overflow-y-auto">
        <div className="flex flex-col items-center gap-4 mb-8">
          <h1 className="text-6xl font-black text-center uppercase tracking-widest text-[#3498db]">
            Live Draft
          </h1>
          <p className="text-[#666] font-bold uppercase tracking-widest text-center">
            Waiting for Champion Select...
          </p>
        </div>

        <div className="bg-[#1a1a1a] border-2 border-[#333] p-10 rounded-3xl shadow-2xl flex flex-col items-center gap-8 w-full max-w-lg">
          <div className="flex flex-col items-center gap-6 py-10">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-[#3498db]/20 border-t-[#3498db] rounded-full animate-spin"></div>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <p className="text-xl font-bold text-white text-center">
                Live Draft View will load automatically
              </p>
              <p className="text-[#888] text-center">
                Enter a match in the League of Legends client to use atom.gg drafter
              </p>
            </div>
          </div>
        </div>

        <button
            onClick={onBack}
            className="mt-8 text-[#444] hover:text-[#3498db] font-black uppercase tracking-widest transition-colors duration-300"
        >
          ← Back to Home
        </button>
      </div>
  );
}