import React, { useEffect, useRef, useCallback } from 'react';
import {
  BallOutcome,
  DeliveryType,
  GameMode,
  GameState,
  ShotQuality,
} from '../types/game';
import {
  FielderSnail,
  FloatingCallout,
  Particle,
  RenderContextState,
  ShatteredPiece,
  getLayoutMetrics,
  projectWorld,
  renderCricketScene,
} from '../game/renderer';
import { soundEngine } from '../audio/soundEngine';

interface CricketStageProps {
  gameState: GameState;
  gameMode: GameMode;
  runs: number;
  matchId: number;
  onBallOutcome: (outcome: BallOutcome) => void;
}

const GRAVITY = 3.6;
const BOUNDARY_PZ = 2.65;
const BOUNDARY_PX = 4.6;

function createInitialFielders(): FielderSnail[] {
  return [
    { id: 0, basePx: -2.2, basePz: 1.55, px: -2.2, pz: 1.55, capColor: '#EF4444', shellColor: '#D97706', jumpPy: 0, celebrateTimer: 0 },
    { id: 1, basePx: 2.2, basePz: 1.55, px: 2.2, pz: 1.55, capColor: '#EF4444', shellColor: '#EA580C', jumpPy: 0, celebrateTimer: 0 },
    { id: 2, basePx: -1.15, basePz: 2.15, px: -1.15, pz: 2.15, capColor: '#DC2626', shellColor: '#B45309', jumpPy: 0, celebrateTimer: 0 },
    { id: 3, basePx: 1.15, basePz: 2.15, px: 1.15, pz: 2.15, capColor: '#DC2626', shellColor: '#C2410C', jumpPy: 0, celebrateTimer: 0 },
  ];
}

