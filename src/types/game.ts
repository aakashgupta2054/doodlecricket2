export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type GameMode = 'ENDLESS' | 'BLITZ_12';

export type DeliveryType = 'STRAIGHT' | 'BOUNCER' | 'SWINGER' | 'FAST_YORKER' | 'SLOW_DIPPER';

export type ShotQuality = 'PERFECT' | 'GOOD' | 'EARLY' | 'LATE' | 'EDGE' | 'MISS';

export type BallOutcome =
  | { kind: 'RUNS'; runs: 0 | 1 | 2 | 3 | 4 | 6; quality: ShotQuality; label: string }
  | { kind: 'OUT'; reason: 'BOWLED' | 'CAUGHT'; label: string };

export interface BallLogEntry {
  id: number;
  label: string; // '6', '4', '2', '1', '•', 'W'
  runs: number;
  isOut: boolean;
}

export interface MatchStats {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  bestStreak: number;
  currentStreak: number;
  highestShot: string;
  outReason?: 'BOWLED' | 'CAUGHT';
  recentBalls: BallLogEntry[];
}

export interface PersistedRecords {
  bestEndless: number;
  bestBlitz: number;
  totalRuns: number;
  mostSixes: number;
  muted: boolean;
}

export interface MatchHistoryEntry {
  id: number;
  score: number;
  mode: GameMode;
  balls: number;
}

export interface SwingInput {
  aimOffset: number; // -1 (leg/pull), 0 (straight), +1 (off/cover)
  loftBoost: number; // 0 to 1 based on upward swipe or timing
}
