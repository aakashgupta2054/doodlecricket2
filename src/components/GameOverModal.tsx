import React from 'react';
import { RotateCcw, Trophy, Home } from 'lucide-react';
import { GameMode, MatchHistoryEntry, MatchStats } from '../types/game';

interface GameOverModalProps {
  stats: MatchStats;
  gameMode: GameMode;
  bestScore: number;
  isNewBest: boolean;
  matchHistory: MatchHistoryEntry[];
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  gameMode,
  bestScore,
  isNewBest,
  matchHistory,
  onPlayAgain,
  onMainMenu,
}) => {
  const strikeRate = stats.balls > 0 ? Math.round((stats.runs / stats.balls) * 100) : 0;
  const headline =
    stats.outReason === 'BOWLED'
      ? 'Clean Bowled!'
      : stats.outReason === 'CAUGHT'
      ? 'Caught Out!'
      : 'Innings Complete!';

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-slate-950 border border-white/15 p-6 sm:p-7 text-white shadow-2xl">
        <div className="text-center">
          {isNewBest && (
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 mb-1">
              <Trophy className="w-4 h-4" />
              <span>New High Score</span>
            </div>
          )}
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-white">
            {headline}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            {gameMode === 'ENDLESS' ? 'Endless Innings' : '12-Ball Blitz'}
            <span className="mx-1.5" aria-hidden="true">·</span>
            Best: <span className="font-mono-num text-amber-300">{bestScore}</span>
          </p>
        </div>

        {/* Hero Score Readout */}
        <div className="mt-5 py-4 px-5 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Total Runs</div>
            <div className="font-mono-num text-4xl sm:text-5xl font-bold text-amber-300">
              {stats.runs}
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="text-xs text-slate-400">
              Balls <span className="font-mono-num text-slate-100 font-semibold ml-1">{stats.balls}</span>
            </div>
            <div className="text-xs text-slate-400">
              Strike Rate <span className="font-mono-num text-emerald-400 font-semibold ml-1">{strikeRate}</span>
            </div>
          </div>
        </div>

        {/* Clean 3-Stat Breakdown */}
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="py-2.5 px-2 rounded-xl bg-slate-900/60 border border-white/5">
            <div className="font-mono-num text-xl font-bold text-sky-400">{stats.fours}</div>
            <div className="text-xs text-slate-400">Fours</div>
          </div>
          <div className="py-2.5 px-2 rounded-xl bg-slate-900/60 border border-white/5">
            <div className="font-mono-num text-xl font-bold text-amber-300">{stats.sixes}</div>
            <div className="text-xs text-slate-400">Sixes</div>
          </div>
          <div className="py-2.5 px-2 rounded-xl bg-slate-900/60 border border-white/5">
            <div className="font-mono-num text-xl font-bold text-emerald-400">{stats.bestStreak}</div>
            <div className="text-xs text-slate-400">Best Streak</div>
          </div>
        </div>

        {/* Session Match History (last 5 games) */}
        {matchHistory.length > 0 && (
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-200">Match History</h3>
              <span className="text-xs text-slate-400">
                Last {matchHistory.length} {matchHistory.length === 1 ? 'game' : 'games'}
              </span>
            </div>
            <ul className="divide-y divide-white/10">
              {matchHistory.map((entry, idx) => (
                <li
                  key={entry.id}
                  className="py-2 flex items-center justify-between gap-4 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0 text-slate-300">
                    <span className="font-mono-num text-xs text-slate-500 w-4 shrink-0">
                      {idx + 1}.
                    </span>
                    <span className="truncate">
                      {entry.mode === 'ENDLESS' ? 'Endless Innings' : '12-Ball Blitz'}
                    </span>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span className="font-mono-num text-xs text-slate-400 whitespace-nowrap shrink-0">
                      {entry.balls}b
                    </span>
                    {idx === 0 && (
                      <>
                        <span className="text-slate-600" aria-hidden="true">·</span>
                        <span className="text-xs font-medium text-emerald-400 whitespace-nowrap shrink-0">
                          Latest
                        </span>
                      </>
                    )}
                  </div>
                  <span className="font-mono-num font-bold text-amber-300 whitespace-nowrap shrink-0">
                    {entry.score} {entry.score === 1 ? 'run' : 'runs'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex-1 min-h-[50px] px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-slate-950 font-display font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-5 h-5" />
            Play Again
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="min-h-[50px] px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-base flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Home className="w-4 h-4" />
            Menu
          </button>
        </div>
      </div>
    </div>
  );
};
