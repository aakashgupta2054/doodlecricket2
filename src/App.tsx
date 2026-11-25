import { useCallback, useEffect, useRef, useState } from 'react';
import { CricketStage } from './components/CricketStage';
import { GameHeader } from './components/GameHeader';
import { GameOverModal } from './components/GameOverModal';
import { PauseOverlay } from './components/PauseOverlay';
import { TitleOverlay } from './components/TitleOverlay';
import { soundEngine } from './audio/soundEngine';
import {
  BallOutcome,
  GameMode,
  GameState,
  MatchHistoryEntry,
  MatchStats,
  PersistedRecords,
} from './types/game';

const STORAGE_KEY = 'doodle_cricket_records_v1';

const DEFAULT_RECORDS: PersistedRecords = {
  bestEndless: 0,
  bestBlitz: 0,
  totalRuns: 0,
  mostSixes: 0,
  muted: false,
};

function loadRecords(): PersistedRecords {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RECORDS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_RECORDS, ...parsed };
  } catch {
    return DEFAULT_RECORDS;
  }
}

function createEmptyStats(): MatchStats {
  return {
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    bestStreak: 0,
    currentStreak: 0,
    highestShot: '-',
    recentBalls: [],
  };
}

export default function App() {
  const [records, setRecords] = useState<PersistedRecords>(() => {
    const loaded = loadRecords();
    soundEngine.setMuted(loaded.muted);
    return loaded;
  });
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [gameMode, setGameMode] = useState<GameMode>('ENDLESS');
  const [stats, setStats] = useState<MatchStats>(() => createEmptyStats());
  const [matchId, setMatchId] = useState(1);
  const [isNewBest, setIsNewBest] = useState(false);
  const [milestoneBanner, setMilestoneBanner] = useState<string | null>(null);
  const [sessionHistory, setSessionHistory] = useState<MatchHistoryEntry[]>([]);

  const endTimeoutRef = useRef<number | null>(null);
  const milestoneTimeoutRef = useRef<number | null>(null);
  const ballIdCounterRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (endTimeoutRef.current !== null) {
      window.clearTimeout(endTimeoutRef.current);
      endTimeoutRef.current = null;
    }
    if (milestoneTimeoutRef.current !== null) {
      window.clearTimeout(milestoneTimeoutRef.current);
      milestoneTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    soundEngine.setPlayingAmbient(gameState === 'PLAYING');
  }, [gameState]);

  useEffect(() => {
    return () => {
      soundEngine.setPlayingAmbient(false);
      clearTimers();
    };
  }, [clearTimers]);

  const saveRecords = useCallback((next: PersistedRecords) => {
    setRecords(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    soundEngine.unlock();
    const nextMuted = !records.muted;
    soundEngine.setMuted(nextMuted);
    if (!nextMuted) {
      soundEngine.playUiClick();
    }
    saveRecords({ ...records, muted: nextMuted });
  }, [records, saveRecords]);

  const startFreshMatch = useCallback(() => {
    clearTimers();
    soundEngine.unlock();
    soundEngine.playUiClick();
    setStats(createEmptyStats());
    setIsNewBest(false);
    setMilestoneBanner(null);
    setMatchId((prev) => prev + 1);
    setGameState('PLAYING');
  }, [clearTimers]);

  const handleTogglePause = useCallback(() => {
    soundEngine.playUiClick();
    setGameState((prev) => {
      if (prev === 'PLAYING') return 'PAUSED';
      if (prev === 'PAUSED') return 'PLAYING';
      return prev;
    });
  }, []);

  const handleMainMenu = useCallback(() => {
    clearTimers();
    soundEngine.playUiClick();
    setMilestoneBanner(null);
    setStats(createEmptyStats());
    setMatchId((prev) => prev + 1);
    setGameState('TITLE_MENU');
  }, [clearTimers]);

  // Escape / P key pauses or resumes active play
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (gameState === 'PLAYING' || gameState === 'PAUSED') {
          e.preventDefault();
          handleTogglePause();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, handleTogglePause]);

  const finalizeMatch = useCallback(
    (finalRuns: number, finalSixes: number, finalBalls: number, mode: GameMode) => {
      const prevBest = mode === 'ENDLESS' ? records.bestEndless : records.bestBlitz;
      const beatBest = finalRuns > prevBest && finalRuns > 0;
      setIsNewBest(beatBest);

      setSessionHistory((prev) => [
        { id: Date.now(), score: finalRuns, mode, balls: finalBalls },
        ...prev,
      ].slice(0, 5));

      const updated: PersistedRecords = {
        ...records,
        bestEndless: mode === 'ENDLESS' ? Math.max(records.bestEndless, finalRuns) : records.bestEndless,
        bestBlitz: mode === 'BLITZ_12' ? Math.max(records.bestBlitz, finalRuns) : records.bestBlitz,
        totalRuns: records.totalRuns + finalRuns,
        mostSixes: Math.max(records.mostSixes, finalSixes),
      };
      saveRecords(updated);
      setGameState('GAME_OVER');
    },
    [records, saveRecords]
  );

  const handleBallOutcome = useCallback(
    (outcome: BallOutcome) => {
      setStats((prev) => {
        const nextBalls = prev.balls + 1;
        ballIdCounterRef.current += 1;

        if (outcome.kind === 'OUT') {
          const nextStats: MatchStats = {
            ...prev,
            balls: nextBalls,
            currentStreak: 0,
            outReason: outcome.reason,
            recentBalls: [
              ...prev.recentBalls.slice(-11),
              { id: ballIdCounterRef.current, label: 'W', runs: 0, isOut: true },
            ],
          };

          endTimeoutRef.current = window.setTimeout(() => {
            finalizeMatch(nextStats.runs, nextStats.sixes, nextBalls, gameMode);
          }, 1150);

          return nextStats;
        }

        const scored = outcome.runs;
        const nextRuns = prev.runs + scored;
        const nextStreak = scored > 0 ? prev.currentStreak + 1 : 0;
        const nextBestStreak = Math.max(prev.bestStreak, nextStreak);
        const nextFours = prev.fours + (scored === 4 ? 1 : 0);
        const nextSixes = prev.sixes + (scored === 6 ? 1 : 0);

        // Milestone fanfare at 50 & 100
        if (prev.runs < 50 && nextRuns >= 50) {
          soundEngine.playMilestoneFanfare();
          setMilestoneBanner('Half-Century! 50+ Runs');
          milestoneTimeoutRef.current = window.setTimeout(() => setMilestoneBanner(null), 2400);
        } else if (prev.runs < 100 && nextRuns >= 100) {
          soundEngine.playMilestoneFanfare();
          setMilestoneBanner('Century! 100+ Runs');
          milestoneTimeoutRef.current = window.setTimeout(() => setMilestoneBanner(null), 2600);
        }

        const nextStats: MatchStats = {
          ...prev,
          runs: nextRuns,
          balls: nextBalls,
          fours: nextFours,
          sixes: nextSixes,
          currentStreak: nextStreak,
          bestStreak: nextBestStreak,
          recentBalls: [
            ...prev.recentBalls.slice(-11),
            {
              id: ballIdCounterRef.current,
              label: outcome.label,
              runs: scored,
              isOut: false,
            },
          ],
        };

        // Check 12-Ball Blitz completion
        if (gameMode === 'BLITZ_12' && nextBalls >= 12) {
          endTimeoutRef.current = window.setTimeout(() => {
            finalizeMatch(nextRuns, nextSixes, nextBalls, gameMode);
          }, 1050);
        }

        return nextStats;
      });
    },
    [finalizeMatch, gameMode]
  );

  const activeBest = gameMode === 'ENDLESS' ? records.bestEndless : records.bestBlitz;

  return (
    <div className="h-dvh w-screen overflow-hidden flex flex-col bg-slate-950">
      <GameHeader
        gameState={gameState}
        gameMode={gameMode}
        runs={stats.runs}
        balls={stats.balls}
        bestScore={activeBest}
        recentBalls={stats.recentBalls}
        muted={records.muted}
        onToggleMute={handleToggleMute}
        onTogglePause={handleTogglePause}
        onRestart={startFreshMatch}
      />

      <main className="relative flex-1 w-full overflow-hidden">
        <CricketStage
          gameState={gameState}
          gameMode={gameMode}
          runs={stats.runs}
          matchId={matchId}
          onBallOutcome={handleBallOutcome}
        />

        {/* Milestone toast banner */}
        {milestoneBanner && gameState === 'PLAYING' && (
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-20 px-5 py-2 rounded-2xl bg-amber-400 text-slate-950 font-display font-bold text-base sm:text-lg shadow-xl border border-amber-200 whitespace-nowrap">
            {milestoneBanner}
          </div>
        )}

        {gameState === 'TITLE_MENU' && (
          <TitleOverlay
            gameMode={gameMode}
            records={records}
            onSelectMode={(mode) => {
              soundEngine.unlock();
              soundEngine.playUiClick();
              setGameMode(mode);
            }}
            onStartGame={startFreshMatch}
            onToggleMute={handleToggleMute}
          />
        )}

        {gameState === 'PAUSED' && (
          <PauseOverlay
            runs={stats.runs}
            balls={stats.balls}
            onResume={handleTogglePause}
            onRestart={startFreshMatch}
            onMainMenu={handleMainMenu}
          />
        )}

        {gameState === 'GAME_OVER' && (
          <GameOverModal
            stats={stats}
            gameMode={gameMode}
            bestScore={activeBest}
            isNewBest={isNewBest}
            matchHistory={sessionHistory}
            onPlayAgain={startFreshMatch}
            onMainMenu={handleMainMenu}
          />
        )}
      </main>
    </div>
  );
}
