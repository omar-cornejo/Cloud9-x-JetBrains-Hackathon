interface NoActiveDraftProps {
  onHome: () => void;
}

export function NoActiveDraft({ onHome }: NoActiveDraftProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-color)] text-[var(--text-primary)] p-10 font-sans overflow-hidden">
      <div className="flex flex-col items-center gap-5 mb-14">
        <h1 className="text-7xl font-black text-center uppercase tracking-tight text-white drop-shadow-[0_0_30px_rgba(0,209,255,0.3)]">
          Draft <span className="text-[var(--accent-blue)]">Inactive</span>
        </h1>
        <div className="h-1.5 w-28 bg-[var(--accent-blue)] rounded-full shadow-[0_0_15px_rgba(0,209,255,0.6)]" />
      </div>

      <div className="flex flex-col items-center gap-10 max-w-lg text-center">
        <p className="text-[var(--text-muted)] font-black uppercase tracking-[0.2em] text-sm opacity-80 leading-relaxed">
          The champion select session has ended or the League Client is not currently in a draft.
        </p>
        
        <p className="text-[12px] text-[var(--text-muted)] font-black uppercase tracking-[0.4em] opacity-40">
          Waiting for next match integration...
        </p>

        <button
          onClick={onHome}
          className="group relative bg-[var(--surface-color)] hover:bg-[var(--surface-color-hover)] border-2 border-[var(--border-color)] hover:border-[var(--accent-blue)] px-14 py-5 rounded-2xl transition-all duration-300 transform hover:scale-[1.05] active:scale-[0.98] shadow-2xl overflow-hidden mt-6"
        >
          <div className="relative z-10 flex flex-col items-center">
            <span className="text-2xl font-black uppercase tracking-widest group-hover:text-white transition-colors">
              Return Home
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
