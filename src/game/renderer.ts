import { DeliveryType } from '../types/game';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
  shape: 'circle' | 'rect' | 'confetti';
  rotation: number;
  vRot: number;
}

export interface FloatingCallout {
  text: string;
  subtext?: string;
  x: number;
  y: number;
  vy: number;
  color: string;
  stroke: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface ShatteredPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  vAngle: number;
  len: number;
  width: number;
  isBail: boolean;
}

export interface FielderSnail {
  id: number;
  basePx: number;
  basePz: number;
  px: number;
  pz: number;
  capColor: string;
  shellColor: string;
  jumpPy: number;
  celebrateTimer: number;
}

export interface RenderContextState {
  width: number;
  height: number;
  runs: number;
  time: number;
  shakeAmount: number;
  cameraZoom: number;
  cameraPanX: number;
  cameraPanY: number;

  // Ball in 3D world space: px (lateral), py (height), pz (0=batter crease, 1=bowler release, >1=outfield)
  ballActive: boolean;
  ballPx: number;
  ballPy: number;
  ballPz: number;
  ballTrail: Array<{ px: number; py: number; pz: number }>;
  ballSpinAngle: number;
  deliveryType: DeliveryType;
  ballPhase: 'IDLE' | 'BOWLING' | 'HIT_FLIGHT' | 'DEAD';

  // Pitch bounce target cue
  showTargetCue: boolean;
  targetPx: number;
  targetPz: number;

  // Bowler snail
  bowlerWindup: number; // 0 to 1
  bowlerPx: number;

  // Batter cricket
  swingPhase: 'IDLE' | 'SWINGING' | 'FOLLOW_THROUGH';
  swingProgress: number; // 0 to 1
  swingAim: number; // -1 to 1
  batterRunProgress: number; // 0 = crease, >0 = sprinting
  batterCelebrateTimer: number;
  batterSadTimer: number;

  // Stumps
  stumpsIntact: boolean;
  shatteredPieces: ShatteredPiece[];

  // Fielders, particles, callouts
  fielders: FielderSnail[];
  particles: Particle[];
  callouts: FloatingCallout[];
  crowdExcitement: number; // 0 to 1
  crowdShoutTimer: number; // > 0 when crowd is shouting after runs/4/6
  crowdShoutType: 'NONE' | 'RUN' | 'FOUR' | 'SIX';
}

export function getLayoutMetrics(w: number, h: number) {
  const isShortLandscape = h < 520;
  const horizonY = isShortLandscape ? h * 0.30 : h * 0.33;
  const creaseY = isShortLandscape ? h * 0.72 : h * 0.78;
  const pitchScreenLen = creaseY - horizonY;
  const pitchHalfWidthAtCrease = Math.max(40, Math.min(w * 0.145, h * 0.145, 96));
  const charScale = Math.max(0.62, Math.min(1.22, Math.min(w / 820, h / 620)));
  return { isShortLandscape, horizonY, creaseY, pitchScreenLen, pitchHalfWidthAtCrease, charScale };
}

export function projectWorld(
  px: number,
  py: number,
  pz: number,
  w: number,
  h: number
): { sx: number; sy: number; scale: number } {
  const { creaseY, pitchScreenLen, pitchHalfWidthAtCrease } = getLayoutMetrics(w, h);

  // Depth mapping: pz = 0 -> creaseY, pz = 1 -> horizonY + 0.14*pitchScreenLen
  // For pz > 1 (outfield), asymptotically approaches horizonY
  const clampedPz = Math.max(-0.4, pz);
  const depthNorm = clampedPz / (1 + Math.max(0, clampedPz) * 0.62);
  const syGround = creaseY - depthNorm * (pitchScreenLen * 0.86);

  const scale = Math.max(0.18, 1 / (1 + Math.max(-0.25, clampedPz) * 0.95));

  const sx = w * 0.5 + px * pitchHalfWidthAtCrease * scale;
  const heightPx = py * (h * 0.15) * scale;
  const sy = syGround - heightPx;

  return { sx, sy, scale };
}

function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.replace('#', ''), 16);
  const bh = parseInt(b.replace('#', ''), 16);
  const ar = (ah >> 16) & 0xff;
  const ag = (ah >> 8) & 0xff;
  const ab = ah & 0xff;
  const br = (bh >> 16) & 0xff;
  const bg = (bh >> 8) & 0xff;
  const bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `rgb(${rr}, ${rg}, ${rb})`;
}

