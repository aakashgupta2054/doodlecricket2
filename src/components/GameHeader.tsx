import React from 'react';
import { Volume2, VolumeX, Pause, Play, RotateCcw } from 'lucide-react';
import { BallLogEntry, GameMode, GameState } from '../types/game';

interface GameHeaderProps {
  gameState: GameState;
  gameMode: GameMode;
  runs: number;
  balls: number;
  bestScore: number;
  recentBalls: BallLogEntry[];
  muted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  gameState,
  gameMode,
  runs,
  balls,
  bestScore,
  recentBalls,
  muted,
  onToggleMute,
  onTogglePause,
  onRestart,
}) => {
  const oversDisplay = `${Math.floor(balls / 6)}.${balls % 6}`;
  const ballsRemaining = gameMode === 'BLITZ_12' ? Math.max(0, 12 - balls) : null;

  return (
    <header className="relative z-20 w-full bg-slate-950/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 sm:gap-8 text-white">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-display font-bold text-lg sm:text-xl tracking-tight text-amber-300 whitespace-nowrap shrink-0">
          Doodle Cricket
        </span>
      </div>

      {/* Zone 2: Live Match Scoreboard (unboxed tabular numerals) */}
      <div className="flex items-center gap-4 sm:gap-7 min-w-0">
        <div className="flex items-baseline gap-1.5 whitespace-nowrap shrink-0">
          <span className="text-xs font-medium text-slate-400">Runs</span>
          <span className="font-mono-num text-xl sm:text-2xl font-bold text-white">
            {runs}
          </span>
        </div>

        <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>

        <div className="flex items-baseline gap-1.5 whitespace-nowrap shrink-0">
          <span className="text-xs font-medium text-slate-400">
            {ballsRemaining !== null ? 'Left' : 'Overs'}
          </span>
          <span className="font-mono-num text-base sm:text-lg font-semibold text-slate-200">
            {ballsRemaining !== null ? `${ballsRemaining}b` : oversDisplay}
          </span>
        </div>

        <span className="text-slate-600 hidden md:inline" aria-hidden="true">·</span>

        <div className="hidden md:flex items-baseline gap-1.5 whitespace-nowrap shrink-0">
          <span className="text-xs font-medium text-slate-400">Best</span>
          <span className="font-mono-num text-base font-semibold text-amber-300">
            {bestScore}
          </span>
        </div>

        {/* Last 6 deliveries strip (desktop) */}
        {recentBalls.length > 0 && (
          <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-white/10">
            {recentBalls.slice(-6).map((b) => (
              <span
                key={b.id}
                className={`font-mono-num w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                  b.isOut
                    ? 'bg-red-600 text-white'
                    : b.runs === 6
                    ? 'bg-amber-400 text-slate-950'
                    : b.runs === 4
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-slate-800 text-slate-200'
                }`}
              >
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Zone 3: Audio & Match Controls (>= 44px touch targets) */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleMute}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors focus-visible:outline-2 focus-visible:outline-amber-400"
          aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          title={muted ? 'Unmute sound' : 'Mute sound'}
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
          <>
            <button
              type="button"
              onClick={onTogglePause}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors focus-visible:outline-2 focus-visible:outline-amber-400"
              aria-label={gameState === 'PAUSED' ? 'Resume match' : 'Pause match'}
              title={gameState === 'PAUSED' ? 'Resume' : 'Pause'}
            >
              {gameState === 'PAUSED' ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="hidden sm:flex min-w-[44px] min-h-[44px] items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors focus-visible:outline-2 focus-visible:outline-amber-400"
              aria-label="Restart match"
              title="Restart match"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </header>
  );
};
