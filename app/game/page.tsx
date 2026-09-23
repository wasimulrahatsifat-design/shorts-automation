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
  ARENA_RADIUS,
  BOX_SIZE,
} from './types';
import {
  generateArenaSimulation,
  SimulationResult,
  SimFrameState,
  SimFighter,
} from '../../lib/arena-physics';

export { SPECIAL_POWERS, COLOR_SWATCHES };
export type { ContestantConfig };

const PRESET_ABILITIES = [
  { name: 'Repulsor Blast', icon: '💥', type: 'damage' as const, cooldown_seconds: 5, power_value: 35, description: 'Fires energy blast' },
  { name: 'Smoke Shield', icon: '🛡️', type: 'shield' as const, cooldown_seconds: 6, power_value: 40, description: 'Absorbs 40 damage' },
  { name: 'Web Freeze', icon: '❄️', type: 'freeze' as const, cooldown_seconds: 7, power_value: 2.2, description: 'Freezes target in web' },
  { name: 'Solar Surge', icon: '⚡', type: 'speed' as const, cooldown_seconds: 4, power_value: 2.5, description: 'Hyper sonic rush' },
  { name: 'Kamehameha', icon: '☄️', type: 'damage' as const, cooldown_seconds: 6, power_value: 45, description: 'Massive energy beam' },
  { name: 'Shadow Clone', icon: '⚡', type: 'speed' as const, cooldown_seconds: 5, power_value: 2.5, description: 'Deceptive speed dash' },
  { name: 'Gear Blast', icon: '💥', type: 'damage' as const, cooldown_seconds: 5, power_value: 38, description: 'Stretchy punch impact' },
  { name: 'Bankai Slash', icon: '🗡️', type: 'damage' as const, cooldown_seconds: 5, power_value: 42, description: 'Cuts through defenses' },
];

const PRESET_TOPICS = [
  { topic: 'Marvel vs DC', names: ['Iron Man', 'Batman', 'Spider-Man', 'Superman'] },
  { topic: 'Anime Titans', names: ['Goku', 'Naruto', 'Luffy', 'Ichigo'] },
  { topic: 'Monsters Clash', names: ['Godzilla', 'Kong', 'T-Rex', 'Megalodon'] },
  { topic: 'Fast Food Royale', names: ['Burger', 'Pizza', 'Taco', 'Fries'] },
];

