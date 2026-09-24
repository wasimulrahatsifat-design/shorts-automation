'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  SPECIAL_POWERS,
  COLOR_SWATCHES,
  ContestantConfig,
  ArenaItem,
  Bullet,
  Particle,
  FloatingText,
  LiveFighter,
  ARENA_CENTER,
  ARENA_BOX,
  ARENA_RADIUS,
  BOX_SIZE,
} from './types';
import {
  generateArenaSimulation,
  SimulationResult,
  SimFrameState,
  SimFighter,
  BEN10_DEFAULT_ABILITIES,
  AlienType,
  getAlienType,
} from '../../lib/arena-physics';

export { SPECIAL_POWERS, COLOR_SWATCHES };
export type { ContestantConfig };

const BEN10_ALIEN_PRESETS: ContestantConfig[] = [
  {
    id: 'four_arms',
    name: 'Four Arms',
    color: '#dc2626',
    image_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&auto=format&fit=crop&q=80',
    starting_health: 120,
    damage: 32,
    speed: 5.8,
    special_power: 'berserker',
    special_ability: BEN10_DEFAULT_ABILITIES['four_arms'],
  },
  {
    id: 'heatblast',
    name: 'Heatblast',
    color: '#ea580c',
    image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
    starting_health: 100,
    damage: 28,
    speed: 6.8,
    special_power: 'thorns',
    special_ability: BEN10_DEFAULT_ABILITIES['heatblast'],
  },
  {
    id: 'xlr8',
    name: 'XLR8',
    color: '#0284c7',
    image_url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=300&auto=format&fit=crop&q=80',
    starting_health: 90,
    damage: 20,
    speed: 14.0, // Significantly faster than other balls
    special_power: 'speedster',
    special_ability: BEN10_DEFAULT_ABILITIES['xlr8'],
  },
  {
    id: 'diamondhead',
    name: 'Diamondhead',
    color: '#10b981',
    image_url: null,
    starting_health: 110,
    damage: 24,
    speed: 6.2,
    special_power: 'iron_shield',
    special_ability: BEN10_DEFAULT_ABILITIES['diamondhead'],
  },
  {
    id: 'cannonbolt',
    name: 'Cannonbolt',
    color: '#f59e0b',
    image_url: null,
    starting_health: 115,
    damage: 26,
    speed: 7.2,
    special_power: 'none',
    special_ability: BEN10_DEFAULT_ABILITIES['cannonbolt'],
  },
  {
    id: 'upgrade',
    name: 'Upgrade',
    color: '#22c55e',
    image_url: null,
    starting_health: 95,
    damage: 24,
    speed: 6.5,
    special_power: 'vampiric',
    special_ability: BEN10_DEFAULT_ABILITIES['upgrade'],
  },
  {
    id: 'ghostfreak',
    name: 'Ghostfreak',
    color: '#94a3b8',
    image_url: null,
    starting_health: 85,
    damage: 22,
    speed: 7.0,
    special_power: 'phoenix',
    special_ability: BEN10_DEFAULT_ABILITIES['ghostfreak'],
  },
  {
    id: 'ripjaws',
    name: 'Ripjaws',
    color: '#06b6d4',
    image_url: null,
    starting_health: 100,
    damage: 27,
    speed: 6.6,
    special_power: 'none',
    special_ability: BEN10_DEFAULT_ABILITIES['ripjaws'],
  },
  {
    id: 'wildmutt',
    name: 'Wildmutt',
    color: '#f97316',
    image_url: null,
    starting_health: 105,
    damage: 26,
    speed: 7.2,
    special_power: 'none',
    special_ability: BEN10_DEFAULT_ABILITIES['wildmutt'],
  },
];

const PRESET_ABILITIES = [
  BEN10_DEFAULT_ABILITIES['four_arms'],
  BEN10_DEFAULT_ABILITIES['heatblast'],
  BEN10_DEFAULT_ABILITIES['xlr8'],
  BEN10_DEFAULT_ABILITIES['diamondhead'],
  BEN10_DEFAULT_ABILITIES['cannonbolt'],
  BEN10_DEFAULT_ABILITIES['upgrade'],
  BEN10_DEFAULT_ABILITIES['ghostfreak'],
  BEN10_DEFAULT_ABILITIES['ripjaws'],
  BEN10_DEFAULT_ABILITIES['wildmutt'],
];

const PRESET_TOPICS = [
  { topic: 'Ben 10 Omnitrix Clash', names: ['Four Arms', 'Heatblast', 'XLR8', 'Diamondhead', 'Cannonbolt', 'Upgrade', 'Ghostfreak', 'Ripjaws', 'Wildmutt'] },
  { topic: 'Marvel vs DC', names: ['Iron Man', 'Batman', 'Spider-Man', 'Superman'] },
  { topic: 'Anime Titans', names: ['Goku', 'Naruto', 'Luffy', 'Ichigo'] },
  { topic: 'Monsters Clash', names: ['Godzilla', 'Kong', 'T-Rex', 'Megalodon'] },
];