export const CricketStage: React.FC<CricketStageProps> = ({
  gameState,
  gameMode,
  runs,
  matchId,
  onBallOutcome,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameStateRef = useRef(gameState);
  const runsRef = useRef(runs);
  const gameModeRef = useRef(gameMode);
  const onBallOutcomeRef = useRef(onBallOutcome);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  useEffect(() => {
    onBallOutcomeRef.current = onBallOutcome;
  }, [onBallOutcome]);

  // Mutable 60fps simulation state
  const simRef = useRef({
    time: 0,
    width: 1000,
    height: 700,
    shakeAmount: 0,
    cameraZoom: 1,
    cameraPanX: 0,
    cameraPanY: 0,

    // Delivery & round cycle
    roundPhase: 'WAIT_BOWL' as 'WAIT_BOWL' | 'WINDUP' | 'BALL_IN_PLAY' | 'RESOLVING',
    roundTimer: 0.7,
    deliveryType: 'STRAIGHT' as DeliveryType,
    bowlerWindup: 0,
    bowlerPx: 0.2,

    // Ball 3D kinematics
    ballActive: false,
    ballPhase: 'IDLE' as 'IDLE' | 'BOWLING' | 'HIT_FLIGHT' | 'DEAD',
    ballPx: 0,
    ballPy: 0.45,
    ballPz: 1.02,
    ballVx: 0,
    ballVy: 0,
    ballVz: 0,
    ballSwingerAx: 0,
    ballBouncedPitch: false,
    ballBouncedOutfield: false,
    ballRestitution: 0.64,
    ballSpinAngle: 0,
    ballTrail: [] as Array<{ px: number; py: number; pz: number }>,
    hitMaxPz: 0,
    hitQuality: 'GOOD' as ShotQuality,
    outcomeEmitted: false,

    // Target bounce cue
    showTargetCue: false,
    targetPx: 0,
    targetPz: 0.34,

    // Batter cricket
    swingPhase: 'IDLE' as 'IDLE' | 'SWINGING' | 'FOLLOW_THROUGH',
    swingProgress: 0,
    swingAim: 0,
    swingLoft: 0.5,
    swingHasHit: false,
    swingCooldown: 0,
    batterRunProgress: 0,
    batterRunTargetCount: 0,
    isRunning: false,
    runStepTimer: 0,
    runStepCount: 0,
    batterCelebrateTimer: 0,
    batterSadTimer: 0,

    // Stumps
    stumpsIntact: true,
    shatteredPieces: [] as ShatteredPiece[],

    // Fielders & FX
    fielders: createInitialFielders(),
    particles: [] as Particle[],
    callouts: [] as FloatingCallout[],
    crowdExcitement: 0,
    crowdShoutTimer: 0,
    crowdShoutType: 'NONE' as 'NONE' | 'RUN' | 'FOUR' | 'SIX',
  });

  // Reset stage cleanly when a new match starts
  useEffect(() => {
    const s = simRef.current;
    s.roundPhase = 'WAIT_BOWL';
    s.roundTimer = 0.55;
    s.bowlerWindup = 0;
    s.ballActive = false;
    s.ballPhase = 'IDLE';
    s.ballTrail = [];
    s.showTargetCue = false;
    s.swingPhase = 'IDLE';
    s.swingProgress = 0;
    s.swingHasHit = false;
    s.swingCooldown = 0;
    s.batterRunProgress = 0;
    s.isRunning = false;
    s.runStepTimer = 0;
    s.runStepCount = 0;
    s.batterCelebrateTimer = 0;
    s.batterSadTimer = 0;
    s.stumpsIntact = true;
    s.shatteredPieces = [];
    s.fielders = createInitialFielders();
    s.particles = [];
    s.callouts = [];
    s.crowdExcitement = 0.15;
    s.crowdShoutTimer = 0;
    s.crowdShoutType = 'NONE';
    s.cameraZoom = 1;
    s.cameraPanX = 0;
    s.cameraPanY = 0;
    s.shakeAmount = 0;
    s.outcomeEmitted = false;
  }, [matchId]);

  const spawnParticles = useCallback(
    (
      x: number,
      y: number,
      count: number,
      colors: string[],
      speed: number,
      shape: 'circle' | 'rect' | 'confetti' = 'circle',
      gravity = 260
    ) => {
      const s = simRef.current;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const mag = speed * (0.35 + Math.random() * 0.85);
        s.particles.push({
          x,
          y,
          vx: Math.cos(angle) * mag,
          vy: Math.sin(angle) * mag - speed * 0.35,
          size: shape === 'confetti' ? 6 + Math.random() * 5 : 3 + Math.random() * 3.5,
          color: colors[i % colors.length],
          alpha: 1,
          life: 0.55 + Math.random() * 0.65,
          maxLife: 1.1,
          gravity,
          shape,
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 10,
        });
      }
    },
    []
  );

  const addCallout = useCallback(
    (text: string, color: string, stroke: string, subtext?: string, scale = 1) => {
      const s = simRef.current;
      s.callouts.push({
        text,
        subtext,
        x: s.width * 0.5,
        y: s.height * 0.38,
        vy: -38,
        color,
        stroke,
        scale,
        life: 1.35,
        maxLife: 1.35,
      });
    },
    []
  );

  const triggerSwing = useCallback((aimOffset: number, loftBoost: number) => {
    if (gameStateRef.current !== 'PLAYING') return;
    const s = simRef.current;
    if (s.swingPhase === 'SWINGING' || s.swingCooldown > 0) return;

    soundEngine.unlock();
    soundEngine.playBatSwoosh();

    s.swingPhase = 'SWINGING';
    s.swingProgress = 0;
    s.swingAim = Math.max(-1, Math.min(1, aimOffset));
    s.swingLoft = Math.max(0.15, Math.min(1, loftBoost));
    s.swingHasHit = false;
  }, []);

  // Keyboard support (Space, Enter, Arrow keys, W/A/D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'PLAYING') return;
      if (e.repeat) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        triggerSwing(0, 0.58);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        triggerSwing(0, 0.92);
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        triggerSwing(-0.75, 0.55);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        triggerSwing(0.75, 0.55);
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        triggerSwing(0, 0.25);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerSwing]);

  // Smooth touch & pointer gesture tracking on the canvas
  const pointerStartRef = useRef<{ x: number; y: number; active: boolean; swiped: boolean }>({
    x: 0,
    y: 0,
    active: false,
    swiped: false,
  });

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameStateRef.current !== 'PLAYING') return;
    e.preventDefault();
    soundEngine.unlock();

    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
    // Gentle directional bias from tap position: left=leg (-0.65), center=0, right=off (+0.65)
    const tapAim = Math.abs(relX - 0.5) < 0.14 ? 0 : (relX - 0.5) * 1.45;

    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      active: true,
      swiped: false,
    };

    // Instant zero-latency swing on pointerdown!
    triggerSwing(tapAim, 0.55);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointerStartRef.current;
    if (!p.active || p.swiped || gameStateRef.current !== 'PLAYING') return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const dist = Math.hypot(dx, dy);

    // If user drags fast during early swing, dynamically refine aim & loft before ball contact!
    if (dist > 18) {
      p.swiped = true;
      const s = simRef.current;
      if (s.swingPhase === 'SWINGING' && !s.swingHasHit) {
        s.swingAim = Math.max(-1, Math.min(1, dx / 70));
        if (dy < -16) {
          s.swingLoft = Math.min(1, 0.65 + Math.abs(dy) / 110);
        }
      }
    }
  };

  const handleCanvasPointerUp = () => {
    pointerStartRef.current.active = false;
  };

  // Main 60fps Game & Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTs = performance.now();

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      simRef.current.width = w;
      simRef.current.height = h;
    };

    resize();
    window.addEventListener('resize', resize);

    const launchNextDelivery = () => {
      const s = simRef.current;
      const score = runsRef.current;

      // Pick delivery variety scaling smoothly with runs scored
      const pool: DeliveryType[] = ['STRAIGHT', 'STRAIGHT', 'BOUNCER'];
      if (score >= 6) pool.push('SWINGER', 'SLOW_DIPPER');
      if (score >= 16) pool.push('FAST_YORKER', 'SWINGER');
      if (score >= 35) pool.push('FAST_YORKER', 'BOUNCER', 'SLOW_DIPPER');

      const delivery = pool[Math.floor(Math.random() * pool.length)];
      s.deliveryType = delivery;

      const startPx = (Math.random() - 0.5) * 0.24;
      const startPy = 0.46;
      const startPz = 1.02;

      // Flight time to batter crease (pz = 0.04)
      let flightTime = 0.86;
      let targetPz = 0.34;
      let targetPx = (Math.random() - 0.5) * 0.26;
      let restitution = 0.64;
      let swingerAx = 0;

      if (delivery === 'STRAIGHT') {
        flightTime = Math.max(0.70, 0.88 - Math.min(score, 80) * 0.0018);
        targetPz = 0.26 + Math.random() * 0.14;
        restitution = 0.62;
      } else if (delivery === 'BOUNCER') {
        flightTime = Math.max(0.68, 0.82 - Math.min(score, 80) * 0.0015);
        targetPz = 0.48 + Math.random() * 0.1;
        restitution = 0.80;
      } else if (delivery === 'FAST_YORKER') {
        flightTime = Math.max(0.58, 0.69 - Math.min(score, 90) * 0.001);
        targetPz = 0.11 + Math.random() * 0.07;
        targetPx = (Math.random() - 0.5) * 0.18;
        restitution = 0.54;
      } else if (delivery === 'SLOW_DIPPER') {
        flightTime = 1.12;
        targetPz = 0.28 + Math.random() * 0.14;
        restitution = 0.68;
      } else if (delivery === 'SWINGER') {
        flightTime = 0.88;
        targetPz = 0.30 + Math.random() * 0.12;
        swingerAx = (Math.random() < 0.5 ? -1 : 1) * 0.72;
        targetPx = -swingerAx * 0.18;
        restitution = 0.65;
      }

      const vz = (0.04 - startPz) / flightTime;
      const tBounce = (targetPz - startPz) / vz;
      // Exact vy0 so ball bounces cleanly at targetPz!
      const vy0 = (0.5 * GRAVITY * tBounce * tBounce - startPy) / tBounce;
      const vx0 = (targetPx - startPx - 0.5 * swingerAx * tBounce * tBounce) / tBounce;

      s.ballActive = true;
      s.ballPhase = 'BOWLING';
      s.ballPx = startPx;
      s.ballPy = startPy;
      s.ballPz = startPz;
      s.ballVx = vx0;
      s.ballVy = vy0;
      s.ballVz = vz;
      s.ballSwingerAx = swingerAx;
      s.ballRestitution = restitution;
      s.ballBouncedPitch = false;
      s.ballBouncedOutfield = false;
      s.ballTrail = [];
      s.hitMaxPz = 0;
      s.outcomeEmitted = false;

      s.showTargetCue = true;
      s.targetPx = targetPx;
      s.targetPz = targetPz;

      s.stumpsIntact = true;
      s.shatteredPieces = [];

      // Reset fielders smoothly
      s.fielders.forEach((f) => {
        f.px = f.basePx;
        f.pz = f.basePz;
        f.jumpPy = 0;
        f.celebrateTimer = 0;
      });

      soundEngine.playBowlRelease();
    };

    const shatterStumps = () => {
      const s = simRef.current;
      s.stumpsIntact = false;
      s.shakeAmount = 1.0;
      soundEngine.playWicketShatter();

      const pieces: ShatteredPiece[] = [];
      [-0.22, 0, 0.22].forEach((ox, idx) => {
        const p = projectWorld(ox, 0.24, -0.05, s.width, s.height);
        pieces.push({
          x: p.sx,
          y: p.sy,
          vx: (idx - 1) * 95 + (Math.random() - 0.5) * 80,
          vy: -170 - Math.random() * 120,
          angle: 0.2 * (idx - 1),
          vAngle: (Math.random() - 0.5) * 14,
          len: 36,
          width: 6,
          isBail: false,
        });
      });
      // 2 bails
      [-0.1, 0.1].forEach((ox) => {
        const p = projectWorld(ox, 0.48, -0.05, s.width, s.height);
        pieces.push({
          x: p.sx,
          y: p.sy,
          vx: (Math.random() - 0.5) * 180,
          vy: -240 - Math.random() * 90,
          angle: Math.random(),
          vAngle: (Math.random() - 0.5) * 20,
          len: 14,
          width: 4,
          isBail: true,
        });
      });
      s.shatteredPieces = pieces;
    };

    const finishBall = (outcome: BallOutcome) => {
      const s = simRef.current;
      if (s.outcomeEmitted) return;
      s.outcomeEmitted = true;
      s.roundPhase = 'RESOLVING';
      s.roundTimer = outcome.kind === 'OUT' ? 1.5 : outcome.runs >= 4 ? 1.35 : 0.95;
      onBallOutcomeRef.current(outcome);
    };

    const stepSimulation = (dt: number) => {
      const s = simRef.current;
      s.time += dt;

      // Decay camera shake, crowd excitement, shout timers
      s.shakeAmount = Math.max(0, s.shakeAmount - dt * 2.8);
      s.crowdExcitement = Math.max(0.14, s.crowdExcitement - dt * 0.4);
      if (s.crowdShoutTimer > 0) {
        s.crowdShoutTimer = Math.max(0, s.crowdShoutTimer - dt);
        if (s.crowdShoutTimer === 0) {
          s.crowdShoutType = 'NONE';
        }
      }
      s.batterCelebrateTimer = Math.max(0, s.batterCelebrateTimer - dt);
      s.batterSadTimer = Math.max(0, s.batterSadTimer - dt);
      s.swingCooldown = Math.max(0, s.swingCooldown - dt);

      if (s.batterRunProgress > 0) {
        s.batterRunProgress += dt * (s.batterRunTargetCount >= 2 ? 1.35 : 1.05);
        s.runStepTimer += dt;
        if (s.runStepTimer >= 0.145) {
          s.runStepTimer = 0;
          s.runStepCount += 1;
          if (gameStateRef.current === 'PLAYING') {
            soundEngine.playRunStep(s.runStepCount);
          }
        }
        if (s.batterRunProgress >= 1) {
          if (s.isRunning) {
            s.batterRunProgress = 0.01;
          } else {
            s.batterRunProgress = 0;
          }
        }
      }

      // Smooth camera zoom/pan reset when not tracking a big hit
      let targetZoom = 1;
      let targetPanX = 0;
      let targetPanY = 0;
      if (s.ballPhase === 'HIT_FLIGHT' && s.ballPz > 0.8) {
        targetZoom = 1.04;
        targetPanX = -s.ballPx * 14;
        targetPanY = Math.min(28, s.ballPy * 10);
      }
      s.cameraZoom += (targetZoom - s.cameraZoom) * Math.min(1, dt * 5);
      s.cameraPanX += (targetPanX - s.cameraPanX) * Math.min(1, dt * 5);
      s.cameraPanY += (targetPanY - s.cameraPanY) * Math.min(1, dt * 5);

      // Update particles
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          s.particles.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.vRot * dt;
        p.alpha = Math.min(1, p.life / (p.maxLife * 0.45));
      }

      // Update callouts
      for (let i = s.callouts.length - 1; i >= 0; i--) {
        const c = s.callouts[i];
        c.life -= dt;
        if (c.life <= 0) {
          s.callouts.splice(i, 1);
          continue;
        }
        c.y += c.vy * dt;
        c.vy *= 0.94;
      }

      // Update shattered stump pieces
      const { creaseY } = getLayoutMetrics(s.width, s.height);
      for (const sp of s.shatteredPieces) {
        sp.vy += 650 * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.angle += sp.vAngle * dt;
        const groundY = creaseY + 18;
        if (sp.y > groundY) {
          sp.y = groundY;
          sp.vy *= -0.35;
          sp.vx *= 0.65;
          sp.vAngle *= 0.5;
        }
      }

      // Update bat swing state
      if (s.swingPhase === 'SWINGING') {
        s.swingProgress += dt / 0.21;
        if (s.swingProgress >= 1) {
          s.swingPhase = 'FOLLOW_THROUGH';
          s.swingProgress = 1;
        }
      } else if (s.swingPhase === 'FOLLOW_THROUGH') {
        s.swingProgress -= dt / 0.16;
        if (s.swingProgress <= 0) {
          s.swingPhase = 'IDLE';
          s.swingProgress = 0;
          s.swingCooldown = 0.08;
        }
      }

      // Pause simulation updates if paused/title/game_over (still animate idle clouds/particles above!)
      if (gameStateRef.current !== 'PLAYING') return;

      // Round State Machine
      if (s.roundPhase === 'WAIT_BOWL') {
        s.roundTimer -= dt;
        if (s.roundTimer <= 0) {
          s.roundPhase = 'WINDUP';
          s.bowlerWindup = 0;
          s.bowlerPx = 0.16 + (Math.random() - 0.5) * 0.12;
        }
      } else if (s.roundPhase === 'WINDUP') {
        s.bowlerWindup += dt / 0.42;
        if (s.bowlerWindup >= 1) {
          s.bowlerWindup = 0;
          s.roundPhase = 'BALL_IN_PLAY';
          launchNextDelivery();
        }
      } else if (s.roundPhase === 'RESOLVING') {
        s.roundTimer -= dt;
        if (s.roundTimer <= 0) {
          s.roundPhase = 'WAIT_BOWL';
          s.roundTimer = 0.35;
          s.ballActive = false;
          s.ballPhase = 'IDLE';
          s.ballTrail = [];
        }
      }

      // Ball 3D Physics
      if (s.ballActive && s.roundPhase === 'BALL_IN_PLAY') {
        s.ballSpinAngle += dt * (s.ballPhase === 'HIT_FLIGHT' ? 18 : 12);
        s.ballTrail.push({ px: s.ballPx, py: s.ballPy, pz: s.ballPz });
        if (s.ballTrail.length > 10) s.ballTrail.shift();

        if (s.ballPhase === 'BOWLING') {
          s.ballVx += s.ballSwingerAx * dt;
          s.ballVy -= GRAVITY * dt;
          s.ballPx += s.ballVx * dt;
          s.ballPy += s.ballVy * dt;
          s.ballPz += s.ballVz * dt;

          // Pitch bounce
          if (s.ballPy <= 0 && s.ballVy < 0) {
            s.ballPy = 0;
            s.ballVy = -s.ballVy * s.ballRestitution;
            if (!s.ballBouncedPitch) {
              s.ballBouncedPitch = true;
              s.showTargetCue = false;
              soundEngine.playPitchBounce();
              const bProj = projectWorld(s.ballPx, 0, s.ballPz, s.width, s.height);
              spawnParticles(bProj.sx, bProj.sy, 7, ['#FDE68A', '#D97706', '#FFFFFF'], 75, 'circle', 180);
            }
          }

          // Check Bat-Ball Collision!
          if (
            s.swingPhase === 'SWINGING' &&
            !s.swingHasHit &&
            s.swingProgress >= 0.16 &&
            s.swingProgress <= 0.88 &&
            s.ballPz <= 0.26 &&
            s.ballPz >= -0.07
          ) {
            s.swingHasHit = true;
            s.showTargetCue = false;

            const depthErr = Math.abs(s.ballPz - 0.08);
            const swingErr = Math.abs(s.swingProgress - 0.48);
            const totalErr = depthErr + swingErr * 0.22;

            let quality: ShotQuality = 'EARLY';
            if (totalErr < 0.068) quality = 'PERFECT';
            else if (totalErr < 0.118) quality = 'GOOD';
            else if (totalErr < 0.175) quality = s.ballPz > 0.11 ? 'EARLY' : 'LATE';
            else quality = 'EDGE';

            s.hitQuality = quality;
            s.ballPhase = 'HIT_FLIGHT';
            s.ballBouncedOutfield = false;
            s.hitMaxPz = s.ballPz;

            // Compute exit velocity vector
            const timingAngle = (0.08 - s.ballPz) * 3.8; // early pulls left, late cuts right
            const combinedAim = Math.max(-1.15, Math.min(1.15, s.swingAim * 0.72 + timingAngle * 0.55));
            const hitProj = projectWorld(s.ballPx, s.ballPy, s.ballPz, s.width, s.height);

            if (quality === 'PERFECT') {
              soundEngine.playBatHit('SWEET');
              s.shakeAmount = 0.55;
              s.crowdExcitement = 0.65;
              spawnParticles(hitProj.sx, hitProj.sy, 16, ['#FEF08A', '#FFFFFF', '#F59E0B'], 190, 'circle', 220);

              const power = 2.95 + Math.random() * 0.35;
              s.ballVz = power * (0.9 + (1 - Math.abs(combinedAim)) * 0.16);
              s.ballVx = combinedAim * 2.15;
              s.ballVy = 1.65 + s.swingLoft * 1.45; // High soaring arc or scorching drive!
            } else if (quality === 'GOOD') {
              soundEngine.playBatHit('GOOD');
              s.shakeAmount = 0.25;
              spawnParticles(hitProj.sx, hitProj.sy, 10, ['#FEF3C7', '#FFFFFF'], 130, 'circle', 200);

              const power = 2.05 + Math.random() * 0.35;
              s.ballVz = power;
              s.ballVx = combinedAim * 1.85;
              s.ballVy = 0.85 + s.swingLoft * 0.95;
            } else if (quality === 'EARLY' || quality === 'LATE') {
              soundEngine.playBatHit('EDGE');
              spawnParticles(hitProj.sx, hitProj.sy, 6, ['#E2E8F0', '#FDE68A'], 95, 'circle', 180);

              const power = 1.25 + Math.random() * 0.35;
              s.ballVz = power;
              s.ballVx = combinedAim * 1.45 + (Math.random() - 0.5) * 0.4;
              s.ballVy = 0.65 + s.swingLoft * 0.95;
            } else {
              // Edge
              soundEngine.playBatHit('EDGE');
              s.ballVz = 0.82;
              s.ballVx = (Math.random() < 0.5 ? -1 : 1) * (0.85 + Math.random() * 0.5);
              s.ballVy = 1.15;
            }
          }

          // Check Bowled or Passed Keeper
          if (s.ballPhase === 'BOWLING' && s.ballPz <= -0.05) {
            s.showTargetCue = false;
            if (Math.abs(s.ballPx) < 0.30 && s.ballPy < 0.56) {
              // BOWLED!
              s.ballPhase = 'DEAD';
              s.ballActive = false;
              s.batterSadTimer = 1.5;
              shatterStumps();
              addCallout('BOWLED!', '#EF4444', '#7F1D1D', 'Clean through the gate', 1.15);
              finishBall({ kind: 'OUT', reason: 'BOWLED', label: 'W' });
            } else if (s.ballPz <= -0.28) {
              // Dot ball past keeper
              s.ballPhase = 'DEAD';
              s.ballActive = false;
              addCallout('DOT BALL', '#F8FAFC', '#334155', 'Good leave', 0.8);
              finishBall({ kind: 'RUNS', runs: 0, quality: 'MISS', label: '•' });
            }
          }
        } else if (s.ballPhase === 'HIT_FLIGHT') {
          // Flight & Outfield Roll Physics
          s.ballVy -= GRAVITY * dt;
          s.ballPx += s.ballVx * dt;
          s.ballPy += s.ballVy * dt;
          s.ballPz += s.ballVz * dt;
          s.hitMaxPz = Math.max(s.hitMaxPz, s.ballPz);

          // Ground bounce / grass friction
          if (s.ballPy <= 0) {
            s.ballPy = 0;
            if (Math.abs(s.ballVy) > 0.35) {
              s.ballVy = -s.ballVy * 0.46;
              if (s.ballPz > 0.45) {
                s.ballBouncedOutfield = true;
              }
              soundEngine.playPitchBounce();
            } else {
              s.ballVy = 0;
              // Rolling friction
              s.ballVx *= Math.pow(0.28, dt);
              s.ballVz *= Math.pow(0.28, dt);
            }
          }

          // Start live running sprint + footstep audio while chasing outfield hits!
          if (!s.isRunning && s.ballPz > 0.55 && (s.ballBouncedOutfield || s.ballVy < 1.1) && s.ballVz < 2.45) {
            s.isRunning = true;
            s.batterRunTargetCount = 2;
            if (s.batterRunProgress === 0) {
              s.batterRunProgress = 0.01;
              s.runStepTimer = 0.12;
            }
          }

          // Fielder snails chase & attempt catches!
          for (const f of s.fielders) {
            const dx = s.ballPx - f.px;
            const dz = s.ballPz - f.pz;
            const dist = Math.hypot(dx, dz);

            // Chase speed
            if (dist > 0.05 && s.ballPz > 0.6) {
              const chaseSpeed = 0.85;
              f.px += (dx / dist) * chaseSpeed * dt;
              f.pz += (dz / dist) * chaseSpeed * dt;
            }

            // Catch check: Only catchable if ball hasn't bounced in outfield, is at catchable height, and not a scorching PERFECT drive
            if (
              !s.ballBouncedOutfield &&
              s.hitQuality !== 'PERFECT' &&
              s.ballPz > 0.95 &&
              s.ballPy > 0.06 &&
              s.ballPy < 0.72 &&
              dist < 0.28 &&
              s.ballVz < 2.2
            ) {
              f.jumpPy = 0.26;
              f.celebrateTimer = 1.4;
              s.isRunning = false;
              s.batterRunProgress = 0;
              s.ballActive = false;
              s.ballPhase = 'DEAD';
              s.batterSadTimer = 1.5;
              soundEngine.playCaughtOut();
              addCallout('CAUGHT!', '#F97316', '#7C2D12', 'Snatched in the outfield!', 1.12);
              finishBall({ kind: 'OUT', reason: 'CAUGHT', label: 'W' });
              return;
            }

            // Ground interception
            if (s.ballPy <= 0.18 && s.ballPz > 0.85 && dist < 0.24 && s.ballVz < 2.15) {
              s.ballPhase = 'DEAD';
              s.ballVx = 0;
              s.ballVz = 0;
              const scored: 1 | 2 | 3 = s.hitMaxPz > 2.0 ? 3 : s.hitMaxPz > 1.45 ? 2 : 1;
              s.isRunning = false;
              s.batterRunTargetCount = scored;
              if (s.batterRunProgress === 0) {
                s.batterRunProgress = 0.01;
                s.runStepTimer = 0.1;
              }
              s.crowdExcitement = 0.72;
              s.crowdShoutTimer = 1.05;
              s.crowdShoutType = 'RUN';
              soundEngine.playRunningAction(scored);
              addCallout(
                `${scored} ${scored === 1 ? 'RUN' : 'RUNS'}`,
                '#FFFFFF',
                '#1E293B',
                scored === 3 ? 'Great hustle!' : 'Quick single!',
                0.92
              );
              finishBall({
                kind: 'RUNS',
                runs: scored,
                quality: s.hitQuality,
                label: String(scored),
              });
              return;
            }
          }

          // Boundary Check! (FOUR or SIX)
          const crossedBoundary = s.ballPz >= BOUNDARY_PZ || Math.abs(s.ballPx) >= BOUNDARY_PX;
          if (crossedBoundary) {
            s.ballPhase = 'DEAD';
            s.isRunning = false;
            s.batterRunProgress = 0;
            const isSix = !s.ballBouncedOutfield && s.ballPy > 0.12;
            const bProj = projectWorld(s.ballPx, Math.max(0.2, s.ballPy), Math.min(s.ballPz, BOUNDARY_PZ), s.width, s.height);

            if (isSix) {
              s.crowdExcitement = 1.0;
              s.crowdShoutTimer = 2.4;
              s.crowdShoutType = 'SIX';
              s.shakeAmount = 0.7;
              s.batterCelebrateTimer = 1.4;
              soundEngine.playSixFanfare();
              spawnParticles(
                bProj.sx,
                bProj.sy,
                42,
                ['#FACC15', '#EF4444', '#38BDF8', '#4ADE80', '#F472B6'],
                260,
                'confetti',
                190
              );
              addCallout(
                'SIX! +6',
                '#FDE047',
                '#92400E',
                s.hitQuality === 'PERFECT' ? 'MONSTER HIT!' : 'Cleared the ropes!',
                1.25
              );
              finishBall({ kind: 'RUNS', runs: 6, quality: s.hitQuality, label: '6' });
            } else {
              s.crowdExcitement = 0.88;
              s.crowdShoutTimer = 1.7;
              s.crowdShoutType = 'FOUR';
              s.batterCelebrateTimer = 1.0;
              soundEngine.playFourCheer();
              spawnParticles(
                bProj.sx,
                bProj.sy,
                26,
                ['#38BDF8', '#FACC15', '#FFFFFF', '#4ADE80'],
                210,
                'confetti',
                210
              );
              addCallout('FOUR! +4', '#38BDF8', '#0C4A6E', 'Cracking boundary!', 1.15);
              finishBall({ kind: 'RUNS', runs: 4, quality: s.hitQuality, label: '4' });
            }
            return;
          }

          // Ball rolled to a stop inside the infield/outfield
          const speed = Math.hypot(s.ballVx, s.ballVz);
          if (s.ballPy <= 0.02 && speed < 0.18) {
            s.ballPhase = 'DEAD';
            s.isRunning = false;
            const scored: 0 | 1 | 2 | 3 =
              s.hitMaxPz > 2.0 ? 3 : s.hitMaxPz > 1.45 ? 2 : s.hitMaxPz > 0.72 ? 1 : 0;

            if (scored === 1 || scored === 2 || scored === 3) {
              s.batterRunTargetCount = scored;
              if (s.batterRunProgress === 0) {
                s.batterRunProgress = 0.01;
                s.runStepTimer = 0.1;
              }
              s.crowdExcitement = 0.72;
              s.crowdShoutTimer = 1.05;
              s.crowdShoutType = 'RUN';
              soundEngine.playRunningAction(scored);
              addCallout(
                `${scored} ${scored === 1 ? 'RUN' : 'RUNS'}`,
                '#FFFFFF',
                '#1E293B',
                'Placed into the gap',
                0.9
              );
            } else {
              s.batterRunProgress = 0;
              addCallout('DOT BALL', '#F8FAFC', '#334155', 'Solid defense', 0.8);
            }
            finishBall({
              kind: 'RUNS',
              runs: scored,
              quality: s.hitQuality,
              label: scored === 0 ? '•' : String(scored),
            });
          }
        }
      }
    };

    const loop = (ts: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
      lastTs = ts;

      stepSimulation(dt);

      const s = simRef.current;
      const renderState: RenderContextState = {
        width: s.width,
        height: s.height,
        runs: runsRef.current,
        time: s.time,
        shakeAmount: s.shakeAmount,
        cameraZoom: s.cameraZoom,
        cameraPanX: s.cameraPanX,
        cameraPanY: s.cameraPanY,
        ballActive: s.ballActive,
        ballPx: s.ballPx,
        ballPy: s.ballPy,
        ballPz: s.ballPz,
        ballTrail: s.ballTrail,
        ballSpinAngle: s.ballSpinAngle,
        deliveryType: s.deliveryType,
        ballPhase: s.ballPhase,
        showTargetCue: s.showTargetCue,
        targetPx: s.targetPx,
        targetPz: s.targetPz,
        bowlerWindup: s.bowlerWindup,
        bowlerPx: s.bowlerPx,
        swingPhase: s.swingPhase,
        swingProgress: s.swingProgress,
        swingAim: s.swingAim,
        batterRunProgress: s.batterRunProgress,
        batterCelebrateTimer: s.batterCelebrateTimer,
        batterSadTimer: s.batterSadTimer,
        stumpsIntact: s.stumpsIntact,
        shatteredPieces: s.shatteredPieces,
        fielders: s.fielders,
        particles: s.particles,
        callouts: s.callouts,
        crowdExcitement: s.crowdExcitement,
        crowdShoutTimer: s.crowdShoutTimer,
        crowdShoutType: s.crowdShoutType,
      };

      renderCricketScene(ctx, renderState);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [addCallout, spawnParticles]);

  return (
    <div className="relative flex-1 w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        className="touch-canvas block w-full h-full cursor-pointer"
      />

      {/* Ergonomic Tactile Touch Controls responsive across mobile & laptop */}
      {gameState === 'PLAYING' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 sm:bottom-6 px-3 sm:px-8">
          <div className="max-w-3xl mx-auto flex items-end justify-between gap-2 sm:gap-4">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                triggerSwing(-0.65, 0.35);
              }}
              className="pointer-events-auto touch-canvas min-h-[46px] sm:min-h-[54px] px-3.5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-slate-900/60 hover:bg-slate-900/80 active:scale-95 backdrop-blur-sm border border-white/25 text-white font-display font-semibold text-xs sm:text-base tracking-wide shadow-lg transition-transform whitespace-nowrap shrink-0"
              aria-label="Pull shot"
            >
              Pull Shot
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                triggerSwing(0, 0.92);
              }}
              className="pointer-events-auto touch-canvas min-h-[50px] sm:min-h-[60px] px-5 sm:px-8 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-95 border-2 border-amber-200 text-slate-950 font-display font-bold text-sm sm:text-lg tracking-wide shadow-xl transition-transform whitespace-nowrap shrink-0"
              aria-label="Loft swing for six"
            >
              Loft Hit
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                triggerSwing(0.65, 0.35);
              }}
              className="pointer-events-auto touch-canvas min-h-[46px] sm:min-h-[54px] px-3.5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-slate-900/60 hover:bg-slate-900/80 active:scale-95 backdrop-blur-sm border border-white/25 text-white font-display font-semibold text-xs sm:text-base tracking-wide shadow-lg transition-transform whitespace-nowrap shrink-0"
              aria-label="Drive shot"
            >
              Drive Shot
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
