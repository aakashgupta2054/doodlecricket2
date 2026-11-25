import React from 'react';
import { Play, Volume2, VolumeX } from 'lucide-react';
import { GameMode, PersistedRecords } from '../types/game';

interface TitleOverlayProps {
  gameMode: GameMode;
  records: PersistedRecords;
  onSelectMode: (mode: GameMode) => void;
  onStartGame: () => void;
  onToggleMute: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  gameMode,
  records,
  onSelectMode,
  onStartGame,
  onToggleMute,
}) => {
  const activeBest = gameMode === 'ENDLESS' ? records.bestEndless : records.bestBlitz;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-6 bg-slate-950/45 backdrop-blur-[2px]">
      <div className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl bg-slate-950/92 border border-white/15 p-5 sm:p-8 text-white shadow-2xl">
        <div className="text-center space-y-1.5 sm:space-y-2">
          <h1 className="font-display font-bold text-3xl sm:text-5xl tracking-tight text-amber-300 text-balance">
            Doodle Cricket
          </h1>
          <p className="text-xs sm:text-base text-slate-300">
            Time your swing as the snails bowl. Clear the ropes for sixes and protect your stumps.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="mt-6">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => onSelectMode('ENDLESS')}
              className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                gameMode === 'ENDLESS'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Endless Innings
            </button>
            <button
              type="button"
              onClick={() => onSelectMode('BLITZ_12')}
              className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                gameMode === 'BLITZ_12'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              12-Ball Blitz
            </button>
          </div>
          <p className="mt-2.5 text-center text-xs text-slate-400">
            {gameMode === 'ENDLESS'
              ? 'Bat as long as you can until bowled or caught'
              : 'Score maximum runs across 2 overs (12 balls)'}
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="font-mono-num text-amber-300 font-semibold">Best: {activeBest}</span>
          </p>
        </div>

        {/* Controls Breakdown */}
        <div className="mt-5 pt-4 border-t border-white/10 space-y-2 text-xs sm:text-sm text-slate-300">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Touch / Mouse</span>
            <span className="font-medium text-right text-slate-100">Tap pitch or Pull / Loft / Drive buttons</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Keyboard</span>
            <span className="font-mono-num text-xs text-right text-slate-100">Space · Arrows / WASD (360°)</span>
          </div>
        </div>

        {/* Primary CTA + Audio Toggle */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onStartGame}
            className="flex-1 min-h-[52px] px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-slate-950 font-display font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all whitespace-nowrap shrink-0"
          >
            <Play className="w-5 h-5 fill-current" />
            Start Match
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="min-w-[52px] min-h-[52px] rounded-2xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-white flex items-center justify-center transition-colors shrink-0"
            aria-label={records.muted ? 'Enable sound effects' : 'Mute sound effects'}
          >
            {records.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
