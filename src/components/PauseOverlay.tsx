import React from 'react';
import { Play, RotateCcw, Home } from 'lucide-react';

interface PauseOverlayProps {
  runs: number;
  balls: number;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}

export const PauseOverlay: React.FC<PauseOverlayProps> = ({
  runs,
  balls,
  onResume,
  onRestart,
  onMainMenu,
}) => {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="w-full max-w-sm max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl bg-slate-950 border border-white/15 p-5 sm:p-7 text-white shadow-2xl text-center">
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-amber-300">Match Paused</h2>
        <p className="mt-1.5 text-sm text-slate-300 font-mono-num">
          {runs} runs · {balls} {balls === 1 ? 'ball' : 'balls'} faced
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-base flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-5 h-5 fill-current" />
            Resume
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-base flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            Restart Match
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-2xl bg-transparent hover:bg-white/10 text-slate-300 font-medium text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Home className="w-4 h-4" />
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};
