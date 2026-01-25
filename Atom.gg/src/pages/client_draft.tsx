import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LiveChampSelect } from "../components/LiveChampSelect";

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
  const [championId, setChampionId] = useState<number | null>(null);
  const [banChampionId, setBanChampionId] = useState<number | null>(null);
  const [hoverLoading, setHoverLoading] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [hoverBanLoading, setHoverBanLoading] = useState(false);
  const [lockBanLoading, setLockBanLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [hasLiveSession, setHasLiveSession] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        await invoke("get_champ_select_session");
        setHasLiveSession(true);
      } catch {
        setHasLiveSession(false);
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 5000);
    return () => clearInterval(interval);
  }, []);

  if (isLive) {
    return <LiveChampSelect onBack={() => setIsLive(false)} />;
  }

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

  const pickRandomChampion = async () => {
    try {
      const randomId: number = await invoke("get_random_champion");
      setChampionId(randomId);
      setActionMessage(`Random champion selected: ID ${randomId}`);
      setError(null);
    } catch (err) {
      setError(err as string);
      setActionMessage(null);
    }
  };

  const pickRandomBan = async () => {
    try {
      const randomId: number = await invoke("get_random_champion");
      setBanChampionId(randomId);
      setActionMessage(`Random ban selected: ID ${randomId}`);
      setError(null);
    } catch (err) {
      setError(err as string);
      setActionMessage(null);
    }
  };

  const hoverChampion = async () => {
    if (!championId) {
      setError("Please pick a random champion first");
      return;
    }

    setHoverLoading(true);
    setError(null);
    setActionMessage(null);

    try {
      const message: string = await invoke("hover_champion", { championId });
      setActionMessage(message);
    } catch (err) {
      setError(err as string);
      setActionMessage(null);
    } finally {
      setHoverLoading(false);
    }
  };

  const lockChampion = async () => {
    setLockLoading(true);
    setError(null);
    setActionMessage(null);

    try {
      const message: string = await invoke("lock_champion");
      setActionMessage(message);
      setChampionId(null);
    } catch (err) {
      setError(err as string);
      setActionMessage(null);
    } finally {
      setLockLoading(false);
    }
  };

  const hoverBan = async () => {
    if (!banChampionId) {
      setError("Please pick a random ban first");
      return;
    }

    setHoverBanLoading(true);
    setError(null);
    setActionMessage(null);

    try {
      const message: string = await invoke("hover_ban", { championId: banChampionId });
      setActionMessage(message);
    } catch (err) {
      setError(err as string);
      setActionMessage(null);
    } finally {
      setHoverBanLoading(false);
    }
  };

  const lockBan = async () => {
    setLockBanLoading(true);
    setError(null);
    setActionMessage(null);

    try {
      const message: string = await invoke("lock_ban");
      setActionMessage(message);
      setBanChampionId(null);
    } catch (err) {
      setError(err as string);
      setActionMessage(null);
    } finally {
      setLockBanLoading(false);
    }
  };

  return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[#121212] text-white p-10 font-sans overflow-y-auto">
        <div className="flex flex-col items-center gap-4 mb-8">
          <h1 className="text-6xl font-black text-center uppercase tracking-widest text-[#3498db]">
            Client Draft
          </h1>
          <p className="text-[#666] font-bold uppercase tracking-widest">
            LCU Handshake & Champion Select POC
          </p>
        </div>

        <div className="bg-[#1a1a1a] border-2 border-[#333] p-10 rounded-3xl shadow-2xl flex flex-col items-center gap-8 w-full max-w-lg">
          {/* Live Draft Section */}
          {hasLiveSession && (
            <div className="w-full flex flex-col gap-4">
              <h2 className="text-sm text-[#3498db] uppercase tracking-[0.2em] font-black text-center border-b border-[#3498db]/30 pb-2">
                Live Draft Detected
              </h2>
              <button
                onClick={() => setIsLive(true)}
                className="w-full py-4 rounded-xl font-black uppercase tracking-widest bg-gradient-to-r from-[#3498db] to-[#2ecc71] hover:from-[#2980b9] hover:to-[#27ae60] shadow-[0_0_30px_rgba(52,152,219,0.4)] transition-all duration-300 transform hover:scale-[1.02] active:scale-95 animate-pulse"
              >
                Enter Live Draft View
              </button>
            </div>
          )}

          {/* Connection Test Section */}
          <div className="w-full flex flex-col gap-4">
            <h2 className="text-sm text-[#888] uppercase tracking-widest font-bold text-center border-b border-[#333] pb-2">
              Connection Test
            </h2>
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
          </div>

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

          {/* Champion Select Section */}
          <div className="w-full flex flex-col gap-4 mt-4">
            <h2 className="text-sm text-[#888] uppercase tracking-widest font-bold text-center border-b border-[#333] pb-2">
              Champion Pick Controls
            </h2>

            <button
                onClick={pickRandomChampion}
                className="w-full py-3 rounded-xl font-bold uppercase tracking-wide bg-[#9b59b6] hover:bg-[#8e44ad] transition-all duration-300 transform active:scale-95 shadow-[0_0_15px_rgba(155,89,182,0.3)]"
            >
              🎲 Pick Random Champion
            </button>

            {championId && (
                <div className="bg-[#121212] border border-[#9b59b6] p-3 rounded-xl text-center">
                  <span className="text-sm text-[#888] uppercase">Selected Champion ID</span>
                  <p className="text-2xl font-black text-[#9b59b6]">{championId}</p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button
                  onClick={hoverChampion}
                  disabled={hoverLoading || !championId}
                  className={`py-3 rounded-xl font-bold uppercase tracking-wide transition-all duration-300 transform active:scale-95 ${
                      hoverLoading || !championId
                          ? "bg-[#333] cursor-not-allowed text-[#666]"
                          : "bg-[#e67e22] hover:bg-[#d35400] shadow-[0_0_15px_rgba(230,126,34,0.3)]"
                  }`}
              >
                {hoverLoading ? "Loading" : "Hover"}
              </button>

              <button
                  onClick={lockChampion}
                  disabled={lockLoading}
                  className={`py-3 rounded-xl font-bold uppercase tracking-wide transition-all duration-300 transform active:scale-95 ${
                      lockLoading
                          ? "bg-[#333] cursor-not-allowed text-[#666]"
                          : "bg-[#27ae60] hover:bg-[#229954] shadow-[0_0_15px_rgba(39,174,96,0.3)]"
                  }`}
              >
                {lockLoading ? "Loading" : "Lock"}
              </button>
            </div>
          </div>

          {/* Ban Section */}
          <div className="w-full flex flex-col gap-4 mt-4">
            <h2 className="text-sm text-[#888] uppercase tracking-widest font-bold text-center border-b border-[#333] pb-2">
              Champion Ban Controls
            </h2>

            <button
                onClick={pickRandomBan}
                className="w-full py-3 rounded-xl font-bold uppercase tracking-wide bg-[#c0392b] hover:bg-[#a93226] transition-all duration-300 transform active:scale-95 shadow-[0_0_15px_rgba(192,57,43,0.3)]"
            >
              🎲 Pick Random Ban
            </button>

            {banChampionId && (
                <div className="bg-[#121212] border border-[#c0392b] p-3 rounded-xl text-center">
                  <span className="text-sm text-[#888] uppercase">Selected Ban ID</span>
                  <p className="text-2xl font-black text-[#c0392b]">{banChampionId}</p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button
                  onClick={hoverBan}
                  disabled={hoverBanLoading || !banChampionId}
                  className={`py-3 rounded-xl font-bold uppercase tracking-wide transition-all duration-300 transform active:scale-95 ${
                      hoverBanLoading || !banChampionId
                          ? "bg-[#333] cursor-not-allowed text-[#666]"
                          : "bg-[#e74c3c] hover:bg-[#c0392b] shadow-[0_0_15px_rgba(231,76,60,0.3)]"
                  }`}
              >
                {hoverBanLoading ? "Loading" : "Hover Ban"}
              </button>

              <button
                  onClick={lockBan}
                  disabled={lockBanLoading}
                  className={`py-3 rounded-xl font-bold uppercase tracking-wide transition-all duration-300 transform active:scale-95 ${
                      lockBanLoading
                          ? "bg-[#333] cursor-not-allowed text-[#666]"
                          : "bg-[#8b0000] hover:bg-[#6b0000] shadow-[0_0_15px_rgba(139,0,0,0.3)]"
                  }`}
              >
                {lockBanLoading ? "Loading" : "Lock Ban"}
              </button>
            </div>
          </div>

          {/* Action Message */}
          {actionMessage && (
              <div className="bg-green-900/20 border border-green-500/50 p-4 rounded-xl w-full">
                <p className="text-green-500 text-sm font-bold text-center">{actionMessage}</p>
              </div>
          )}

          {/* Error Message */}
          {error && (
              <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl w-full">
                <p className="text-red-500 text-sm font-bold text-center">{error}</p>
              </div>
          )}
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