export default function GamePage() {
  // Topic and Contestants State
  const [topic, setTopic] = useState('Ben 10 Omnitrix Clash');
  const [contestantCount, setContestantCount] = useState<number>(4);
  const [contestants, setContestants] = useState<ContestantConfig[]>([]);

  // Audio & Simulation Controls
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [aliveCount, setAliveCount] = useState(4);
  const [winner, setWinner] = useState<LiveFighter | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Queue State
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueMessage, setQueueMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Image Crop & Framing Modal State
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropTargetIndex, setCropTargetIndex] = useState<number | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [rawImgNaturalSize, setRawImgNaturalSize] = useState<{ width: number; height: number }>({ width: 300, height: 300 });
  const [cropScale, setCropScale] = useState<number>(1);
  const [cropPan, setCropPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Interactive Ben 10 Omnitrix Selection State
  type SelectionPhase = 'idle' | 'select_p1' | 'select_p2' | 'hero_time' | 'battling';
  const [selectionPhase, setSelectionPhase] = useState<SelectionPhase>('idle');
  const selectionPhaseRef = useRef<SelectionPhase>('idle');
  useEffect(() => {
    selectionPhaseRef.current = selectionPhase;
  }, [selectionPhase]);

  const [p1Index, setP1Index] = useState<number>(0);
  const [p2Index, setP2Index] = useState<number>(1);
  const [selectedP1, setSelectedP1] = useState<ContestantConfig | null>(null);
  const [selectedP2, setSelectedP2] = useState<ContestantConfig | null>(null);
  const [dialRotationAngle, setDialRotationAngle] = useState<number>(0);
  const [greenFlash, setGreenFlash] = useState<boolean>(false);
  const [heroTimeBanner, setHeroTimeBanner] = useState<boolean>(false);

  // Preload Omnitrix rotation animation GIF
  useEffect(() => {
    const rotImg = new Image();
    rotImg.src = '/images/omnitrix_rotation.gif';
    rotImg.onload = () => {
      loadedImagesRef.current.set('/images/omnitrix_rotation.gif', rotImg);
    };
  }, []);

  // Canvas & Engine Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Simulation State Refs
  const battleSeedRef = useRef<number>(Math.floor(Math.random() * 1000000));
  const simResultRef = useRef<SimulationResult | null>(null);
  const currentFrameRef = useRef<number>(0);
  const lastSoundFrameRef = useRef<number>(-1);
  const screenShakeRef = useRef(0);

  // 1. Initialize Contestants with Ben 10 presets by default
  const handleLoadBen10 = () => {
    setTopic('Ben 10 Omnitrix Clash');
    setContestantCount(BEN10_ALIEN_PRESETS.length);
    setContestants(BEN10_ALIEN_PRESETS.map((alien) => ({ ...alien })));
    initSimulation(true);
  };

  const handleLoadPreset = (index: number) => {
    const selected = PRESET_TOPICS[index];
    if (!selected) return;
    setTopic(selected.topic);
    if (selected.topic === 'Ben 10 Omnitrix Clash') {
      handleLoadBen10();
      return;
    }
    setContestantCount(selected.names.length);
    setContestants(
      selected.names.map((name, i) => ({
        id: `fighter_${i + 1}`,
        name,
        color: COLOR_SWATCHES[i % COLOR_SWATCHES.length].hex,
        image_url: null,
        starting_health: 100,
        damage: 25,
        speed: 6.5,
        special_power: SPECIAL_POWERS[(i % (SPECIAL_POWERS.length - 1)) + 1].id,
        special_ability: PRESET_ABILITIES[i % PRESET_ABILITIES.length],
      }))
    );
    initSimulation(true);
  };

  useEffect(() => {
    setContestants((prev) => {
      const updated: ContestantConfig[] = [];

      for (let i = 0; i < contestantCount; i++) {
        if (prev[i]) {
          updated.push(prev[i]);
        } else {
          const alien = BEN10_ALIEN_PRESETS[i % BEN10_ALIEN_PRESETS.length];
          updated.push({
            id: alien.id || `fighter_${i + 1}`,
            name: alien.name,
            color: alien.color,
            image_url: alien.image_url,
            starting_health: alien.starting_health,
            damage: alien.damage,
            speed: alien.speed,
            special_power: alien.special_power,
            special_ability: alien.special_ability,
          });
        }
      }
      return updated;
    });
  }, [contestantCount]);

  // Fullscreen ESC Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // 2. Web Audio Synthesizer
  const getAudioContext = () => {
    if (!audioCtxRef.current && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playSound = (type: 'bounce' | 'hit' | 'heal' | 'item' | 'gun' | 'explosion' | 'victory' | 'ability') => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      if (type === 'bounce') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.25 * soundVolume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'hit') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.5 * soundVolume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'item') {
        [440, 660, 880].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.05);
          gain.gain.setValueAtTime(0.3 * soundVolume, ctx.currentTime + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.05 + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.05);
          osc.stop(ctx.currentTime + idx * 0.05 + 0.12);
        });
      } else if (type === 'gun') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(900, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.4 * soundVolume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'heal') {
        [523.25, 659.25].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
          gain.gain.setValueAtTime(0.3 * soundVolume, ctx.currentTime + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.08);
          osc.stop(ctx.currentTime + idx * 0.08 + 0.2);
        });
      } else if (type === 'explosion') {
        const bufferSize = ctx.sampleRate * 0.35;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.35);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.7 * soundVolume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
        noise.stop(ctx.currentTime + 0.35);
      } else if (type === 'victory') {
        [261.63, 329.63, 392.0, 523.25].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
          gain.gain.setValueAtTime(0.4 * soundVolume, ctx.currentTime + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.1);
          osc.stop(ctx.currentTime + i * 0.1 + 0.35);
        });
      } else if (type === 'ability') {
        [587.33, 880, 1174.66].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.04);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + idx * 0.04 + 0.15);
          gain.gain.setValueAtTime(0.35 * soundVolume, ctx.currentTime + idx * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.04 + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.04);
          osc.stop(ctx.currentTime + idx * 0.04 + 0.2);
        });
      }
    } catch (e) {}
  };

  // 3. Initialize & Precompute Simulation
  const initSimulation = (rollNewSeed = false) => {
    if (selectionPhaseRef.current === 'battling' || selectionPhaseRef.current === 'hero_time') return;

    if (rollNewSeed) {
      battleSeedRef.current = Math.floor(Math.random() * 1000000);
    }

    // Preload image elements if any
    contestants.forEach((c) => {
      if (c.image_url) {
        let img = loadedImagesRef.current.get(c.image_url);
        if (!img) {
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            drawFrame();
          };
          img.src = c.image_url;
          loadedImagesRef.current.set(c.image_url, img);
        } else if (!img.complete) {
          img.onload = () => {
            drawFrame();
          };
        }
      }
    });

    const sim = generateArenaSimulation(
      contestants.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        image_url: c.image_url,
        starting_health: c.starting_health,
        damage: c.damage,
        speed: c.speed,
        special_power: c.special_power,
        special_ability: c.special_ability,
      })),
      3600,
      battleSeedRef.current
    );

    simResultRef.current = sim;
    currentFrameRef.current = 0;
    lastSoundFrameRef.current = -1;
    setWinner(null);
    setAliveCount(contestants.length);

    if (sim.frames.length > 0) {
      drawFrame(sim.frames[0]);
    }
  };

  useEffect(() => {
    initSimulation(false);
  }, [contestants, topic]);

  // Helper: Draw authentic Ben 10 Omnitrix dial on floor
  const drawOmnitrixDial = (ctx: CanvasRenderingContext2D, cx: number, cy: number, dialRadius: number) => {
    ctx.save();

    // 1. Intense Outer Neon Green Aura Glow
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 35;
    ctx.beginPath();
    ctx.arc(cx, cy, dialRadius + 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 255, 102, 0.2)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#00ff66';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 2. Outer Bezel / Rim
    ctx.beginPath();
    ctx.arc(cx, cy, dialRadius + 4, 0, Math.PI * 2);
    ctx.fillStyle = '#020b05';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#062d12';
    ctx.stroke();

    // 3. Dial Face Jet Black Base Disc
    ctx.beginPath();
    ctx.arc(cx, cy, dialRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // 4. Ben 10 Alien Lime Green Radial Gradient
    const omniGrad = ctx.createRadialGradient(cx, cy - dialRadius * 0.25, dialRadius * 0.1, cx, cy, dialRadius);
    omniGrad.addColorStop(0, '#8aff7b');
    omniGrad.addColorStop(0.3, '#39ff14');
    omniGrad.addColorStop(0.7, '#00cc44');
    omniGrad.addColorStop(1, '#006622');

    const spreadAngle = 36 * (Math.PI / 180); // 36 degrees from vertical
    const halfWaist = 6;

    // 5. Top Green Sector
    const topStartAngle = -Math.PI / 2 - spreadAngle;
    const topEndAngle = -Math.PI / 2 + spreadAngle;
    ctx.beginPath();
    ctx.moveTo(cx - halfWaist, cy - 3);
    ctx.arc(cx, cy, dialRadius - 2, topStartAngle, topEndAngle, false);
    ctx.lineTo(cx + halfWaist, cy - 3);
    ctx.closePath();
    ctx.fillStyle = omniGrad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#003810';
    ctx.stroke();

    // 6. Bottom Green Sector
    const botStartAngle = Math.PI / 2 - spreadAngle;
    const botEndAngle = Math.PI / 2 + spreadAngle;
    ctx.beginPath();
    ctx.moveTo(cx + halfWaist, cy + 3);
    ctx.arc(cx, cy, dialRadius - 2, botStartAngle, botEndAngle, false);
    ctx.lineTo(cx - halfWaist, cy + 3);
    ctx.closePath();
    ctx.fillStyle = omniGrad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#003810';
    ctx.stroke();

    // 7. Center Waist Bridge
    ctx.fillStyle = '#39ff14';
    ctx.fillRect(cx - halfWaist, cy - 3, halfWaist * 2, 6);

    // 8. Subtle Inner Metallic Highlight
    ctx.beginPath();
    ctx.arc(cx, cy, dialRadius - 2, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.stroke();

    ctx.restore();
  };

  // 4. Draw Frame on Canvas (Uses SimFrameState)
  const drawFrame = (frameState?: SimFrameState | null) => {
    const canvases = [canvasRef.current, fullscreenCanvasRef.current].filter(Boolean) as HTMLCanvasElement[];
    if (canvases.length === 0) return;

    const sim = simResultRef.current;
    const current = frameState || (sim ? sim.frames[Math.min(sim.frames.length - 1, Math.floor(currentFrameRef.current))] : null);
    if (!current) return;

    const { fighters, items, bullets, particles, floatingTexts, winner: frameWinner } = current;

    canvases.forEach((canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = 1080;
      const height = 1920;
      const { x: cx, y: cy } = ARENA_CENTER;

      ctx.save();

      // Minimalist deep black background
      ctx.fillStyle = '#05070c';
      ctx.fillRect(0, 0, width, height);

      // Subtle grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 120) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Ben 10 Square Arena Floor (ARENA_BOX: 900x900)
      ctx.save();
      ctx.fillStyle = '#030c06';
      ctx.fillRect(ARENA_BOX.left, ARENA_BOX.top, ARENA_BOX.width, ARENA_BOX.height);

      // Subtle Mechamorph Green Grid Lines
      ctx.strokeStyle = 'rgba(0, 255, 102, 0.06)';
      ctx.lineWidth = 1.5;
      for (let x = ARENA_BOX.left; x <= ARENA_BOX.right; x += 45) {
        ctx.beginPath();
        ctx.moveTo(x, ARENA_BOX.top);
        ctx.lineTo(x, ARENA_BOX.bottom);
        ctx.stroke();
      }
      for (let y = ARENA_BOX.top; y <= ARENA_BOX.bottom; y += 45) {
        ctx.beginPath();
        ctx.moveTo(ARENA_BOX.left, y);
        ctx.lineTo(ARENA_BOX.right, y);
        ctx.stroke();
      }

      // Ben 10 Omnitrix Center Dial on floor
      const dialRadius = 135;
      drawOmnitrixDial(ctx, cx, cy, dialRadius);

      // Glowing Neon Omnitrix Square Wall
      ctx.beginPath();
      ctx.rect(ARENA_BOX.left, ARENA_BOX.top, ARENA_BOX.width, ARENA_BOX.height);
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#00ff66';
      ctx.shadowColor = '#00ff66';
      ctx.shadowBlur = 28;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 4 Corner Sci-Fi Brackets
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#00ff66';
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(ARENA_BOX.left + 35, ARENA_BOX.top);
      ctx.lineTo(ARENA_BOX.left, ARENA_BOX.top);
      ctx.lineTo(ARENA_BOX.left, ARENA_BOX.top + 35);
      ctx.stroke();
      // Top-Right
      ctx.beginPath();
      ctx.moveTo(ARENA_BOX.right - 35, ARENA_BOX.top);
      ctx.lineTo(ARENA_BOX.right, ARENA_BOX.top);
      ctx.lineTo(ARENA_BOX.right, ARENA_BOX.top + 35);
      ctx.stroke();
      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(ARENA_BOX.left + 35, ARENA_BOX.bottom);
      ctx.lineTo(ARENA_BOX.left, ARENA_BOX.bottom);
      ctx.lineTo(ARENA_BOX.left, ARENA_BOX.bottom - 35);
      ctx.stroke();
      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(ARENA_BOX.right - 35, ARENA_BOX.bottom);
      ctx.lineTo(ARENA_BOX.right, ARENA_BOX.bottom);
      ctx.lineTo(ARENA_BOX.right, ARENA_BOX.bottom - 35);
      ctx.stroke();
      ctx.restore();

      // Draw Items
      items.forEach((item) => {
        const bob = Math.sin((currentFrameRef.current * 0.08) + item.bobOffset) * 6;
        ctx.save();
        ctx.translate(item.x, item.y + bob);

        ctx.beginPath();
        ctx.arc(0, 0, 36, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.shadowColor = item.color;
        ctx.shadowBlur = 25;
        ctx.globalAlpha = 0.25;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fillStyle = '#031408';
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();

        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.icon, 0, 2);

        ctx.font = '800 14px "Montserrat", sans-serif';
        ctx.fillStyle = item.color;
        ctx.fillText(item.name, 0, 42);
        ctx.restore();
      });

      // Bullets
      bullets.forEach((b) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.restore();
      });

      // Particles
      particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      });

      // Contestants (Spherical Alien Balls with Alien-Specific Visual Effects & Centered Live HP)
      const currentPhase = selectionPhaseRef.current;
      let visibleFighters: SimFighter[] = [];
      if (currentPhase === 'hero_time' || currentPhase === 'battling') {
        visibleFighters = fighters;
      } else if (currentPhase === 'select_p2') {
        visibleFighters = fighters.slice(0, 1);
      } else {
        visibleFighters = [];
      }

      visibleFighters.forEach((f) => {
        if (f.isDead) return;

        const half = f.size / 2;
        const isCharged = (f.energyCharge || 0) >= 100 || f.specialMoveReady;
        const aType = getAlienType(f);
        const curFrame = currentFrameRef.current;

        ctx.save();
        ctx.translate(f.x, f.y);

        // ==========================================
        // 1. CHARACTER-SPECIFIC VISUAL EFFECTS (BEHIND / AROUND BALL)
        // ==========================================

        // --- HEATBLAST: ROARING FLAMES & EMBERS AROUND THE BALL ---
        if (aType === 'heatblast') {
          ctx.save();
          // Fiery roaring flame perimeter
          const numFlames = 24;
          ctx.beginPath();
          for (let i = 0; i <= numFlames; i++) {
            const th = (i / numFlames) * Math.PI * 2;
            const flameNoise =
              Math.sin(th * 7 + curFrame * 0.28) * 14 +
              Math.cos(th * 4 - curFrame * 0.18) * 9 +
              18;
            const flameR = half + Math.max(6, flameNoise);
            const fx = Math.cos(th) * flameR;
            const fy = Math.sin(th) * flameR;
            if (i === 0) ctx.moveTo(fx, fy);
            else ctx.lineTo(fx, fy);
          }
          ctx.closePath();

          const fireGrad = ctx.createRadialGradient(0, 0, half * 0.6, 0, 0, half + 36);
          fireGrad.addColorStop(0, 'rgba(255, 240, 50, 0.95)');
          fireGrad.addColorStop(0.35, 'rgba(255, 120, 0, 0.85)');
          fireGrad.addColorStop(0.7, 'rgba(220, 38, 38, 0.7)');
          fireGrad.addColorStop(1, 'rgba(150, 0, 0, 0)');
          ctx.fillStyle = fireGrad;
          ctx.shadowColor = '#ea580c';
          ctx.shadowBlur = 35;
          ctx.fill();

          // Inner white-hot flame tongues
          ctx.beginPath();
          for (let i = 0; i <= numFlames; i++) {
            const th = (i / numFlames) * Math.PI * 2;
            const flameNoise = Math.sin(th * 9 - curFrame * 0.35) * 6 + 10;
            const flameR = half + flameNoise;
            const fx = Math.cos(th) * flameR;
            const fy = Math.sin(th) * flameR;
            if (i === 0) ctx.moveTo(fx, fy);
            else ctx.lineTo(fx, fy);
          }
          ctx.closePath();
          ctx.fillStyle = 'rgba(255, 255, 200, 0.6)';
          ctx.fill();

          // Floating ember sparks around Heatblast
          for (let k = 0; k < 6; k++) {
            const sparkAngle = (k / 6) * Math.PI * 2 + curFrame * 0.08;
            const sparkDist = half + 14 + Math.sin(curFrame * 0.1 + k) * 12;
            const sx = Math.cos(sparkAngle) * sparkDist;
            const sy = Math.sin(sparkAngle) * sparkDist;
            ctx.beginPath();
            ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffe600';
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 10;
            ctx.fill();
          }
          ctx.restore();
        }

        // --- FOUR ARMS: 4 RED MUSCULAR ARMS (2 ON EACH SIDE) ---
        else if (aType === 'four_arms') {
          const drawAlienArm = (startX: number, startY: number, angle: number, isLeft: boolean) => {
            ctx.save();
            ctx.translate(startX, startY);
            ctx.rotate(angle);
            const punchFlex = Math.sin(curFrame * 0.18 + (isLeft ? 0 : Math.PI)) * 4;

            // Bicep / Forearm
            ctx.beginPath();
            ctx.moveTo(0, -12);
            ctx.quadraticCurveTo(18 + punchFlex, -16, 32 + punchFlex, -9);
            ctx.lineTo(34 + punchFlex, 9);
            ctx.quadraticCurveTo(18 + punchFlex, 16, 0, 12);
            ctx.closePath();
            ctx.fillStyle = '#dc2626';
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = '#7f1d1d';
            ctx.stroke();

            // Muscular definition line
            ctx.beginPath();
            ctx.moveTo(6, 0);
            ctx.lineTo(24 + punchFlex, 0);
            ctx.strokeStyle = '#991b1b';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Black wristband
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(30 + punchFlex, -11, 8, 22);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#ffffff';
            ctx.strokeRect(30 + punchFlex, -11, 8, 22);

            // Red Clenched Fist
            ctx.beginPath();
            ctx.arc(46 + punchFlex, 0, 13, 0, Math.PI * 2);
            ctx.fillStyle = '#b91c1c';
            ctx.fill();
            ctx.strokeStyle = '#7f1d1d';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Knuckles
            ctx.fillStyle = '#ef4444';
            for (let kn = -6; kn <= 6; kn += 4.5) {
              ctx.beginPath();
              ctx.arc(52 + punchFlex, kn, 3, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          };

          // 2 Arms on Left (Upper & Lower)
          drawAlienArm(-half + 6, -half * 0.38, Math.PI * 0.85, true);
          drawAlienArm(-half + 6, half * 0.38, Math.PI * 1.15, true);

          // 2 Arms on Right (Upper & Lower)
          drawAlienArm(half - 6, -half * 0.38, -Math.PI * 0.15, false);
          drawAlienArm(half - 6, half * 0.38, Math.PI * 0.15, false);
        }

        // --- XLR8: HIGH-SPEED CYAN DASH TRAILS & SPEED LINES ---
        else if (aType === 'xlr8') {
          const spd = Math.hypot(f.vx, f.vy);
          const moveAng = Math.atan2(f.vy, f.vx);
          const trailLen = Math.min(100, spd * 6 + 30);
          ctx.save();
          // Ghost trail spheres trailing behind
          for (let t = 1; t <= 3; t++) {
            const offset = t * 0.32;
            const tx = -Math.cos(moveAng) * trailLen * offset;
            const ty = -Math.sin(moveAng) * trailLen * offset;
            ctx.beginPath();
            ctx.arc(tx, ty, half * (1 - t * 0.18), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(2, 132, 199, ${0.4 - t * 0.1})`;
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 15;
            ctx.fill();
          }
          // Cyan speed dash lines
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3;
          for (let dl = -2; dl <= 2; dl++) {
            const perpX = -Math.sin(moveAng) * dl * 18;
            const perpY = Math.cos(moveAng) * dl * 18;
            ctx.beginPath();
            ctx.moveTo(perpX, perpY);
            ctx.lineTo(
              perpX - Math.cos(moveAng) * (trailLen * 0.85),
              perpY - Math.sin(moveAng) * (trailLen * 0.85)
            );
            ctx.stroke();
          }
          ctx.restore();
        }

        // --- DIAMONDHEAD: SHARP CRYSTAL SPARK SHARDS AROUND PERIMETER ---
        else if (aType === 'diamondhead') {
          ctx.save();
          const crystalShards = [
            { angle: -Math.PI / 2, length: half * 0.65, width: 22 },
            { angle: -Math.PI / 2 - 0.5, length: half * 0.55, width: 18 },
            { angle: -Math.PI / 2 + 0.5, length: half * 0.55, width: 18 },
            { angle: -Math.PI + 0.4, length: half * 0.45, width: 16 },
            { angle: -0.4, length: half * 0.45, width: 16 },
            { angle: -Math.PI + 0.9, length: half * 0.35, width: 14 },
            { angle: -0.9, length: half * 0.35, width: 14 },
            { angle: Math.PI / 2, length: half * 0.4, width: 15 },
          ];
          crystalShards.forEach((s) => {
            ctx.save();
            ctx.rotate(s.angle);
            const tipX = half + s.length;
            const baseX = half - 5;
            const hw = s.width / 2;

            // Left facet (mint highlight)
            ctx.beginPath();
            ctx.moveTo(baseX, -hw);
            ctx.lineTo(tipX, 0);
            ctx.lineTo(baseX, 0);
            ctx.closePath();
            ctx.fillStyle = '#6ee7b7';
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 14;
            ctx.fill();

            // Right facet (deep emerald)
            ctx.beginPath();
            ctx.moveTo(baseX, 0);
            ctx.lineTo(tipX, 0);
            ctx.lineTo(baseX, hw);
            ctx.closePath();
            ctx.fillStyle = '#059669';
            ctx.fill();

            // Facet edge & ridge
            ctx.beginPath();
            ctx.moveTo(baseX, -hw);
            ctx.lineTo(tipX, 0);
            ctx.lineTo(baseX, hw);
            ctx.strokeStyle = '#a7f3d0';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(baseX, 0);
            ctx.lineTo(tipX, 0);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.restore();
          });
          ctx.restore();
        }

        // --- CANNONBOLT: JAGGED SHARP SILVER ARMOR SHELL ---
        else if (aType === 'cannonbolt') {
          ctx.save();
          const numPlates = 14;
          ctx.beginPath();
          for (let i = 0; i <= numPlates; i++) {
            const baseAngle = (i / numPlates) * Math.PI * 2;
            const midAngle = baseAngle + Math.PI / numPlates;
            const outerR = half + 16;
            const innerR = half - 2;

            const bx = Math.cos(baseAngle) * innerR;
            const by = Math.sin(baseAngle) * innerR;
            const mx = Math.cos(midAngle) * outerR;
            const my = Math.sin(midAngle) * outerR;

            if (i === 0) ctx.moveTo(bx, by);
            else ctx.lineTo(bx, by);
            ctx.lineTo(mx, my);
          }
          ctx.closePath();

          const silverGrad = ctx.createLinearGradient(-half, -half, half, half);
          silverGrad.addColorStop(0, '#ffffff');
          silverGrad.addColorStop(0.3, '#cbd5e1');
          silverGrad.addColorStop(0.7, '#64748b');
          silverGrad.addColorStop(1, '#334155');
          ctx.fillStyle = silverGrad;
          ctx.shadowColor = '#94a3b8';
          ctx.shadowBlur = 18;
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#f1f5f9';
          ctx.stroke();
          ctx.restore();
        }

        // --- RIPJAWS: ANIMATED WATER WAVES & BUBBLES ---
        else if (aType === 'ripjaws') {
          ctx.save();
          const numWaves = 24;
          ctx.beginPath();
          for (let i = 0; i <= numWaves; i++) {
            const th = (i / numWaves) * Math.PI * 2;
            const wave =
              Math.sin(th * 6 + curFrame * 0.22) * 8 +
              Math.cos(th * 3 - curFrame * 0.15) * 5 +
              14;
            const wr = half + wave;
            const wx = Math.cos(th) * wr;
            const wy = Math.sin(th) * wr;
            if (i === 0) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
          }
          ctx.closePath();

          const waterGrad = ctx.createRadialGradient(0, 0, half * 0.8, 0, 0, half + 26);
          waterGrad.addColorStop(0, 'rgba(6, 182, 212, 0.85)');
          waterGrad.addColorStop(0.5, 'rgba(14, 116, 144, 0.6)');
          waterGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
          ctx.fillStyle = waterGrad;
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 24;
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = 'rgba(165, 243, 252, 0.85)';
          ctx.stroke();

          // Swirling water bubbles
          for (let b = 0; b < 6; b++) {
            const bubbleAngle = (b / 6) * Math.PI * 2 + curFrame * 0.09;
            const bubbleDist = half + 12 + Math.sin(curFrame * 0.12 + b * 2) * 8;
            const bx = Math.cos(bubbleAngle) * bubbleDist;
            const by = Math.sin(bubbleAngle) * bubbleDist;
            ctx.beginPath();
            ctx.arc(bx, by, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(207, 250, 254, 0.9)';
            ctx.fill();
            ctx.strokeStyle = '#0891b2';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.restore();
        }

        // --- GHOSTFREAK: GHOSTLY BODY WITH FLOWING WISPY TAIL ---
        else if (aType === 'ghostfreak') {
          ctx.save();
          const spd = Math.hypot(f.vx, f.vy);
          const tailAngle = spd > 0.5 ? Math.atan2(f.vy, f.vx) + Math.PI : Math.PI / 2;

          ctx.save();
          ctx.rotate(tailAngle);
          const tailLength = half * 1.5;
          const wave1 = Math.sin(curFrame * 0.2) * 12;
          const wave2 = Math.cos(curFrame * 0.25) * 10;

          ctx.beginPath();
          ctx.moveTo(half * 0.2, -half * 0.7);
          ctx.quadraticCurveTo(half * 0.8 + wave1, -half * 0.3, tailLength + wave1, wave2);
          ctx.quadraticCurveTo(half * 0.8 - wave1, half * 0.3, half * 0.2, half * 0.7);
          ctx.closePath();

          const ghostGrad = ctx.createLinearGradient(0, 0, tailLength, 0);
          ghostGrad.addColorStop(0, 'rgba(148, 163, 184, 0.85)');
          ghostGrad.addColorStop(0.5, 'rgba(203, 213, 225, 0.55)');
          ghostGrad.addColorStop(1, 'rgba(241, 245, 249, 0)');
          ctx.fillStyle = ghostGrad;
          ctx.shadowColor = '#cbd5e1';
          ctx.shadowBlur = 25;
          ctx.fill();
          ctx.restore();

          // Ghostly ethereal outer aura
          ctx.beginPath();
          ctx.arc(0, 0, half + 8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(226, 232, 240, 0.18)';
          ctx.shadowColor = '#94a3b8';
          ctx.shadowBlur = 22;
          ctx.fill();
          ctx.restore();
        }

        // --- WILDMUTT & UPGRADE: CLEAN NORMAL BALLS (PER USER INSTRUCTION) ---
        // Normal spherical ball styling applied below

        // Charged Omnitrix Pulsing Ring
        if (isCharged) {
          ctx.beginPath();
          ctx.arc(0, 0, half + 8, 0, Math.PI * 2);
          ctx.strokeStyle = '#00ff66';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#00ff66';
          ctx.shadowBlur = 20;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // ==========================================
        // 2. BALL INTERIOR (CLIPPED IMAGE / AVATAR)
        // ==========================================
        ctx.beginPath();
        ctx.arc(0, 0, half, 0, Math.PI * 2);
        ctx.fillStyle = '#031408';
        ctx.fill();

        ctx.save();
        ctx.clip(); // Circular image clip

        let img = f.image_url ? loadedImagesRef.current.get(f.image_url) : null;
        if (!img && f.image_url) {
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            drawFrame();
          };
          img.src = f.image_url;
          loadedImagesRef.current.set(f.image_url, img);
        }

        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, -half, -half, f.size, f.size);
        } else {
          const grad = ctx.createLinearGradient(-half, -half, half, half);
          grad.addColorStop(0, f.color);
          grad.addColorStop(1, '#020904');
          ctx.fillStyle = grad;
          ctx.fillRect(-half, -half, f.size, f.size);

          ctx.fillStyle = f.color === '#ffffff' ? '#000' : '#fff';
          ctx.font = '900 50px "Montserrat", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(f.name.charAt(0).toUpperCase(), 0, 0);
        }

        if (f.hitFlash > 0) {
          ctx.fillStyle = `rgba(239, 68, 68, ${f.hitFlash / 12})`;
          ctx.fillRect(-half, -half, f.size, f.size);
        }

        ctx.restore();

        // Ball Border
        ctx.beginPath();
        ctx.arc(0, 0, half, 0, Math.PI * 2);
        ctx.lineWidth = 6;
        ctx.strokeStyle =
          f.hitFlash > 0 ? '#ffffff' : isCharged ? '#00ff66' : f.color;
        ctx.stroke();

        // ==========================================
        // 3. LIVE HP NUMBER DIRECTLY INSIDE BALL
        // ==========================================
        ctx.font = `900 ${Math.round(f.size * 0.38)}px "Montserrat", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#ffffff';
        ctx.strokeText(Math.round(f.health).toString(), 0, 2);
        ctx.fillText(Math.round(f.health).toString(), 0, 2);

        // ==========================================
        // 4. DISTINCT NAME BADGE DIRECTLY BELOW BALL
        // ==========================================
        ctx.save();
        ctx.fillStyle = 'rgba(3, 16, 8, 0.95)';
        ctx.strokeStyle = isCharged ? '#00ff66' : f.color;
        ctx.lineWidth = 2;
        ctx.font = '900 16px "Montserrat", sans-serif';
        const nameW = ctx.measureText(f.name).width;
        ctx.beginPath();
        ctx.roundRect(-nameW / 2 - 12, half + 8, nameW + 24, 28, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.name, 0, half + 22);
        ctx.restore();

        // ==========================================
        // 5. ACTIVE STATUS BADGE (NO EMOJIS)
        // ==========================================
        let itemBadge = '';
        if (f.bonusShield > 0 || f.hasShield) itemBadge += 'SHIELD ';
        if (f.hasDagger) itemBadge += '2X DMG ';
        if (f.gunBullets > 0) itemBadge += `BLASTER x${f.gunBullets} `;
        if (f.speedBoostTimer > 0) itemBadge += 'SPEED ';
        if (f.frozenTimer > 0) itemBadge += 'FROZEN ';
        if (isCharged) itemBadge += 'READY';

        if (itemBadge) {
          ctx.font = 'bold 15px "Montserrat", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#00ff66';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 6;
          ctx.fillText(itemBadge.trim(), 0, -half - 12);
        }

        ctx.restore();
      });

      // Floating Numbers
      floatingTexts.forEach((ft) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.fillStyle = ft.color;
        ctx.font = `900 ${Math.round(38 * ft.scale)}px "Montserrat", sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 10;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      });

      // Top Headline Only
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '900 66px "Montserrat", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 20;
      ctx.fillText(topic.toUpperCase() || 'ARENA CLASH', width / 2, 170);
      ctx.restore();

      // Dual Sided Healthbars below arena - ONLY shown after selection is completed!
      const activePhase = selectionPhaseRef.current;
      if (activePhase === 'hero_time' || activePhase === 'battling') {
        drawLiveHealthBars(ctx, fighters, width);
      }

      // Victory Overlay: ONLY SHOWN WHEN frameWinner IS PRESENT! (NO EMOJIS)
      if (frameWinner) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, width, height);

        // Golden Victory Crest (NO EMOJIS)
        const crownY = height / 2 - 130;
        ctx.beginPath();
        ctx.arc(width / 2, crownY, 40, 0, Math.PI * 2);
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#eab308';
        ctx.shadowBlur = 35;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(width / 2, crownY, 30, 0, Math.PI * 2);
        ctx.fillStyle = '#031408';
        ctx.fill();

        ctx.font = '900 22px "Montserrat", sans-serif';
        ctx.fillStyle = '#00ff66';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('WIN', width / 2, crownY);

        const winHalf = 80;
        ctx.beginPath();
        ctx.roundRect(width / 2 - winHalf, height / 2 - winHalf, 160, 160, 28);
        ctx.fillStyle = frameWinner.color;
        ctx.shadowColor = '#eab308';
        ctx.shadowBlur = 45;
        ctx.fill();

        const winImg = frameWinner.image_url ? loadedImagesRef.current.get(frameWinner.image_url) : null;
        if (winImg && winImg.complete && winImg.naturalWidth > 0) {
          ctx.save();
          ctx.clip();
          ctx.drawImage(winImg, width / 2 - winHalf, height / 2 - winHalf, 160, 160);
          ctx.restore();
        } else {
          ctx.fillStyle = frameWinner.color === '#ffffff' ? '#000' : '#fff';
          ctx.font = '900 74px "Montserrat", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(frameWinner.name.charAt(0).toUpperCase(), width / 2, height / 2);
        }

        ctx.lineWidth = 8;
        ctx.strokeStyle = '#facc15';
        ctx.stroke();

        ctx.font = '900 76px "Montserrat", sans-serif';
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#ca8a04';
        ctx.shadowBlur = 30;
        ctx.textAlign = 'center';
        ctx.fillText('VICTORY!', width / 2, height / 2 + 150);

        ctx.font = '800 50px "Montserrat", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${frameWinner.name} WINS!`, width / 2, height / 2 + 225);

        ctx.restore();
      }

      ctx.restore();
    });
  };

  // Helper: Live Health Bars below arena
  const drawLiveHealthBars = (ctx: CanvasRenderingContext2D, fighters: SimFighter[], width: number) => {
    const startY = ARENA_BOX.bottom + 25; // 1305
    const count = fighters.length;
    const colWidth = 460;
    const leftX = 50;
    const rightX = width - colWidth - 50;
    const rows = Math.ceil(count / 2);
    const rowHeight = Math.min(125, 570 / Math.max(rows, 2));

    fighters.forEach((f, idx) => {
      let x = leftX;
      let y = startY;

      if (count === 2) {
        x = idx === 0 ? leftX : rightX;
        y = startY + 30;
      } else if (count === 3) {
        if (idx === 0) {
          x = leftX;
          y = startY;
        } else if (idx === 1) {
          x = rightX;
          y = startY;
        } else {
          x = (width - colWidth) / 2;
          y = startY + rowHeight + 20;
        }
      } else {
        const isRight = idx % 2 === 1;
        const row = Math.floor(idx / 2);
        x = isRight ? rightX : leftX;
        y = startY + row * rowHeight;
      }

      ctx.save();
      ctx.translate(x, y);

      const isCharged = (f.energyCharge ?? 0) >= 100;
      const cardHeight = rowHeight - 14;

      // Card Background (Dark Ben 10 Omnitrix Theme)
      ctx.beginPath();
      ctx.roundRect(0, 0, colWidth, cardHeight, 16);
      ctx.fillStyle = f.isDead ? 'rgba(5, 12, 8, 0.45)' : 'rgba(4, 18, 10, 0.92)';
      ctx.fill();
      ctx.lineWidth = f.isDead ? 1 : isCharged ? 3 : 2;
      ctx.strokeStyle = f.isDead ? '#1e293b' : isCharged ? '#00ff66' : f.color;
      if (isCharged && !f.isDead) {
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 12;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Spherical Ball Avatar thumbnail
      const thumbSize = cardHeight - 24;
      ctx.save();
      ctx.translate(12, 12);
      ctx.beginPath();
      ctx.arc(thumbSize / 2, thumbSize / 2, thumbSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#031408';
      ctx.fill();
      ctx.clip();

      let img = f.image_url ? loadedImagesRef.current.get(f.image_url) : null;
      if (!img && f.image_url) {
        img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          drawFrame();
        };
        img.src = f.image_url;
        loadedImagesRef.current.set(f.image_url, img);
      }
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, thumbSize, thumbSize);
      } else {
        ctx.fillStyle = f.color === '#ffffff' ? '#000' : '#fff';
        ctx.font = '900 26px "Montserrat", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.name.charAt(0).toUpperCase(), thumbSize / 2, thumbSize / 2);
      }
      ctx.restore();

      // Thumbnail Border
      ctx.beginPath();
      ctx.arc(12 + thumbSize / 2, 12 + thumbSize / 2, thumbSize / 2, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = f.isDead ? '#475569' : isCharged ? '#00ff66' : f.color;
      ctx.stroke();

      const textX = thumbSize + 24;
      ctx.font = '900 22px "Montserrat", sans-serif';
      ctx.fillStyle = f.isDead ? '#64748b' : '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const abName = f.specialAbility ? f.specialAbility.name : '';
      let itemTag = '';
      if (f.bonusShield > 0 || f.hasShield) itemTag += ' [SHIELD]';
      if (f.hasDagger) itemTag += ' [2X DMG]';
      if (f.gunBullets > 0) itemTag += ` [BLASTER x${f.gunBullets}]`;
      if (f.speedBoostTimer > 0) itemTag += ' [SPEED]';
      if (f.frozenTimer > 0) itemTag += ' [FROZEN]';

      ctx.fillText(`${f.name}${itemTag}`, textX, 10);

      // HP text
      ctx.font = '900 20px "Montserrat", sans-serif';
      ctx.fillStyle = f.isDead ? '#ef4444' : '#00ff66';
      ctx.textAlign = 'right';
      ctx.fillText(f.isDead ? 'ELIMINATED' : `${Math.round(f.health)} HP`, colWidth - 14, 10);

      const barX = textX;
      const barW = colWidth - textX - 14;

      // 1. Health Bar
      const hpBarY = 40;
      const hpBarH = 12;
      ctx.beginPath();
      ctx.roundRect(barX, hpBarY, barW, hpBarH, 6);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fill();

      if (!f.isDead && f.health > 0) {
        const hpPct = Math.max(0, f.health / f.maxHealth);
        let hpColor = '#10b981';
        if (hpPct < 0.25) hpColor = '#ef4444';
        else if (hpPct < 0.5) hpColor = '#f59e0b';

        ctx.beginPath();
        ctx.roundRect(barX, hpBarY, barW * hpPct, hpBarH, 6);
        ctx.fillStyle = hpColor;
        ctx.shadowColor = hpColor;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 2. Omnitrix Energy Charge Bar
      const energyBarY = 58;
      const energyBarH = 8;
      const energy = Math.round(f.energyCharge ?? 0);
      const energyW = barW - 65;

      ctx.beginPath();
      ctx.roundRect(barX, energyBarY, energyW, energyBarH, 4);
      ctx.fillStyle = 'rgba(0, 20, 10, 0.85)';
      ctx.fill();

      if (!f.isDead && energy > 0) {
        ctx.beginPath();
        ctx.roundRect(barX, energyBarY, energyW * (Math.min(100, energy) / 100), energyBarH, 4);
        ctx.fillStyle = isCharged ? '#00ff66' : '#10b981';
        if (isCharged) {
          ctx.shadowColor = '#00ff66';
          ctx.shadowBlur = 8;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Energy text (NO EMOJIS)
      ctx.font = '800 12px "Montserrat", sans-serif';
      ctx.fillStyle = isCharged ? '#00ff66' : '#94a3b8';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(isCharged ? 'READY!' : `${energy}%`, colWidth - 14, energyBarY + 4);

      // 3. Ability Name Tag
      if (f.specialAbility) {
        ctx.font = '700 11px "Montserrat", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${f.specialAbility.icon} ${f.specialAbility.name}`, barX, 72);
      }

      ctx.restore();
    });
  };

  // 7. Animation Loop (Deterministic Simulation Stepper)
  useEffect(() => {
    let active = true;
    let lastTime = performance.now();

    const loop = (now: number) => {
      if (!active) return;

      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const sim = simResultRef.current;
      if (sim && isPlaying) {
        const frameIncrement = 30 * simSpeed * dt;
        const prevFrame = Math.floor(currentFrameRef.current);
        currentFrameRef.current = Math.min(sim.frames.length - 1, currentFrameRef.current + frameIncrement);
        const nextFrame = Math.floor(currentFrameRef.current);

        // Trigger sound events that occurred between previous and current frame
        if (soundEnabled && sim.soundEvents) {
          for (const ev of sim.soundEvents) {
            if (ev.frame > lastSoundFrameRef.current && ev.frame <= nextFrame) {
              playSound(ev.sound === 'winner' ? 'victory' : ev.sound);
            }
          }
          lastSoundFrameRef.current = nextFrame;
        }

        const curFrameState = sim.frames[nextFrame];
        if (curFrameState) {
          setAliveCount(curFrameState.aliveCount);
          if (curFrameState.winner && !winner) {
            setWinner(curFrameState.winner as any);
          }
        }

        if (nextFrame >= sim.frames.length - 1) {
          setIsPlaying(false);
        }
      }

      drawFrame();
      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPlaying, simSpeed, winner, topic, isFullscreen, soundEnabled]);

  // 8. Handlers & Interactive Selection Controls
  const handleStartSelection = () => {
    if (selectionPhase === 'idle') {
      playSound('ability');
      setSelectionPhase('select_p1');
      setP1Index(0);
      setDialRotationAngle(0);
    }
  };

  const handleRotateAlien = (direction: 'next' | 'prev', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playSound('bounce');
    const roster = contestants.length > 0 ? contestants : BEN10_ALIEN_PRESETS;
    const rosterLen = roster.length;
    if (selectionPhase === 'select_p1') {
      setP1Index((prev) => (direction === 'next' ? (prev + 1) % rosterLen : (prev - 1 + rosterLen) % rosterLen));
      setDialRotationAngle((prev) => prev + (direction === 'next' ? 45 : -45));
    } else if (selectionPhase === 'select_p2') {
      setP2Index((prev) => (direction === 'next' ? (prev + 1) % rosterLen : (prev - 1 + rosterLen) % rosterLen));
      setDialRotationAngle((prev) => prev + (direction === 'next' ? 45 : -45));
    }
  };

  const handleCenterSlam = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playSound('hit');
    playSound('item');
    setGreenFlash(true);

    const roster = contestants.length > 0 ? contestants : BEN10_ALIEN_PRESETS;

    if (selectionPhase === 'select_p1') {
      const chosen1 = roster[p1Index % roster.length];
      setSelectedP1(chosen1);

      if (chosen1.image_url) {
        let img = loadedImagesRef.current.get(chosen1.image_url);
        if (!img) {
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => drawFrame();
          img.src = chosen1.image_url;
          loadedImagesRef.current.set(chosen1.image_url, img);
        }
      }

      // Sync fighter 0 in current simulation so when select_p2 draws fighter 0 on canvas, it shows chosen1 immediately!
      if (simResultRef.current) {
        simResultRef.current.frames.forEach((fr) => {
          if (fr.fighters[0]) {
            fr.fighters[0].name = chosen1.name;
            fr.fighters[0].color = chosen1.color;
            fr.fighters[0].image_url = chosen1.image_url;
            if (chosen1.special_ability) fr.fighters[0].specialAbility = chosen1.special_ability;
          }
        });
      }

      setTimeout(() => {
        setGreenFlash(false);
        setSelectionPhase('select_p2');
        setP2Index((p1Index + 1) % roster.length);
        setDialRotationAngle(0);
        drawFrame();
      }, 450);
    } else if (selectionPhase === 'select_p2') {
      const chosen1 = selectedP1 || roster[p1Index % roster.length];
      const chosen2 = roster[p2Index % roster.length];
      setSelectedP2(chosen2);

      if (chosen2.image_url) {
        let img = loadedImagesRef.current.get(chosen2.image_url);
        if (!img) {
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => drawFrame();
          img.src = chosen2.image_url;
          loadedImagesRef.current.set(chosen2.image_url, img);
        }
      }

      setTimeout(() => {
        setGreenFlash(false);
        setSelectionPhase('hero_time');
        setHeroTimeBanner(true);
        playSound('victory');

        const matchContestants: ContestantConfig[] = [
          { ...chosen1, id: 'fighter_1' },
          { ...chosen2, id: 'fighter_2' },
        ];
        setContestants(matchContestants);
        setContestantCount(2);

        const sim = generateArenaSimulation(
          matchContestants.map((c) => ({
            id: c.id,
            name: c.name,
            color: c.color,
            image_url: c.image_url,
            starting_health: c.starting_health,
            damage: c.damage,
            speed: c.speed,
            special_power: c.special_power,
            special_ability: c.special_ability,
          })),
          3600,
          battleSeedRef.current
        );
        simResultRef.current = sim;
        currentFrameRef.current = 0;
        lastSoundFrameRef.current = -1;
        setWinner(null);
        setAliveCount(2);

        // Start battle immediately with "It's Hero Time!" banner showing once!
        setSelectionPhase('battling');
        setIsPlaying(true);
        drawFrame();

        // Banner fades out smoothly after 1.2s while battle is active!
        setTimeout(() => {
          setHeroTimeBanner(false);
        }, 1200);
      }, 450);
    }
  };

  const resetSimulation = () => {
    setIsPlaying(false);
    setSelectionPhase('idle');
    setSelectedP1(null);
    setSelectedP2(null);
    setHeroTimeBanner(false);
    setGreenFlash(false);
    currentFrameRef.current = 0;
    lastSoundFrameRef.current = -1;
    setWinner(null);
    initSimulation(true);
  };

  const handlePlayToggle = () => {
    const sim = simResultRef.current;
    if (selectionPhase === 'idle') {
      handleStartSelection();
      return;
    }
    if (!isPlaying) {
      if (sim && currentFrameRef.current >= sim.frames.length - 1) {
        currentFrameRef.current = 90;
        lastSoundFrameRef.current = 89;
        setWinner(null);
      }
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const availableRoster = contestants.length > 0 ? contestants : BEN10_ALIEN_PRESETS;
  const currentDialAlien = selectionPhase === 'select_p1'
    ? availableRoster[p1Index % availableRoster.length]
    : availableRoster[p2Index % availableRoster.length];

  const renderOmnitrixOverlay = () => {
    return (
      <>
        {/* Idle Screen Tap Indicator */}
        {selectionPhase === 'idle' && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center cursor-pointer group"
            onClick={handleStartSelection}
          >
            <div className="px-5 py-2.5 rounded-2xl bg-black/85 backdrop-blur border-2 border-emerald-400 text-emerald-300 group-hover:text-white group-hover:border-emerald-300 font-black text-xs tracking-wider uppercase transition shadow-[0_0_25px_rgba(0,255,102,0.6)] animate-pulse">
              Click Arena to Activate Omnitrix
            </div>
          </div>
        )}

        {/* Interactive Omnitrix Alien Selector (Popped up large in center of arena) */}
        {(selectionPhase === 'select_p1' || selectionPhase === 'select_p2') && (
          <div
            className="absolute flex flex-col items-center justify-center z-30 select-none animate-in zoom-in-75 duration-300"
            style={{
              left: '50%',
              top: `${(830 / 1920) * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: '74%',
              maxWidth: 320,
              aspectRatio: '1/1',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Outer Glowing Alien Aura */}
            <div className="absolute -inset-8 rounded-full bg-emerald-500/35 blur-2xl animate-pulse pointer-events-none" />

            {/* Omnitrix Outer Metallic Dial Body */}
            <div className="relative w-full h-full rounded-full bg-gradient-to-b from-[#182a1c] via-[#08150c] to-[#020803] border-[6px] border-[#00ff66] shadow-[0_0_50px_rgba(0,255,102,0.85)] flex items-center justify-center p-3">
              
              {/* Left Dial Turn Button / Side Bezel Click Area */}
              <button
                type="button"
                onClick={(e) => handleRotateAlien('prev', e)}
                title="Rotate Alien Left"
                className="absolute left-1 z-30 w-11 h-16 rounded-l-full bg-slate-900/90 hover:bg-emerald-950 border-2 border-emerald-400/80 hover:border-emerald-300 text-emerald-400 hover:text-white flex items-center justify-center font-black text-xl transition active:scale-90 shadow-[0_0_15px_rgba(0,255,102,0.5)] cursor-pointer"
              >
                <span>◀</span>
              </button>

              {/* Right Dial Turn Button / Side Bezel Click Area */}
              <button
                type="button"
                onClick={(e) => handleRotateAlien('next', e)}
                title="Rotate Alien Right"
                className="absolute right-1 z-30 w-11 h-16 rounded-r-full bg-slate-900/90 hover:bg-emerald-950 border-2 border-emerald-400/80 hover:border-emerald-300 text-emerald-400 hover:text-white flex items-center justify-center font-black text-xl transition active:scale-90 shadow-[0_0_15px_rgba(0,255,102,0.5)] cursor-pointer"
              >
                <span>▶</span>
              </button>

              {/* Rotating Outer Bezel */}
              <div
                className="w-full h-full rounded-full border-4 border-slate-700/80 flex items-center justify-center transition-transform duration-200"
                style={{ transform: `rotate(${dialRotationAngle}deg)` }}
              >
                <div className="absolute inset-2 rounded-full border-2 border-dashed border-emerald-500/40 pointer-events-none" />
                <div className="absolute top-1 w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#00ff66]" />
                <div className="absolute bottom-1 w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#00ff66]" />
                <div className="absolute left-1 w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#00ff66]" />
                <div className="absolute right-1 w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#00ff66]" />
              </div>

              {/* Center Omnitrix Core Activator Button (Slam to lock in & flash green!) */}
              <button
                type="button"
                onClick={(e) => handleCenterSlam(e)}
                title="Click Center to Select Alien & Strike!"
                className="absolute inset-10 rounded-full bg-gradient-to-b from-[#0a2211] via-black to-[#031107] border-4 border-emerald-400 shadow-[0_0_30px_rgba(0,255,102,0.9),inset_0_0_20px_rgba(0,255,102,0.5)] hover:border-white hover:shadow-[0_0_45px_#00ff66] transition active:scale-95 flex flex-col items-center justify-center overflow-hidden cursor-pointer group"
              >
                {/* Green Hourglass Silhouette in Core */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-35 group-hover:opacity-60 transition">
                  <svg viewBox="0 0 100 100" className="w-full h-full text-emerald-400 fill-current">
                    <polygon points="20,10 80,10 50,50" />
                    <polygon points="20,90 80,90 50,50" />
                  </svg>
                </div>

                {/* Alien Thumbnail Avatar */}
                <div className="relative z-10 w-24 h-24 rounded-full overflow-hidden border-2 border-emerald-400 bg-black flex items-center justify-center shadow-lg">
                  {currentDialAlien?.image_url ? (
                    <img
                      key={currentDialAlien.image_url + (currentDialAlien.name || '')}
                      src={currentDialAlien.image_url}
                      alt={currentDialAlien.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center font-black text-3xl"
                      style={{ backgroundColor: currentDialAlien?.color || '#00ff66', color: '#000000' }}
                    >
                      {currentDialAlien?.name?.charAt(0)}
                    </div>
                  )}
                </div>
              </button>
            </div>

            {/* Clean Alien Name Tag Below (No emoji, clean typography) */}
            {currentDialAlien && (
              <div
                className="mt-3 px-5 py-1.5 rounded-full bg-black/95 border-2 text-white font-black text-sm tracking-wider whitespace-nowrap shadow-2xl flex items-center gap-2"
                style={{
                  borderColor: currentDialAlien.color || '#00ff66',
                  boxShadow: `0 0 20px ${currentDialAlien.color || '#00ff66'}90`,
                }}
              >
                <span>{currentDialAlien.name}</span>
              </div>
            )}
          </div>
        )}

        {/* Clean "It's Hero Time!" Banner (Strictly NO emojis) */}
        {heroTimeBanner && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none animate-in zoom-in-95 duration-200">
            <div
              className="px-8 py-4 rounded-3xl bg-black/90 border-4 border-emerald-400 text-white font-black text-3xl tracking-widest uppercase text-center"
              style={{
                boxShadow: '0 0 60px rgba(0, 255, 102, 0.9), inset 0 0 30px rgba(0, 255, 102, 0.4)',
                textShadow: '0 0 20px #00ff66',
              }}
            >
              It's Hero Time!
            </div>
          </div>
        )}
      </>
    );
  };

  const openCropModal = (index: number, imageSrc: string) => {
    const img = new Image();
    img.onload = () => {
      setRawImgNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      const VIEWPORT = 280;
      // Default scale fills the square box cleanly
      const fillScale = Math.max(VIEWPORT / img.naturalWidth, VIEWPORT / img.naturalHeight);
      setCropScale(Number(Math.max(0.15, fillScale).toFixed(2)));
      setCropPan({ x: 0, y: 0 });
      setCropTargetIndex(index);
      setRawImageSrc(imageSrc);
      setCropModalOpen(true);
    };
    img.src = imageSrc;
  };

  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Url = reader.result as string;
      openCropModal(index, base64Url);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropMouseDown = (e: React.MouseEvent) => {
    setIsDraggingCrop(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...cropPan };
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCrop) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setCropPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy });
  };

  const handleCropMouseUp = () => {
    setIsDraggingCrop(false);
  };

  const handleCropTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDraggingCrop(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { ...cropPan };
    }
  };

  const handleCropTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingCrop || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    setCropPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy });
  };

  const handleCropWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setCropScale((prev) => Math.min(3.5, Math.max(0.1, Number((prev + delta).toFixed(2)))));
  };

  const handleFitCrop = () => {
    const VIEWPORT = 280;
    const fitScale = Math.min(VIEWPORT / rawImgNaturalSize.width, VIEWPORT / rawImgNaturalSize.height);
    setCropScale(Number(fitScale.toFixed(2)));
    setCropPan({ x: 0, y: 0 });
  };

  const handleFillCrop = () => {
    const VIEWPORT = 280;
    const fillScale = Math.max(VIEWPORT / rawImgNaturalSize.width, VIEWPORT / rawImgNaturalSize.height);
    setCropScale(Number(fillScale.toFixed(2)));
    setCropPan({ x: 0, y: 0 });
  };

  const applyCrop = () => {
    if (cropTargetIndex === null || !rawImageSrc) return;

    const img = new Image();
    img.onload = () => {
      const VIEWPORT = 280;
      const OUTPUT_SIZE = 400; // 400x400 high-res square avatar
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dark slate background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const ratio = OUTPUT_SIZE / VIEWPORT;
      const scaledW = img.naturalWidth * cropScale * ratio;
      const scaledH = img.naturalHeight * cropScale * ratio;
      const posX = OUTPUT_SIZE / 2 + cropPan.x * ratio - scaledW / 2;
      const posY = OUTPUT_SIZE / 2 + cropPan.y * ratio - scaledH / 2;

      ctx.drawImage(img, posX, posY, scaledW, scaledH);

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);

      // Pre-cache in loadedImagesRef immediately so Canvas can draw it with 0 delay
      const cachedImg = new Image();
      cachedImg.onload = () => {
        loadedImagesRef.current.set(croppedDataUrl, cachedImg);
        drawFrame();
      };
      cachedImg.src = croppedDataUrl;
      loadedImagesRef.current.set(croppedDataUrl, cachedImg);

      // Update contestant
      setContestants((prev) => {
        const copy = [...prev];
        if (copy[cropTargetIndex]) {
          copy[cropTargetIndex] = { ...copy[cropTargetIndex], image_url: croppedDataUrl };
        }
        return copy;
      });

      // Also update BEN10_ALIEN_PRESETS so preset persistence works
      if (BEN10_ALIEN_PRESETS[cropTargetIndex]) {
        BEN10_ALIEN_PRESETS[cropTargetIndex].image_url = croppedDataUrl;
      }

      setCropModalOpen(false);
      setRawImageSrc(null);
      setCropTargetIndex(null);
    };
    img.src = rawImageSrc;
  };

  const updateContestant = (index: number, updates: Partial<ContestantConfig>) => {
    setContestants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });

    if (updates.image_url) {
      const cachedImg = new Image();
      cachedImg.crossOrigin = 'anonymous';
      cachedImg.onload = () => {
        loadedImagesRef.current.set(updates.image_url!, cachedImg);
        drawFrame();
      };
      cachedImg.src = updates.image_url;
      loadedImagesRef.current.set(updates.image_url, cachedImg);
    }

    if (BEN10_ALIEN_PRESETS[index]) {
      Object.assign(BEN10_ALIEN_PRESETS[index], updates);
    }
  };


  // 9. Queue Video to YouTube Shorts with Full Dynamic Match Duration and Identical Seed
  const handleQueueVideo = async () => {
    setQueueLoading(true);
    setQueueMessage(null);

    try {
      const currentSeed = battleSeedRef.current;
      const simResult = simResultRef.current || generateArenaSimulation(
        contestants.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          image_url: c.image_url,
          starting_health: c.starting_health,
          damage: c.damage,
          speed: c.speed,
          special_power: c.special_power,
          special_ability: c.special_ability,
        })),
        3600,
        currentSeed
      );

      const dynamicDurationSeconds = simResult.totalSeconds;

      const data_json = {
        topic,
        format: 'Arena Clash',
        contestants: contestants.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          image_url: c.image_url,
          starting_health: c.starting_health,
          damage: c.damage,
          speed: c.speed,
          special_power: c.special_power,
          special_ability: c.special_ability,
        })),
        duration_seconds: dynamicDurationSeconds,
        seed: currentSeed,
      };

      const response = await fetch('/api/queue-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_json,
          showSubtitles: false,
          duration: dynamicDurationSeconds,
        }),
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        setQueueMessage({
          type: 'success',
          text: `Full battle (${dynamicDurationSeconds}s with sound effects & BGM) queued successfully! GitHub Actions is rendering now.`,
        });
      } else {
        setQueueMessage({
          type: 'error',
          text: resData.error || 'Failed to queue video.',
        });
      }
    } catch (err: any) {
      setQueueMessage({
        type: 'error',
        text: err.message || 'An unexpected error occurred.',
      });
    } finally {
      setQueueLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 p-4 md:p-6 selection:bg-cyan-500/20 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Minimalist Header */}
        <header className="flex flex-wrap justify-between items-center py-3 border-b border-slate-800/60 gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⚔️</span>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                ARENA CLASH <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">PHYSICS BATTLE</span>
              </h1>
            </div>
          </div>

          <nav className="flex items-center gap-2 text-xs font-semibold">
            <Link href="/" className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition">
              Charts
            </Link>
            <Link href="/aesthetic" className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-purple-300 border border-slate-800 transition">
              Aesthetic
            </Link>
            <Link href="/admin?tab=youtube" className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-900/50 transition flex items-center gap-1">
              <span>🔴</span> YouTube
            </Link>
            <Link href="/admin?tab=meta" className="px-3 py-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 border border-blue-900/50 transition flex items-center gap-1">
              <span>🔵</span> FB & IG
            </Link>
          </nav>
        </header>

        {/* Status Message */}
        {queueMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
              queueMessage.type === 'success'
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
            }`}
          >
            <span>{queueMessage.text}</span>
            <button onClick={() => setQueueMessage(null)} className="opacity-60 hover:opacity-100 text-sm">✕</button>
          </div>
        )}

        {/* Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ================= LEFT CONFIGURATION PANEL (6.5 Cols) ================= */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Battle Headline & Preset Bar */}
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Battle Headline</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleLoadBen10}
                    className="px-2.5 py-0.5 rounded-md bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/60 text-[11px] font-bold text-emerald-300 transition flex items-center gap-1 shadow-sm"
                  >
                    <span>⌛</span>
                    <span>Ben 10 Aliens</span>
                  </button>
                  {PRESET_TOPICS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleLoadPreset(idx)}
                      className="px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-[11px] font-medium text-slate-300 transition"
                    >
                      {p.topic}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Marvel vs DC"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-base focus:outline-none focus:border-cyan-500 transition"
              />

              {/* Fighter Count Pill Bar */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-slate-400">Fighter Count:</span>
                <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {[2, 3, 4, 5, 6, 7, 8].map((num) => (
                    <button
                      key={num}
                      onClick={() => setContestantCount(num)}
                      className={`w-7 h-7 rounded-lg text-xs font-black transition ${
                        contestantCount === num
                          ? 'bg-cyan-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Minimalist Fighters Setup Grid */}
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
              {contestants.map((fighter, idx) => (
                <div
                  key={fighter.id}
                  className="bg-slate-900/30 border border-slate-800/50 hover:border-slate-700/80 rounded-2xl p-3 flex items-center gap-3 transition"
                >
                  {/* Avatar Upload & Crop Actions */}
                  <div className="relative group shrink-0 flex flex-col items-center gap-1">
                    <div
                      className="w-14 h-14 rounded-xl border-2 overflow-hidden flex items-center justify-center bg-slate-950 relative shadow-md"
                      style={{ borderColor: fighter.color }}
                    >
                      {fighter.image_url ? (
                        <img src={fighter.image_url} alt={fighter.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-black" style={{ color: fighter.color === '#ffffff' ? '#fff' : fighter.color }}>
                          {fighter.name.charAt(0).toUpperCase()}
                        </span>
                      )}

                      <label
                        className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition text-[9px] text-white font-bold"
                        title="Upload and crop image"
                      >
                        <span className="text-base">📷</span>
                        <span className="text-[8px]">Upload</span>
                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(idx, e)} className="hidden" />
                      </label>
                    </div>

                    {fighter.image_url && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openCropModal(idx, fighter.image_url!)}
                          title="Crop and position image"
                          className="text-[9px] px-1.5 py-0.5 bg-cyan-950/90 hover:bg-cyan-900 text-cyan-300 rounded border border-cyan-700/60 font-bold transition flex items-center gap-0.5"
                        >
                          <span>✂️</span>
                          <span>Crop</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateContestant(idx, { image_url: null })}
                          title="Remove image"
                          className="text-[9px] px-1.5 py-0.5 bg-rose-950/90 hover:bg-rose-900 text-rose-300 rounded border border-rose-700/60 font-bold transition"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Fields */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={fighter.name}
                        onChange={(e) => updateContestant(idx, { name: e.target.value })}
                        className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-white font-bold text-xs focus:outline-none focus:border-cyan-500"
                      />

                      {/* Compact Color Swatches */}
                      <div className="flex items-center gap-1">
                        {COLOR_SWATCHES.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => updateContestant(idx, { color: c.hex })}
                            className={`w-4 h-4 rounded-full border border-slate-700 transition ${
                              fighter.color === c.hex ? 'ring-2 ring-cyan-400 scale-110' : 'opacity-60 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Stats & Special Power */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={fighter.special_power}
                        onChange={(e) => updateContestant(idx, { special_power: e.target.value })}
                        className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-amber-300 font-bold text-[11px] focus:outline-none"
                      >
                        {SPECIAL_POWERS.map((p) => (
                          <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                            {p.icon} {p.name}
                          </option>
                        ))}
                      </select>

                      {/* Health */}
                      <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px]">
                        <span className="text-slate-500">HP:</span>
                        <input
                          type="number"
                          min="10"
                          max="500"
                          value={fighter.starting_health}
                          onChange={(e) => updateContestant(idx, { starting_health: Math.max(10, Number(e.target.value) || 10) })}
                          className="w-12 bg-transparent text-emerald-400 font-bold text-right focus:outline-none"
                        />
                      </div>

                      {/* Damage */}
                      <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px]">
                        <span className="text-slate-500">DMG:</span>
                        <input
                          type="number"
                          min="1"
                          max="150"
                          value={fighter.damage}
                          onChange={(e) => updateContestant(idx, { damage: Math.max(1, Number(e.target.value) || 1) })}
                          className="w-12 bg-transparent text-rose-400 font-bold text-right focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Special Ability Editor */}
                    <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80 space-y-1.5 mt-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-cyan-400 flex items-center gap-1">
                          <span>✨</span> SPECIAL ABILITY
                        </span>
                        <div className="flex items-center gap-1">
                          {['⚡', '💥', '🛡️', '❄️', '💚', '🩸', '☄️', '🌪️', '💣', '🗡️'].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                const cur = fighter.special_ability || { name: 'Power Strike', icon: '⚡', type: 'damage', cooldown_seconds: 5, power_value: 30 };
                                updateContestant(idx, { special_ability: { ...cur, icon: emoji } });
                              }}
                              className={`text-[12px] px-1 py-0.5 rounded hover:scale-125 transition ${
                                fighter.special_ability?.icon === emoji ? 'bg-cyan-500/30 ring-1 ring-cyan-400' : 'opacity-70'
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5 text-[11px]">
                        <input
                          type="text"
                          placeholder="Ability Name"
                          value={fighter.special_ability?.name || ''}
                          onChange={(e) => {
                            const cur = fighter.special_ability || { name: '', icon: '⚡', type: 'damage', cooldown_seconds: 5, power_value: 30 };
                            updateContestant(idx, { special_ability: { ...cur, name: e.target.value } });
                          }}
                          className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-white font-bold placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                        />

                        <select
                          value={fighter.special_ability?.type || 'damage'}
                          onChange={(e) => {
                            const cur = fighter.special_ability || { name: 'Power Strike', icon: '⚡', type: 'damage', cooldown_seconds: 5, power_value: 30 };
                            updateContestant(idx, { special_ability: { ...cur, type: e.target.value as any } });
                          }}
                          className="px-1.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-cyan-300 font-bold focus:outline-none"
                        >
                          <option value="damage">💥 Damage</option>
                          <option value="shield">🛡️ Shield</option>
                          <option value="heal">💚 Heal</option>
                          <option value="freeze">❄️ Freeze</option>
                          <option value="speed">⚡ Speed</option>
                        </select>

                        <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                          <span className="text-slate-500">CD:</span>
                          <input
                            type="number"
                            min="2"
                            max="20"
                            step="1"
                            value={fighter.special_ability?.cooldown_seconds || 5}
                            onChange={(e) => {
                              const cur = fighter.special_ability || { name: 'Power Strike', icon: '⚡', type: 'damage', cooldown_seconds: 5, power_value: 30 };
                              updateContestant(idx, { special_ability: { ...cur, cooldown_seconds: Math.max(2, Number(e.target.value) || 2) } });
                            }}
                            className="w-8 bg-transparent text-amber-300 font-bold text-right focus:outline-none"
                          />
                          <span className="text-slate-500">s</span>
                        </div>

                        <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                          <span className="text-slate-500">PWR:</span>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={fighter.special_ability?.power_value || 30}
                            onChange={(e) => {
                              const cur = fighter.special_ability || { name: 'Power Strike', icon: '⚡', type: 'damage', cooldown_seconds: 5, power_value: 30 };
                              updateContestant(idx, { special_ability: { ...cur, power_value: Math.max(1, Number(e.target.value) || 1) } });
                            }}
                            className="w-10 bg-transparent text-pink-400 font-bold text-right focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Trigger Criteria & Weapon Selector */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] pt-1.5 border-t border-slate-900">
                        <div className="flex items-center gap-1.5 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800">
                          <span className="text-slate-400 font-semibold whitespace-nowrap text-[10px]">🎯 Trigger:</span>
                          <select
                            value={fighter.special_ability?.trigger_type || 'charge'}
                            onChange={(e) => {
                              const cur = fighter.special_ability || { name: 'Power Strike', icon: '⚡', type: 'damage', cooldown_seconds: 5, power_value: 30 };
                              updateContestant(idx, { special_ability: { ...cur, trigger_type: e.target.value as any } });
                            }}
                            className="bg-transparent text-emerald-400 font-bold focus:outline-none flex-1 text-[10px]"
                          >
                            <option value="charge" className="bg-slate-900 text-white">⚡ 100% Omnitrix Charge</option>
                            <option value="hp_threshold" className="bg-slate-900 text-white">🩸 Low HP (&lt;50%) Rage</option>
                            <option value="hit_combo" className="bg-slate-900 text-white">🥊 4x Hit Combo</option>
                            <option value="cooldown" className="bg-slate-900 text-white">⏱️ Cooldown Timer</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800">
                          <span className="text-slate-400 font-semibold whitespace-nowrap text-[10px]">⚔️ Weapon:</span>
                          <select
                            value={fighter.special_ability?.weapon_icon || '🥊'}
                            onChange={(e) => {
                              const cur = fighter.special_ability || { name: 'Power Strike', icon: '⚡', type: 'damage', cooldown_seconds: 5, power_value: 30 };
                              updateContestant(idx, { special_ability: { ...cur, weapon_icon: e.target.value } });
                            }}
                            className="bg-transparent text-amber-300 font-bold focus:outline-none flex-1 text-[10px]"
                          >
                            <option value="🥊" className="bg-slate-900 text-white">🥊 Fist / Sonic Blow</option>
                            <option value="🔥" className="bg-slate-900 text-white">🔥 Fireball Orbit</option>
                            <option value="💎" className="bg-slate-900 text-white">💎 Diamond Crystal</option>
                            <option value="🗡️" className="bg-slate-900 text-white">🗡️ Plasma Blade</option>
                            <option value="⚡" className="bg-slate-900 text-white">⚡ Electric Arc</option>
                            <option value="🛡️" className="bg-slate-900 text-white">🛡️ Energy Shield</option>
                            <option value="⚙️" className="bg-slate-900 text-white">⚙️ Galvanic Gear</option>
                            <option value="🦈" className="bg-slate-900 text-white">🦈 Steel Jaws</option>
                            <option value="" className="bg-slate-900 text-white">None</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Audio & Sound Minimal Bar */}
            <div className="flex justify-between items-center px-4 py-2.5 bg-slate-900/40 border border-slate-800/60 rounded-xl text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-400">Audio Volume:</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={soundVolume}
                  onChange={(e) => setSoundVolume(Number(e.target.value))}
                  className="accent-cyan-500 w-24"
                />
              </div>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`font-bold transition ${soundEnabled ? 'text-emerald-400' : 'text-slate-500'}`}
              >
                {soundEnabled ? '🔊 SFX ON' : '🔇 MUTED'}
              </button>
            </div>
          </div>

          {/* ================= RIGHT 9:16 INTERACTIVE SCREEN (5.5 Cols) ================= */}
          <div className="lg:col-span-5 flex flex-col items-center space-y-3">
            
            {/* 9:16 Mobile Screen Container */}
            <div className="relative w-full max-w-[360px] aspect-[9/16] bg-black rounded-[40px] p-2 shadow-2xl border-[5px] border-slate-800/80 ring-1 ring-slate-700/50 flex flex-col overflow-hidden">
              
              {/* Dynamic Island Notch */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-4 bg-slate-950 rounded-full z-20 flex items-center justify-center pointer-events-none">
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              </div>

              {/* Status Header Overlay with Fullscreen Button */}
              <div className="absolute top-8 left-5 right-5 flex justify-between items-center z-20">
                <span className="px-2.5 py-0.5 rounded-full bg-black/75 backdrop-blur border border-slate-800 text-[10px] font-black text-amber-300 pointer-events-none">
                  {aliveCount} / {contestants.length} ALIVE
                </span>

                {/* FULLSCREEN BUTTON ⛶ */}
                <button
                  onClick={() => setIsFullscreen(true)}
                  title="Fullscreen Game Screen"
                  className="px-2.5 py-1 rounded-full bg-black/80 hover:bg-slate-800 backdrop-blur border border-slate-700 text-xs font-bold text-cyan-300 hover:text-white transition flex items-center gap-1 shadow-lg"
                >
                  <span>⛶</span>
                  <span className="text-[10px]">Fullscreen</span>
                </button>
              </div>

              {/* Canvas Viewport (1080 x 1920 Logical) */}
              <div
                className="flex-1 w-full h-full rounded-[30px] overflow-hidden bg-black relative cursor-pointer"
                onClick={() => {
                  if (selectionPhase === 'idle') handleStartSelection();
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={1080}
                  height={1920}
                  className="w-full h-full object-cover"
                />

                {/* Pre-Battle Omnitrix Alien Selection Overlay */}
                {renderOmnitrixOverlay()}
              </div>
            </div>

            {/* Bottom Controls Bar */}
            <div className="w-full max-w-[360px] space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={handlePlayToggle}
                  className={`flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition shadow-lg ${
                    isPlaying
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  }`}
                >
                  <span>{isPlaying ? '⏸️ PAUSE' : '▶️ PLAY'}</span>
                </button>

                <button
                  onClick={resetSimulation}
                  title="Reset Game"
                  className="px-3.5 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl font-bold text-xs text-slate-300 transition"
                >
                  🔄 RESET
                </button>

                {/* Speed Toggle */}
                <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-0.5">
                  {[1, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setSimSpeed(spd)}
                      className={`px-2 rounded-lg text-xs font-black transition ${
                        simSpeed === spd ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Queue Video for YouTube Shorts */}
              <button
                onClick={handleQueueVideo}
                disabled={queueLoading}
                className="w-full py-2.5 bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 hover:opacity-95 text-white rounded-xl font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md"
              >
                <span>🚀</span>
                <span>{queueLoading ? 'Queuing Video...' : 'Queue as YouTube Short (Render Full Game)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ================= FULLSCREEN IMMERSIVE 9:16 MODAL ================= */}
        {isFullscreen && (
          <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-3 animate-in fade-in duration-200">
            
            {/* Top Close / Controls Bar */}
            <div className="w-full max-w-4xl flex justify-between items-center mb-2 px-4">
              <div className="flex items-center gap-3">
                <span className="font-black text-sm text-white tracking-wider uppercase">{topic}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold">
                  {aliveCount} ALIVE
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePlayToggle}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition ${
                    isPlaying ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-black'
                  }`}
                >
                  {isPlaying ? '⏸️ PAUSE' : '▶️ PLAY'}
                </button>
                <button
                  onClick={resetSimulation}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition"
                >
                  🔄 RESET
                </button>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="px-3.5 py-1 bg-rose-600/80 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <span>✕</span>
                  <span>Exit (ESC)</span>
                </button>
              </div>
            </div>

            {/* Fullscreen 9:16 Frame */}
            <div
              className="h-[90vh] aspect-[9/16] bg-black rounded-[36px] overflow-hidden border-4 border-slate-800 shadow-2xl shadow-cyan-950/40 relative cursor-pointer"
              onClick={() => {
                if (selectionPhase === 'idle') handleStartSelection();
              }}
            >
              <canvas
                ref={fullscreenCanvasRef}
                width={1080}
                height={1920}
                className="w-full h-full object-cover"
              />

              {/* Pre-Battle Omnitrix Alien Selection Overlay */}
              {renderOmnitrixOverlay()}
            </div>
          </div>
        )}

        {/* ================= IMAGE CROP & FRAME MODAL ================= */}
        {cropModalOpen && rawImageSrc && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              {/* Header */}
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>✂️</span>
                    <span>Adjust & Frame Image</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Drag to reposition subject and adjust zoom slider</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCropModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold transition"
                >
                  ✕
                </button>
              </div>

              {/* Crop Viewport */}
              <div className="flex flex-col items-center justify-center">
                <div
                  className="relative w-[280px] h-[280px] rounded-2xl overflow-hidden bg-slate-950 border-2 border-cyan-400 cursor-grab active:cursor-grabbing shadow-2xl select-none"
                  onMouseDown={handleCropMouseDown}
                  onMouseMove={handleCropMouseMove}
                  onMouseUp={handleCropMouseUp}
                  onMouseLeave={handleCropMouseUp}
                  onTouchStart={handleCropTouchStart}
                  onTouchMove={handleCropTouchMove}
                  onTouchEnd={handleCropMouseUp}
                  onWheel={handleCropWheel}
                >
                  <img
                    src={rawImageSrc}
                    alt="Crop preview"
                    draggable={false}
                    style={{
                      position: 'absolute',
                      left: `calc(50% + ${cropPan.x}px)`,
                      top: `calc(50% + ${cropPan.y}px)`,
                      transform: `translate(-50%, -50%) scale(${cropScale})`,
                      transformOrigin: 'center center',
                      maxWidth: 'none',
                      maxHeight: 'none',
                      userSelect: 'none',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Subtle Grid Frame Overlay */}
                  <div className="absolute inset-0 pointer-events-none border-2 border-white/20 rounded-2xl grid grid-cols-3 grid-rows-3">
                    <div className="border-r border-b border-white/10" />
                    <div className="border-r border-b border-white/10" />
                    <div className="border-b border-white/10" />
                    <div className="border-r border-b border-white/10" />
                    <div className="border-r border-b border-white/10" />
                    <div className="border-b border-white/10" />
                    <div className="border-r border-white/10" />
                    <div className="border-r border-white/10" />
                    <div />
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 mt-2">👆 Click and drag image to adjust frame</span>
              </div>

              {/* Zoom & Framing Controls */}
              <div className="space-y-2 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                  <span>🔍 Zoom</span>
                  <span className="text-cyan-400 font-mono text-[11px]">{Math.round(cropScale * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCropScale((prev) => Math.max(0.1, Number((prev - 0.1).toFixed(2))))}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center transition"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.05"
                    value={cropScale}
                    onChange={(e) => setCropScale(parseFloat(e.target.value))}
                    className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setCropScale((prev) => Math.min(3.0, Number((prev + 0.1).toFixed(2))))}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center transition"
                  >
                    +
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleFitCrop}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-lg transition"
                  >
                    🔍 Fit
                  </button>
                  <button
                    type="button"
                    onClick={handleFillCrop}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-lg transition"
                  >
                    🖼️ Fill
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropPan({ x: 0, y: 0 })}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-lg transition"
                  >
                    🔄 Center
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCropModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyCrop}
                  className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl font-black text-xs transition shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-1.5"
                >
                  <span>✓</span>
                  <span>Save & Apply</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full-Screen Vivid Omnitrix Green Light Flash */}
        {greenFlash && (
          <div
            className="fixed inset-0 z-[9999] pointer-events-none bg-[#00ff66]"
            style={{
              boxShadow: 'inset 0 0 150px rgba(255, 255, 255, 0.95)',
              animation: 'omnitrixGreenFlash 0.45s ease-out forwards',
            }}
          />
        )}
      </div>

      <style jsx global>{`
        @keyframes omnitrixGreenFlash {
          0% { opacity: 0.95; }
          40% { opacity: 0.9; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