export function renderCricketScene(ctx: CanvasRenderingContext2D, s: RenderContextState) {
  const { width: w, height: h } = s;
  ctx.save();

  // Apply subtle camera shake + follow zoom
  const shakeX = s.shakeAmount > 0 ? (Math.random() - 0.5) * s.shakeAmount * 14 : 0;
  const shakeY = s.shakeAmount > 0 ? (Math.random() - 0.5) * s.shakeAmount * 14 : 0;

  ctx.translate(w * 0.5 + shakeX, h * 0.5 + shakeY);
  ctx.scale(s.cameraZoom, s.cameraZoom);
  ctx.translate(-w * 0.5 + s.cameraPanX, -h * 0.5 + s.cameraPanY);

  const { horizonY } = getLayoutMetrics(w, h);

  // 1. Dynamic Sky Gradient (Morning -> Afternoon -> Golden Sunset -> Night Floodlights)
  let skyTop = '#4F9CF9';
  let skyBottom = '#CBEAFE';
  let nightFactor = 0;

  if (s.runs >= 100) {
    nightFactor = 1;
    skyTop = '#0F172A';
    skyBottom = '#1E3A8A';
  } else if (s.runs >= 60) {
    const t = Math.min(1, (s.runs - 60) / 30);
    skyTop = lerpColor('#3B82F6', '#5B21B6', t);
    skyBottom = lerpColor('#FDE68A', '#FB923C', t);
    nightFactor = t * 0.35;
  } else if (s.runs >= 25) {
    const t = Math.min(1, (s.runs - 25) / 30);
    skyTop = lerpColor('#4F9CF9', '#2563EB', t);
    skyBottom = lerpColor('#CBEAFE', '#FEF08A', t);
  }

  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, skyTop);
  skyGrad.addColorStop(1, skyBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(-60, -60, w + 120, horizonY + 80);

  // Stars at night
  if (nightFactor > 0.4) {
    ctx.fillStyle = `rgba(255, 255, 240, ${(nightFactor - 0.4) * 1.1})`;
    for (let i = 0; i < 24; i++) {
      const sx = ((i * 197) % w);
      const sy = ((i * 89) % (horizonY * 0.68));
      const twinkle = 1 + Math.sin(s.time * 2.5 + i) * 0.4;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.3 * twinkle, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Sun or Moon
  const celestialX = w * 0.82;
  const celestialY = horizonY * 0.32;
  ctx.save();
  ctx.beginPath();
  ctx.arc(celestialX, celestialY, Math.min(w, h) * 0.045, 0, Math.PI * 2);
  ctx.fillStyle = nightFactor > 0.6 ? '#FEF9C3' : '#FDE047';
  ctx.shadowColor = nightFactor > 0.6 ? 'rgba(254, 249, 195, 0.45)' : 'rgba(253, 224, 71, 0.55)';
  ctx.shadowBlur = 28;
  ctx.fill();
  ctx.restore();

  // Drifting fluffy clouds
  drawClouds(ctx, w, horizonY, s.time, nightFactor);

  // Floodlight towers
  drawFloodlightTowers(ctx, w, horizonY, nightFactor);

  // Full multi-tiered stadium & cheering/shouting crowd
  drawStadiumBackdrop(
    ctx,
    w,
    horizonY,
    s.time,
    s.crowdExcitement,
    s.crowdShoutTimer,
    s.crowdShoutType,
    nightFactor
  );

  // 2. Outfield Turf & Perspective Mown Stripes
  const turfTop = horizonY;
  const turfGrad = ctx.createLinearGradient(0, turfTop, 0, h);
  turfGrad.addColorStop(0, nightFactor > 0.6 ? '#1F6332' : '#359446');
  turfGrad.addColorStop(1, nightFactor > 0.6 ? '#24733B' : '#45AD58');
  ctx.fillStyle = turfGrad;
  ctx.fillRect(-60, turfTop, w + 120, h - turfTop + 80);

  // Perspective mowing bands
  const bandCount = 9;
  for (let i = 0; i < bandCount; i++) {
    if (i % 2 === 1) continue;
    const t0 = i / bandCount;
    const t1 = (i + 1) / bandCount;
    const y0 = turfTop + Math.pow(t0, 1.45) * (h - turfTop);
    const y1 = turfTop + Math.pow(t1, 1.45) * (h - turfTop);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.fillRect(-60, y0, w + 120, y1 - y0);
  }

  // Curved boundary rope near top of outfield
  const ropeYCenter = horizonY + (h - horizonY) * 0.14;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-40, ropeYCenter + 22);
  ctx.quadraticCurveTo(w * 0.5, ropeYCenter - 16, w + 40, ropeYCenter + 22);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Boundary sponsor-free cheerful cushions
  const cushionPositions = [0.14, 0.32, 0.5, 0.68, 0.86];
  cushionPositions.forEach((xp, idx) => {
    const cx = w * xp;
    const t = xp - 0.5;
    const cy = ropeYCenter - 4 + t * t * 42;
    ctx.fillStyle = idx % 2 === 0 ? '#DC2626' : '#F59E0B';
    ctx.beginPath();
    ctx.roundRect(cx - 14, cy - 5, 28, 7, 3);
    ctx.fill();
  });

  // 3. Cricket Pitch Trapezoid
  const farLeft = projectWorld(-1.05, 0, 1.15, w, h);
  const farRight = projectWorld(1.05, 0, 1.15, w, h);
  const nearLeft = projectWorld(-1.05, 0, -0.25, w, h);
  const nearRight = projectWorld(1.05, 0, -0.25, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(farLeft.sx, farLeft.sy);
  ctx.lineTo(farRight.sx, farRight.sy);
  ctx.lineTo(nearRight.sx, nearRight.sy);
  ctx.lineTo(nearLeft.sx, nearLeft.sy);
  ctx.closePath();

  const pitchGrad = ctx.createLinearGradient(0, farLeft.sy, 0, nearLeft.sy);
  pitchGrad.addColorStop(0, '#D9B174');
  pitchGrad.addColorStop(0.5, '#E7C58B');
  pitchGrad.addColorStop(1, '#DFB97C');
  ctx.fillStyle = pitchGrad;
  ctx.fill();

  // Subtle pitch edge border
  ctx.strokeStyle = 'rgba(130, 92, 42, 0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // White Crease Markings
  drawCreaseLines(ctx, w, h);

  // Pitch bounce timing target cue
  if (s.showTargetCue && s.ballPhase === 'BOWLING') {
    const cueProj = projectWorld(s.targetPx, 0, s.targetPz, w, h);
    const pulse = 0.78 + Math.sin(s.time * 12) * 0.22;
    ctx.save();
    ctx.translate(cueProj.sx, cueProj.sy);
    ctx.scale(1, 0.42);
    ctx.beginPath();
    ctx.arc(0, 0, 18 * cueProj.scale * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 6 * cueProj.scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.fill();
    ctx.restore();
  }

  // Far stumps (bowler's end)
  drawStumps(ctx, w, h, 1.05, true, []);

  // 4. Fielder Snails around all sides of pitch (depth-sorted back-to-front)
  const sortedFielders = [...s.fielders].sort((a, b) => b.pz - a.pz);
  for (const f of sortedFielders) {
    drawFielderSnail(ctx, f, w, h, s.time);
  }

  // 5. Bowler Snail
  drawBowlerSnail(ctx, s.bowlerPx, 1.08, s.bowlerWindup, w, h, s.time);

  // 6. Ball Shadow & Ball (when behind batter or in flight)
  if (s.ballActive && s.ballPz > 0.04) {
    drawBallAndTrail(ctx, s, w, h);
  }

  // 7. Batter Cricket & Near Stumps
  drawBatterCricket(ctx, s, w, h);

  if (s.stumpsIntact) {
    drawStumps(ctx, w, h, -0.05, false, []);
  } else {
    drawShatteredStumps(ctx, s.shatteredPieces);
  }

  // Ball if past batter
  if (s.ballActive && s.ballPz <= 0.04) {
    drawBallAndTrail(ctx, s, w, h);
  }

  // 8. Particles
  for (const p of s.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    if (p.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-p.size * 0.5, -p.size * 0.3, p.size, p.size * 0.6);
    }
    ctx.restore();
  }

  // 9. Floating Callouts (FOUR!, SIX!, PERFECT!, BOWLED!)
  const calloutFontSize = Math.round(Math.max(24, Math.min(44, Math.min(w * 0.085, h * 0.075))));
  const subFontSize = Math.round(Math.max(12, Math.min(17, calloutFontSize * 0.38)));

  for (const c of s.callouts) {
    const progress = 1 - c.life / c.maxLife;
    const alpha = progress < 0.15 ? progress / 0.15 : Math.max(0, 1 - (progress - 0.55) / 0.45);
    const popScale = progress < 0.18 ? 0.6 + (progress / 0.18) * 0.5 : 1.05;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(c.x, c.y);
    ctx.scale(c.scale * popScale, c.scale * popScale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `700 ${calloutFontSize}px "Fredoka", system-ui, sans-serif`;
    ctx.lineWidth = Math.max(4, calloutFontSize * 0.16);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = c.stroke;
    ctx.strokeText(c.text, 0, 0);
    ctx.fillStyle = c.color;
    ctx.fillText(c.text, 0, 0);

    if (c.subtext) {
      ctx.font = `600 ${subFontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
      ctx.lineWidth = Math.max(2.5, subFontSize * 0.24);
      ctx.strokeText(c.subtext, 0, calloutFontSize * 0.78);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(c.subtext, 0, calloutFontSize * 0.78);
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawClouds(
  ctx: CanvasRenderingContext2D,
  w: number,
  horizonY: number,
  time: number,
  nightFactor: number
) {
  const cloudAlpha = nightFactor > 0.6 ? 0.18 : 0.85;
  ctx.fillStyle = `rgba(255, 255, 255, ${cloudAlpha})`;
  const clouds = [
    { baseX: 0.15, y: 0.28, r: 22, speed: 6 },
    { baseX: 0.48, y: 0.2, r: 28, speed: 4.5 },
    { baseX: 0.78, y: 0.34, r: 20, speed: 5.5 },
  ];

  for (const c of clouds) {
    const x = ((c.baseX * w + time * c.speed) % (w + 180)) - 90;
    const y = horizonY * c.y;
    ctx.beginPath();
    ctx.arc(x, y, c.r, 0, Math.PI * 2);
    ctx.arc(x + c.r * 0.85, y - c.r * 0.25, c.r * 0.85, 0, Math.PI * 2);
    ctx.arc(x + c.r * 1.65, y, c.r * 0.72, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFloodlightTowers(
  ctx: CanvasRenderingContext2D,
  w: number,
  horizonY: number,
  nightFactor: number
) {
  const towers = [w * 0.12, w * 0.88];
  for (const tx of towers) {
    const baseH = horizonY;
    const topY = horizonY * 0.22;

    // Pole
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(tx, baseH);
    ctx.lineTo(tx, topY);
    ctx.stroke();

    // Light head
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(tx - 20, topY - 12, 40, 16, 4);
    ctx.fill();

    // Bulbs
    const bulbColor = nightFactor > 0.3 ? '#FEF08A' : '#CBD5E1';
    ctx.fillStyle = bulbColor;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(tx + i * 10, topY - 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Light beam glow at night
    if (nightFactor > 0.35) {
      ctx.save();
      const grad = ctx.createRadialGradient(tx, topY, 6, tx, topY + 60, 150);
      grad.addColorStop(0, `rgba(254, 249, 195, ${nightFactor * 0.35})`);
      grad.addColorStop(1, 'rgba(254, 249, 195, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(tx, topY + 40, 150, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawStadiumBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  horizonY: number,
  time: number,
  excitement: number,
  shoutTimer: number,
  shoutType: 'NONE' | 'RUN' | 'FOUR' | 'SIX',
  nightFactor: number
) {
  const isShouting = shoutTimer > 0 && shoutType !== 'NONE';
  const standHeight = Math.min(horizonY * 0.56, 98);
  const standTopY = horizonY - standHeight;

  // 1. Stadium outer bowl silhouette & upper roof canopies on wings
  ctx.fillStyle = nightFactor > 0.5 ? '#0F172A' : '#334155';
  ctx.beginPath();
  ctx.moveTo(-60, horizonY);
  ctx.lineTo(-60, standTopY - 12);
  ctx.quadraticCurveTo(w * 0.5, standTopY + 18, w + 60, standTopY - 12);
  ctx.lineTo(w + 60, horizonY + 8);
  ctx.closePath();
  ctx.fill();

  // Left & Right Grandstand Roof Canopies
  const canopyColor = nightFactor > 0.5 ? '#1E293B' : '#475569';
  const trimColor = '#F59E0B';
  [
    { x0: -40, x1: w * 0.36, yOuter: standTopY - 22, yInner: standTopY - 6 },
    { x0: w * 0.64, x1: w + 40, yOuter: standTopY - 6, yInner: standTopY - 22 },
  ].forEach((wing, idx) => {
    ctx.fillStyle = canopyColor;
    ctx.beginPath();
    ctx.moveTo(wing.x0, idx === 0 ? wing.yOuter : wing.yOuter);
    ctx.lineTo(wing.x1, wing.yInner);
    ctx.lineTo(wing.x1, wing.yInner + 12);
    ctx.lineTo(wing.x0, (idx === 0 ? wing.yOuter : wing.yOuter) + 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = trimColor;
    ctx.fillRect(wing.x0, Math.min(wing.yOuter, wing.yInner) + 10, wing.x1 - wing.x0, 3);
  });

  // 2. Stepped Bleacher Tiers (5 stacked concrete/slate seating tiers)
  const tierCount = 5;
  for (let row = 0; row < tierCount; row++) {
    const t = row / tierCount;
    const rowY = standTopY + 12 + t * (standHeight - 20);
    const shade = nightFactor > 0.5
      ? row % 2 === 0 ? '#1E293B' : '#263449'
      : row % 2 === 0 ? '#64748B' : '#475569';
    ctx.fillStyle = shade;
    ctx.fillRect(-50, rowY, w + 100, (standHeight - 16) / tierCount + 2);
  }

  // Front stadium boundary wall & LED-style perimeter board
  ctx.fillStyle = nightFactor > 0.5 ? '#0F172A' : '#1E293B';
  ctx.fillRect(-50, horizonY - 12, w + 100, 14);
  ctx.fillStyle = isShouting
    ? shoutType === 'SIX'
      ? '#FACC15'
      : '#38BDF8'
    : '#10B981';
  ctx.fillRect(-50, horizonY - 11, w + 100, 4);

  // 3. Center Sight Screen & Pavilion behind Bowler (keeps red ball super visible)
  const sightW = Math.min(110, w * 0.14);
  const sightH = standHeight * 0.62;
  const sightX = w * 0.5 - sightW * 0.5;
  const sightY = horizonY - sightH - 10;
  ctx.fillStyle = nightFactor > 0.5 ? '#CBD5E1' : '#F8FAFC';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(sightX, sightY, sightW, sightH, 4);
  ctx.fill();
  ctx.stroke();

  // Subtle scoreboard header on sight screen
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(sightX + 8, sightY + 5, sightW - 16, 10);
  ctx.fillStyle = isShouting ? '#FACC15' : '#4ADE80';
  ctx.font = '700 8px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    isShouting ? (shoutType === 'SIX' ? 'MAXIMUM 6!' : 'BOUNDARY 4!') : 'CRICKET OVAL',
    w * 0.5,
    sightY + 12.5
  );

  // 4. Full Packed Crowd across all 5 tiers!
  const crowdColors = [
    '#F87171',
    '#FBBF24',
    '#38BDF8',
    '#A78BFA',
    '#34D399',
    '#FB923C',
    '#F472B6',
    '#FDE047',
  ];
  const headColors = ['#FDE68A', '#FED7AA', '#FECACA', '#D9F99D', '#E9D5FF'];
  const spacing = 13;

  for (let row = 0; row < tierCount; row++) {
    const rowNorm = row / (tierCount - 1);
    const baseRowY = standTopY + 14 + rowNorm * (standHeight - 28);
    const rowScale = 0.78 + rowNorm * 0.28;
    const xOffset = (row % 2) * (spacing * 0.5);

    for (let x = -10 + xOffset; x < w + 16; x += spacing) {
      // Leave center sight screen unobstructed in middle rows
      if (x > sightX - 4 && x < sightX + sightW + 4 && baseRowY > sightY - 2 && baseRowY < horizonY - 10) {
        continue;
      }

      const idx = Math.floor(x / spacing) + row * 17;
      const mexWave = isShouting
        ? Math.max(0, Math.sin(time * 9 - x * 0.015)) * (shoutType === 'SIX' ? 9 : 6)
        : 0;
      const bounceSpeed = isShouting ? 15 : 4.5 + excitement * 10;
      const bounceAmp = isShouting ? (shoutType === 'SIX' ? 7 : 5) : 1.2 + excitement * 5;
      const jump = Math.abs(Math.sin(time * bounceSpeed + idx * 0.75)) * bounceAmp + mexWave;

      const sy = baseRowY - jump;
      const shirtColor = crowdColors[idx % crowdColors.length];
      const faceColor = headColors[idx % headColors.length];

      // Spectator shoulders / jersey
      ctx.fillStyle = shirtColor;
      ctx.beginPath();
      ctx.roundRect(x - 4.5 * rowScale, sy - 4 * rowScale, 9 * rowScale, 8 * rowScale, 3);
      ctx.fill();

      // Raised cheering arms when excited or shouting!
      if (isShouting || excitement > 0.35 || idx % 9 === 0) {
        const armWave = Math.sin(time * 16 + idx) * 2.2;
        ctx.strokeStyle = faceColor;
        ctx.lineWidth = 1.6 * rowScale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 4 * rowScale, sy - 2 * rowScale);
        ctx.lineTo(x - 7 * rowScale, sy - 9 * rowScale + armWave);
        ctx.moveTo(x + 4 * rowScale, sy - 2 * rowScale);
        ctx.lineTo(x + 7 * rowScale, sy - 9 * rowScale - armWave);
        ctx.stroke();
      }

      // Spectator head
      ctx.fillStyle = faceColor;
      ctx.beginPath();
      ctx.arc(x, sy - 6.5 * rowScale, 3.6 * rowScale, 0, Math.PI * 2);
      ctx.fill();

      // Open shouting mouth when roaring after 4 or 6!
      if (isShouting) {
        ctx.fillStyle = '#7F1D1D';
        ctx.beginPath();
        ctx.arc(x, sy - 5.6 * rowScale, 1.3 * rowScale, 0, Math.PI * 2);
        ctx.fill();
      }

      // Some spectators wave colorful mini stadium flags
      if ((isShouting && idx % 5 === 0) || idx % 14 === 0) {
        const flagTilt = Math.sin(time * (isShouting ? 18 : 5) + idx) * 3.5;
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x + 6 * rowScale, sy - 7 * rowScale);
        ctx.lineTo(x + 6 * rowScale + flagTilt, sy - 17 * rowScale);
        ctx.stroke();

        ctx.fillStyle = crowdColors[(idx + 3) % crowdColors.length];
        ctx.beginPath();
        ctx.moveTo(x + 6 * rowScale + flagTilt, sy - 17 * rowScale);
        ctx.lineTo(x + 13 * rowScale + flagTilt, sy - 14.5 * rowScale);
        ctx.lineTo(x + 6 * rowScale + flagTilt, sy - 12 * rowScale);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // 5. Roofline Pennant Flags across the stadium
  const flagCount = Math.max(7, Math.floor(w / 110));
  for (let i = 0; i <= flagCount; i++) {
    const fx = (i / flagCount) * w;
    const fy = standTopY + 4;
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx, fy - 18);
    ctx.stroke();

    const wave = Math.sin(time * (isShouting ? 12 : 4.5) + i) * 3.5;
    ctx.fillStyle = i % 2 === 0 ? '#EF4444' : '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(fx, fy - 18);
    ctx.lineTo(fx + 14, fy - 14 + wave);
    ctx.lineTo(fx, fy - 10);
    ctx.closePath();
    ctx.fill();
  }

  // 6. Visible Crowd Shout Bubbles & Sound Waves across the Stadium!
  if (isShouting) {
    const shoutWords =
      shoutType === 'SIX'
        ? ['SIX!!', 'ROAR!!', 'MONSTER!', 'WOOO!', 'YEAH!!']
        : shoutType === 'FOUR'
        ? ['FOUR!!', 'SHOT!!', 'YEAH!', 'NICE!!', 'CLAP!']
        : ['RUN!!', 'GO!!', 'HUSTLE!', 'YES!!', 'CLAP!'];
    const anchorFractions = [0.1, 0.28, 0.5, 0.72, 0.9];
    const pulse = Math.min(1, shoutTimer / 0.4);

    anchorFractions.forEach((xf, i) => {
      const bx = w * xf;
      const bob = Math.sin(time * 14 + i * 1.4) * 4;
      const by = standTopY - 8 + bob - (i === 2 ? 12 : 0);
      const word = shoutWords[i % shoutWords.length];

      ctx.save();
      ctx.globalAlpha = Math.min(1, pulse * 1.1);
      ctx.translate(bx, by);

      // Sound shout wave arcs
      ctx.strokeStyle =
        shoutType === 'SIX'
          ? 'rgba(250, 204, 21, 0.85)'
          : shoutType === 'FOUR'
          ? 'rgba(56, 189, 248, 0.85)'
          : 'rgba(74, 222, 128, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 6, 20 + Math.sin(time * 18 + i) * 3, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();

      // Shout text bubble
      ctx.font = '700 13px "Fredoka", system-ui, sans-serif';
      const tw = ctx.measureText(word).width + 14;
      ctx.fillStyle =
        shoutType === 'SIX' ? '#FEF08A' : shoutType === 'FOUR' ? '#E0F2FE' : '#DCFCE7';
      ctx.strokeStyle =
        shoutType === 'SIX' ? '#B45309' : shoutType === 'FOUR' ? '#0369A1' : '#15803D';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-tw * 0.5, -13, tw, 22, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(word, 0, -2);
      ctx.restore();
    });
  }
}

function drawCreaseLines(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2.5;

  // Batter popping crease
  const pL = projectWorld(-1.25, 0, 0.06, w, h);
  const pR = projectWorld(1.25, 0, 0.06, w, h);
  ctx.beginPath();
  ctx.moveTo(pL.sx, pL.sy);
  ctx.lineTo(pR.sx, pR.sy);
  ctx.stroke();

  // Batter bowling crease
  const bL = projectWorld(-0.95, 0, -0.05, w, h);
  const bR = projectWorld(0.95, 0, -0.05, w, h);
  ctx.beginPath();
  ctx.moveTo(bL.sx, bL.sy);
  ctx.lineTo(bR.sx, bR.sy);
  ctx.stroke();

  // Return creases
  const rl1 = projectWorld(-0.82, 0, 0.14, w, h);
  const rl2 = projectWorld(-0.82, 0, -0.14, w, h);
  const rr1 = projectWorld(0.82, 0, 0.14, w, h);
  const rr2 = projectWorld(0.82, 0, -0.14, w, h);
  ctx.beginPath();
  ctx.moveTo(rl1.sx, rl1.sy);
  ctx.lineTo(rl2.sx, rl2.sy);
  ctx.moveTo(rr1.sx, rr1.sy);
  ctx.lineTo(rr2.sx, rr2.sy);
  ctx.stroke();

  // Far crease
  const fL = projectWorld(-1.1, 0, 0.96, w, h);
  const fR = projectWorld(1.1, 0, 0.96, w, h);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(fL.sx, fL.sy);
  ctx.lineTo(fR.sx, fR.sy);
  ctx.stroke();

  ctx.restore();
}

function drawStumps(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pz: number,
  isFar: boolean,
  _unused: unknown[]
) {
  const stumpOffsets = [-0.22, 0, 0.22];
  const stumpHeight = isFar ? 0.42 : 0.48;
  const lineWidth = isFar ? 3.5 : 6;

  ctx.save();
  ctx.lineCap = 'round';
  const tops: Array<{ x: number; y: number }> = [];

  for (const ox of stumpOffsets) {
    const base = projectWorld(ox, 0, pz, w, h);
    const top = projectWorld(ox, stumpHeight, pz, w, h);
    tops.push({ x: top.sx, y: top.sy });

    // Stump shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(base.sx + 2, base.sy);
    ctx.lineTo(base.sx + 10 * base.scale, base.sy + 4 * base.scale);
    ctx.stroke();

    // Wooden stump
    ctx.strokeStyle = '#FEF3C7';
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(base.sx, base.sy);
    ctx.lineTo(top.sx, top.sy);
    ctx.stroke();

    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Bails on top
  if (tops.length === 3) {
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = isFar ? 2.5 : 4;
    ctx.beginPath();
    ctx.moveTo(tops[0].x, tops[0].y);
    ctx.lineTo(tops[1].x, tops[1].y - 1);
    ctx.moveTo(tops[1].x, tops[1].y - 1);
    ctx.lineTo(tops[2].x, tops[2].y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShatteredStumps(ctx: CanvasRenderingContext2D, pieces: ShatteredPiece[]) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const p of pieces) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.isBail ? '#F59E0B' : '#FEF3C7';
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-p.len * 0.5, -p.width * 0.5, p.len, p.width, 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawBowlerSnail(
  ctx: CanvasRenderingContext2D,
  px: number,
  pz: number,
  windup: number,
  w: number,
  h: number,
  time: number
) {
  const hopPy = windup > 0 ? Math.sin(windup * Math.PI) * 0.14 : Math.abs(Math.sin(time * 2.5)) * 0.015;
  const pos = projectWorld(px, hopPy, pz, w, h);
  const { charScale } = getLayoutMetrics(w, h);
  const sc = pos.scale * charScale;

  ctx.save();
  ctx.translate(pos.sx, pos.sy);
  ctx.scale(sc, sc);

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Snail body
  ctx.fillStyle = '#FCD34D';
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -4, 24, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Snail shell on back
  ctx.fillStyle = '#EA580C';
  ctx.strokeStyle = '#9A3412';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(8, -14, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Shell spiral
  ctx.strokeStyle = '#FDBA74';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(8, -14, 7, 0.2, Math.PI * 1.7);
  ctx.stroke();

  // Head & eye stalks
  ctx.fillStyle = '#FDE68A';
  ctx.beginPath();
  ctx.arc(-16, -11, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Stalk eyes
  [-20, -12].forEach((ex) => {
    ctx.beginPath();
    ctx.moveTo(ex, -18);
    ctx.lineTo(ex - 1, -27);
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex - 1, -28, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(ex - 1, -28, 1.8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Cute cricket cap on snail
  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.arc(-16, -15, 7, Math.PI, 0);
  ctx.fill();

  ctx.restore();
}

function drawFielderSnail(
  ctx: CanvasRenderingContext2D,
  f: FielderSnail,
  w: number,
  h: number,
  time: number
) {
  const idleBob = f.celebrateTimer > 0 ? Math.abs(Math.sin(time * 16)) * 0.12 : 0;
  const pos = projectWorld(f.px, f.jumpPy + idleBob, f.pz, w, h);
  const { charScale } = getLayoutMetrics(w, h);
  const sc = pos.scale * charScale * 0.94;

  ctx.save();
  ctx.translate(pos.sx, pos.sy);
  ctx.scale(sc, sc);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = '#FDE68A';
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(0, -3, 19, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Shell
  ctx.fillStyle = f.shellColor;
  ctx.beginPath();
  ctx.arc(6, -11, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head + Cap
  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(-12, -9, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = f.capColor;
  ctx.beginPath();
  ctx.arc(-12, -12, 6.5, Math.PI, 0);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(-14, -10, 1.5, 0, Math.PI * 2);
  ctx.arc(-9, -10, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBatterCricket(ctx: CanvasRenderingContext2D, s: RenderContextState, w: number, h: number) {
  // Position cricket slightly left of stumps, or sprinting along pitch if scoring 1/2/3
  const runOffsetPz = s.batterRunProgress > 0 ? Math.sin(s.batterRunProgress * Math.PI) * 0.72 : 0;
  const runHopPy = s.batterRunProgress > 0 ? Math.abs(Math.sin(s.batterRunProgress * Math.PI * 6)) * 0.08 : 0;
  const celebHopPy = s.batterCelebrateTimer > 0 ? Math.abs(Math.sin(s.time * 14)) * 0.14 : 0;

  const pos = projectWorld(-0.56, runHopPy + celebHopPy, 0.02 + runOffsetPz, w, h);
  const { charScale } = getLayoutMetrics(w, h);
  const sc = pos.scale * charScale * 1.04;

  ctx.save();
  ctx.translate(pos.sx, pos.sy);
  ctx.scale(sc, sc);

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 30, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cricket breathing bob
  const breathe = Math.sin(s.time * 4.5) * 1.6;
  const legStride = s.batterRunProgress > 0 ? Math.sin(s.time * 24) * 9 : 0;

  // Back cricket legs (green folded hind legs)
  ctx.strokeStyle = '#15803D';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, -14);
  ctx.lineTo(-22, -26 + legStride * 0.5);
  ctx.lineTo(-15, 2 + legStride);
  ctx.stroke();

  // White batting pads on front legs
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(-10 - legStride * 0.3, -18, 9, 22, 4);
  ctx.roundRect(2 + legStride * 0.3, -18, 9, 22, 4);
  ctx.fill();
  ctx.stroke();

  // Pad straps
  ctx.strokeStyle = '#2563EB';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10 - legStride * 0.3, -10);
  ctx.lineTo(-1 - legStride * 0.3, -10);
  ctx.moveTo(2 + legStride * 0.3, -10);
  ctx.lineTo(11 + legStride * 0.3, -10);
  ctx.stroke();

  // Cricket torso (vibrant lime-emerald jersey)
  ctx.fillStyle = '#22C55E';
  ctx.strokeStyle = '#14532D';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -28 + breathe, 14, 18, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Jersey stripe
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.roundRect(-8, -32 + breathe, 16, 6, 3);
  ctx.fill();

  // Head
  ctx.fillStyle = '#4ADE80';
  ctx.strokeStyle = '#14532D';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(2, -49 + breathe, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Expressive eyes
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(7, -50 + breathe, 3.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  if (s.batterSadTimer > 0) {
    // X-eyes or dizzy eyes when out
    ctx.arc(7.5, -50 + breathe, 1.5, 0, Math.PI * 2);
  } else {
    ctx.arc(8, -50 + breathe, 2.1, 0, Math.PI * 2);
  }
  ctx.fill();

  // Blue Cricket Helmet + Peak + Grill
  ctx.fillStyle = '#2563EB';
  ctx.strokeStyle = '#1E3A8A';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(1, -52 + breathe, 11.5, Math.PI * 0.95, Math.PI * 2.08);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Helmet visor peak
  ctx.beginPath();
  ctx.moveTo(9, -53 + breathe);
  ctx.lineTo(17, -51 + breathe);
  ctx.strokeStyle = '#1D4ED8';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Bobbing antennae poking through/above helmet!
  const antWave = Math.sin(s.time * 6) * 4;
  ctx.strokeStyle = '#15803D';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, -62 + breathe);
  ctx.quadraticCurveTo(-10, -76 + antWave, -18, -73 + antWave);
  ctx.moveTo(3, -62 + breathe);
  ctx.quadraticCurveTo(8, -77 - antWave, 15, -75 - antWave);
  ctx.stroke();

  // Cricket Bat & Swing Arc!
  let batAngle = -0.35 + Math.sin(s.time * 5) * 0.08; // Gentle ready stance tap
  if (s.batterCelebrateTimer > 0) {
    batAngle = -2.4 + Math.sin(s.time * 14) * 0.25; // Raised bat salute!
  } else if (s.swingPhase === 'SWINGING') {
    // Fast whip from backlift (-2.35 rad) down through hitting zone (+0.75 rad)
    const eased = 1 - Math.pow(1 - s.swingProgress, 2.5);
    batAngle = -2.35 + eased * (3.15 + s.swingAim * 0.35);
  } else if (s.swingPhase === 'FOLLOW_THROUGH') {
    const endAngle = 0.8 + s.swingAim * 0.35;
    batAngle = endAngle + (1 - s.swingProgress) * 0.2;
  }

  // Motion blur swoosh trail during active swing
  if (s.swingPhase === 'SWINGING' && s.swingProgress > 0.15) {
    ctx.save();
    ctx.translate(7, -28 + breathe);
    ctx.beginPath();
    ctx.arc(0, 0, 44, batAngle - 1.1, batAngle);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  // Draw the willow bat pivoted at the hands
  ctx.save();
  ctx.translate(7, -28 + breathe);
  ctx.rotate(batAngle);

  // Handle
  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.roundRect(-2.5, 0, 5, 16, 2);
  ctx.fill();

  // Willow blade
  ctx.fillStyle = '#FDE68A';
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(-5.5, 15, 11, 34, 3);
  ctx.fill();
  ctx.stroke();

  // Center spine highlight on bat
  ctx.fillStyle = '#FEF3C7';
  ctx.fillRect(-1.5, 17, 3, 28);

  ctx.restore();

  // Front gloved hand
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#2563EB';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(7, -28 + breathe, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawBallAndTrail(ctx: CanvasRenderingContext2D, s: RenderContextState, w: number, h: number) {
  // Ground shadow directly beneath ball at py = 0
  const shadowProj = projectWorld(s.ballPx, 0, s.ballPz, w, h);
  const heightFade = Math.max(0.25, 1 - s.ballPy * 0.28);
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${0.28 * heightFade})`;
  ctx.beginPath();
  ctx.ellipse(
    shadowProj.sx,
    shadowProj.sy,
    10 * shadowProj.scale * heightFade,
    4.5 * shadowProj.scale * heightFade,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  // Motion trail
  if (s.ballTrail.length > 1) {
    for (let i = 0; i < s.ballTrail.length; i++) {
      const pt = s.ballTrail[i];
      const pProj = projectWorld(pt.px, pt.py, pt.pz, w, h);
      const t = (i + 1) / s.ballTrail.length;
      const radius = 8.5 * pProj.scale * (0.4 + t * 0.55);
      ctx.fillStyle =
        s.ballPhase === 'HIT_FLIGHT'
          ? `rgba(253, 224, 71, ${t * 0.42})`
          : `rgba(239, 68, 68, ${t * 0.25})`;
      ctx.beginPath();
      ctx.arc(pProj.sx, pProj.sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Main red leather cricket ball
  const ballProj = projectWorld(s.ballPx, s.ballPy, s.ballPz, w, h);
  const r = Math.max(4, 9.5 * ballProj.scale);

  ctx.save();
  ctx.translate(ballProj.sx, ballProj.sy);

  // Leather gradient
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.15, 0, 0, r);
  grad.addColorStop(0, '#F87171');
  grad.addColorStop(0.55, '#DC2626');
  grad.addColorStop(1, '#7F1D1D');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // White cricket ball seam rotating
  ctx.rotate(s.ballSpinAngle);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.setLineDash([r * 0.35, r * 0.25]);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.88, r * 0.38, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}
