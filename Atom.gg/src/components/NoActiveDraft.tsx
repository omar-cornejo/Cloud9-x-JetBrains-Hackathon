interface NoActiveDraftProps {
  onHome: () => void;
}

export function NoActiveDraft({ onHome }: NoActiveDraftProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-color)] text-[var(--text-primary)] p-6 font-sans overflow-hidden">
      <div className="flex flex-col items-center gap-3 mb-10">
        <h1 className="text-5xl font-black text-center uppercase tracking-tight text-white">
          Draft <span className="text-[var(--brand-primary)]">Inactive</span>
        </h1>
        <div className="h-1 w-20 bg-[var(--brand-primary)] rounded-full" />
      </div>

      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        <p className="text-[var(--text-muted)] font-black uppercase tracking-[0.15em] text-xs opacity-80 leading-relaxed">
          The session has ended or the client is not in a draft.
        </p>
        
        <button
          onClick={onHome}
          className="group relative bg-[var(--surface-color)] hover:bg-[var(--surface-color-hover)] border-2 border-[var(--border-color)] hover:border-[var(--brand-primary)] px-10 py-4 rounded-xl transition-all duration-300 transform active:scale-[0.98] shadow-lg mt-4"
        >
          <span className="text-xl font-black uppercase tracking-widest transition-colors">
            Return Home
          </span>
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
