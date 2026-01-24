import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Summoner {
  accountId: number;
  displayName: string;
  gameName: string;
  puuid: string;
  summonerId: number;
  summonerLevel: number;
  tagLine: string;
}

interface ClientDraftProps {
  onBack: () => void;
}

export function ClientDraft({ onBack }: ClientDraftProps) {
  const [summoner, setSummoner] = useState<Summoner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    setSummoner(null);
    try {
      const data: Summoner = await invoke("get_current_summoner");
      setSummoner(data);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#121212] text-white p-10 font-sans">
      <div className="flex flex-col items-center gap-4 mb-12">
        <h1 className="text-6xl font-black text-center uppercase tracking-widest text-[#3498db]">
          Client Draft
        </h1>
        <p className="text-[#666] font-bold uppercase tracking-widest">
          LCU Handshake Test
        </p>
      </div>

      <div className="bg-[#1a1a1a] border-2 border-[#333] p-10 rounded-3xl shadow-2xl flex flex-col items-center gap-8 w-full max-w-lg">
        <button
          onClick={testConnection}
          disabled={loading}
          className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all duration-300 transform active:scale-95 ${
            loading
              ? "bg-[#333] cursor-not-allowed"
              : "bg-[#3498db] hover:bg-[#2980b9] shadow-[0_0_20px_rgba(52,152,219,0.3)]"
          }`}
        >
          {loading ? "Connecting..." : "Test Lockfile Connection"}
        </button>

        {summoner && (
          <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300 w-full">
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm text-[#666] uppercase tracking-widest font-bold">Connected as</span>
              <span className="text-3xl font-black text-white">
                {summoner.gameName}
                <span className="text-[#3498db]">#{summoner.tagLine}</span>
              </span>
              {summoner.displayName && summoner.displayName !== summoner.gameName && (
                 <span className="text-lg text-[#888]">({summoner.displayName})</span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 w-full mt-4 p-4 bg-[#121212] rounded-2xl border border-[#333]">
              <div className="flex flex-col">
                <span className="text-[10px] text-[#666] uppercase font-bold">Level</span>
                <span className="text-xl font-bold">{summoner.summonerLevel}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[#666] uppercase font-bold">Summoner ID</span>
                <span className="text-sm font-mono text-[#888] truncate">{summoner.summonerId}</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl w-full">
            <p className="text-red-500 text-sm font-bold text-center">{error}</p>
          </div>
        )}
      </div>

      <button
        onClick={onBack}
        className="mt-12 text-[#444] hover:text-[#3498db] font-black uppercase tracking-widest transition-colors duration-300"
      >
        ← Back to Home
      </button>
    </div>
  );
}
