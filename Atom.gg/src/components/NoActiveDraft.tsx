interface NoActiveDraftProps {
  onHome: () => void;
}

export function NoActiveDraft({ onHome }: NoActiveDraftProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#121212] text-white p-10 font-sans overflow-hidden">
      <div className="flex flex-col items-center gap-4 mb-12">
        <h1 className="text-6xl font-black text-center uppercase tracking-[0.2em] text-[#3498db] drop-shadow-[0_0_30px_rgba(52,152,219,0.4)]">
          Draft Ended
        </h1>
        <div className="h-1.5 w-24 bg-[#3498db] rounded-full shadow-[0_0_15px_rgba(52,152,219,0.6)]" />
      </div>

      <div className="flex flex-col items-center gap-8 max-w-md text-center">
        <p className="text-gray-400 font-medium uppercase tracking-widest">
          The champion select session has ended or is no longer available.
        </p>
        
        <p className="text-sm text-gray-500 uppercase tracking-[0.3em]">
          Waiting for another match to draft...
        </p>

        <button
          onClick={onHome}
          className="group relative bg-[#1a1a1a] hover:bg-[#3498db] border-2 border-[#333] hover:border-[#3498db] px-12 py-4 rounded-xl transition-all duration-300 transform hover:scale-[1.05] active:scale-[0.98] shadow-xl overflow-hidden mt-4"
        >
          <div className="relative z-10 flex flex-col items-center">
            <span className="text-xl font-black uppercase tracking-widest group-hover:text-white transition-colors">
              Back Home
            </span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] transition-transform" />
        </button>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}