export default function GamePage() {
  // Topic and Contestants State
  const [topic, setTopic] = useState('Marvel vs DC');
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

  // 1. Initialize Contestants
  useEffect(() => {
    setContestants((prev) => {
      const updated: ContestantConfig[] = [];
      const preset = PRESET_TOPICS[0].names;

      for (let i = 0; i < contestantCount; i++) {
        if (prev[i]) {
          updated.push(prev[i]);
        } else {
          updated.push({
            id: `fighter_${i + 1}`,
            name: preset[i] || `Fighter ${i + 1}`,
            color: COLOR_SWATCHES[i % COLOR_SWATCHES.length].hex,
            image_url: null,
            starting_health: 100,
            damage: 25,
            speed: 6.5,
            special_power: SPECIAL_POWERS[(i % (SPECIAL_POWERS.length - 1)) + 1].id,
            special_ability: PRESET_ABILITIES[i % PRESET_ABILITIES.length],
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
    if (rollNewSeed) {
      battleSeedRef.current = Math.floor(Math.random() * 1000000);
    }

    // Preload image elements if any
    contestants.forEach((c) => {
      if (c.image_url && !loadedImagesRef.current.has(c.image_url)) {
        const img = new Image();
        img.src = c.image_url;
        loadedImagesRef.current.set(c.image_url, img);
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

      // Circular Arena Floor (Enlarged Radius: 430px)
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, ARENA_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#0c101c';
      ctx.fill();

      const floorGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, ARENA_RADIUS);
      floorGrad.addColorStop(0, 'rgba(30, 41, 59, 0.6)');
      floorGrad.addColorStop(0.85, 'rgba(15, 23, 42, 0.9)');
      floorGrad.addColorStop(1, 'rgba(2, 6, 23, 0.98)');
      ctx.fillStyle = floorGrad;
      ctx.fill();

      // Inner ring
      ctx.beginPath();
      ctx.arc(cx, cy, ARENA_RADIUS * 0.45, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.font = '900 90px "Montserrat", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VS', cx, cy);

      // Glowing Wall
      ctx.beginPath();
      ctx.arc(cx, cy, ARENA_RADIUS, 0, Math.PI * 2);
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#38bdf8';
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 30;
      ctx.stroke();
      ctx.shadowBlur = 0;
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
        ctx.fillStyle = '#0f172a';
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

      // Contestants (Enlarged Box Size: 120px) with clearly visible names
      fighters.forEach((f) => {
        if (f.isDead) return;

        const half = f.size / 2;
        const cornerRadius = 22;

        ctx.save();
        ctx.translate(f.x, f.y);

        ctx.shadowColor = f.color;
        ctx.shadowBlur = 24;

        ctx.beginPath();
        ctx.roundRect(-half, -half, f.size, f.size, cornerRadius);
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        ctx.save();
        ctx.clip();

        const img = f.image_url ? loadedImagesRef.current.get(f.image_url) : null;
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, -half, -half, f.size, f.size);
        } else {
          const grad = ctx.createLinearGradient(-half, -half, half, half);
          grad.addColorStop(0, f.color);
          grad.addColorStop(1, '#020617');
          ctx.fillStyle = grad;
          ctx.fillRect(-half, -half, f.size, f.size);

          ctx.fillStyle = f.color === '#ffffff' ? '#000' : '#fff';
          ctx.font = '900 54px "Montserrat", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(f.name.charAt(0).toUpperCase(), 0, 0);
        }

        if (f.hitFlash > 0) {
          ctx.fillStyle = `rgba(239, 68, 68, ${f.hitFlash / 12})`;
          ctx.fillRect(-half, -half, f.size, f.size);
        }

        ctx.restore();

        ctx.beginPath();
        ctx.roundRect(-half, -half, f.size, f.size, cornerRadius);
        ctx.lineWidth = 7;
        ctx.strokeStyle = f.hitFlash > 0 ? '#ffffff' : f.color;
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Distinct, Clearly Visible Name Badge directly below the box
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 2;
        ctx.font = '900 16px "Montserrat", sans-serif';
        const nameW = ctx.measureText(f.name).width;
        ctx.beginPath();
        ctx.roundRect(-nameW / 2 - 12, half + 6, nameW + 24, 28, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.name, 0, half + 20);
        ctx.restore();

        // Active Item Badge Floating Above
        let itemBadge = '';
        if (f.hasShield) itemBadge += '🛡️';
        if (f.hasDagger) itemBadge += '🗡️';
        if (f.gunBullets > 0) itemBadge += `🔫x${f.gunBullets}`;
        if (f.speedBoostTimer > 0) itemBadge += '⚡';

        if (itemBadge) {
          ctx.font = '18px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(itemBadge, 0, -half - 14);
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
      ctx.fillText(topic.toUpperCase() || 'ARENA CLASH', width / 2, 100);
      ctx.restore();

      // Dual Sided Healthbars below arena
      drawLiveHealthBars(ctx, fighters, width);

      // Victory Overlay: ONLY SHOWN WHEN frameWinner IS PRESENT!
      if (frameWinner) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, width, height);

        ctx.font = '100px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑', width / 2, height / 2 - 130);

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
    const startY = 1220;
    const count = fighters.length;
    const colWidth = 460;
    const leftX = 50;
    const rightX = width - colWidth - 50;
    const rows = Math.ceil(count / 2);
    const rowHeight = Math.min(125, 580 / Math.max(rows, 2));

    fighters.forEach((f, idx) => {
      let x = leftX;
      let y = startY;

      if (count === 2) {
        x = idx === 0 ? leftX : rightX;
        y = startY + 60;
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

      ctx.beginPath();
      ctx.roundRect(0, 0, colWidth, rowHeight - 16, 20);
      ctx.fillStyle = f.isDead ? 'rgba(15, 23, 42, 0.45)' : 'rgba(15, 23, 42, 0.9)';
      ctx.fill();
      ctx.lineWidth = f.isDead ? 1 : 3;
      ctx.strokeStyle = f.isDead ? '#334155' : f.color;
      ctx.stroke();

      const thumbSize = rowHeight - 36;
      ctx.save();
      ctx.translate(10, 10);
      ctx.beginPath();
      ctx.roundRect(0, 0, thumbSize, thumbSize, 14);
      ctx.fillStyle = f.color;
      ctx.fill();
      ctx.clip();

      const img = f.image_url ? loadedImagesRef.current.get(f.image_url) : null;
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

      const textX = thumbSize + 24;
      ctx.font = count <= 4 ? '900 28px "Montserrat", sans-serif' : '900 24px "Montserrat", sans-serif';
      ctx.fillStyle = f.isDead ? '#64748b' : '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const abIcon = f.specialAbility ? f.specialAbility.icon : '';
      let itemTag = '';
      if (f.bonusShield > 0 || f.hasShield) itemTag += ' 🛡️';
      if (f.hasDagger) itemTag += ' 🗡️';
      if (f.gunBullets > 0) itemTag += ` 🔫x${f.gunBullets}`;
      if (f.speedBoostTimer > 0) itemTag += ' ⚡';
      if (f.frozenTimer > 0) itemTag += ' ❄️';

      ctx.fillText(`${f.name} ${abIcon}${itemTag}`, textX, 10);

      ctx.font = '800 18px "Montserrat", sans-serif';
      ctx.fillStyle = f.isDead ? '#ef4444' : '#38bdf8';
      ctx.textAlign = 'right';
      ctx.fillText(f.isDead ? 'ELIMINATED' : `${Math.round(f.health)} HP`, colWidth - 16, 14);

      const barX = textX;
      const barY = rowHeight - 38;
      const barW = colWidth - textX - 16;
      const barH = 16;

      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 8);
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.fill();

      if (!f.isDead && f.health > 0) {
        const hpPct = Math.max(0, f.health / f.maxHealth);
        let hpColor = '#10b981';
        if (hpPct < 0.25) hpColor = '#ef4444';
        else if (hpPct < 0.5) hpColor = '#f59e0b';

        ctx.beginPath();
        ctx.roundRect(barX, barY, barW * hpPct, barH, 8);
        ctx.fillStyle = hpColor;
        ctx.shadowColor = hpColor;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
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

  // 8. Handlers & Simulation Controls
  const resetSimulation = () => {
    setIsPlaying(false);
    initSimulation(true);
  };

  const handlePlayToggle = () => {
    const sim = simResultRef.current;
    if (!isPlaying) {
      if (sim && currentFrameRef.current >= sim.frames.length - 1) {
        currentFrameRef.current = 0;
        lastSoundFrameRef.current = -1;
        setWinner(null);
      }
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
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

      // Update contestant
      setContestants((prev) => {
        const copy = [...prev];
        copy[cropTargetIndex] = { ...copy[cropTargetIndex], image_url: croppedDataUrl };
        return copy;
      });

      // Update loadedImages cache
      const cachedImg = new Image();
      cachedImg.src = croppedDataUrl;
      loadedImagesRef.current.set(croppedDataUrl, cachedImg);

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
  };

  const handleLoadPreset = (presetIndex: number) => {
    const p = PRESET_TOPICS[presetIndex];
    setTopic(p.topic);
    setContestantCount(p.names.length);
    setContestants(
      p.names.map((name, i) => ({
        id: `fighter_${i + 1}`,
        name,
        color: COLOR_SWATCHES[i % COLOR_SWATCHES.length].hex,
        image_url: null,
        starting_health: 100,
        damage: 25,
        speed: 6.5,
        special_power: SPECIAL_POWERS[(i % (SPECIAL_POWERS.length - 1)) + 1].id,
      }))
    );
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
                <div className="flex gap-1.5">
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
              <div className="flex-1 w-full h-full rounded-[30px] overflow-hidden bg-black relative">
                <canvas
                  ref={canvasRef}
                  width={1080}
                  height={1920}
                  className="w-full h-full object-cover"
                />
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
            <div className="h-[90vh] aspect-[9/16] bg-black rounded-[36px] overflow-hidden border-4 border-slate-800 shadow-2xl shadow-cyan-950/40 relative">
              <canvas
                ref={fullscreenCanvasRef}
                width={1080}
                height={1920}
                className="w-full h-full object-cover"
              />
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
      </div>
    </div>
  );
}
