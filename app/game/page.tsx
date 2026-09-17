'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// Available Special Powers
export interface SpecialPowerDef {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const SPECIAL_POWERS: SpecialPowerDef[] = [
  { id: 'none', name: 'None', icon: '⚪', description: 'No passive special power.' },
  { id: 'iron_shield', name: 'Iron Shield', icon: '🛡️', description: 'Takes 50% less damage when HP is ≤ 50%.' },
  { id: 'berserker', name: 'Berserker Rage', icon: '⚡', description: 'Deals 2x damage when HP drops to ≤ 20%.' },
  { id: 'vampiric', name: 'Vampiric Strike', icon: '🩸', description: 'Restores 20% of damage dealt back to health.' },
  { id: 'thorns', name: 'Thorns Counter', icon: '🌵', description: 'Attacker takes 30% recoil damage on hit.' },
  { id: 'speedster', name: 'Speedster Dash', icon: '💨', description: '+35% base movement speed & swift bounce.' },
  { id: 'phoenix', name: 'Phoenix Rebirth', icon: '🦅', description: 'Survives lethal damage once with 20 HP!' },
];

// Available Color Themes including White and Black
export const COLOR_SWATCHES = [
  { name: 'White', hex: '#ffffff', textDark: true },
  { name: 'Black', hex: '#18181b', textDark: false },
  { name: 'Crimson', hex: '#ef4444', textDark: false },
  { name: 'Sapphire', hex: '#3b82f6', textDark: false },
  { name: 'Emerald', hex: '#10b981', textDark: false },
  { name: 'Amber', hex: '#f59e0b', textDark: false },
  { name: 'Purple', hex: '#8b5cf6', textDark: false },
  { name: 'Cyan', hex: '#06b6d4', textDark: false },
];

export interface ContestantConfig {
  id: string;
  name: string;
  color: string;
  image_url: string | null;
  starting_health: number;
  damage: number;
  speed: number;
  special_power: string;
}

// In-Game Item Types
export type ArenaItemType = 'health' | 'dagger' | 'gun' | 'shield' | 'speed';

interface ArenaItem {
  id: string;
  type: ArenaItemType;
  x: number;
  y: number;
  icon: string;
  name: string;
  color: string;
  spawnTime: number;
  bobOffset: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  color: string;
  damage: number;
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
  decay: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
  scale: number;
}

interface LiveFighter {
  id: string;
  name: string;
  color: string;
  image: HTMLImageElement | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  health: number;
  maxHealth: number;
  damage: number;
  baseSpeed: number;
  specialPower: string;
  isDead: boolean;
  hitFlash: number;
  invulnerableTimer: number;
  phoenixUsed: boolean;
  
  // Active Item Status
  hasShield: boolean;
  hasDagger: boolean;
  daggerTimer: number; // 3 seconds remaining after first hit
  daggerActivated: boolean;
  gunBullets: number;
  speedBoostTimer: number;
}

const PRESET_TOPICS = [
  { topic: 'Marvel vs DC', names: ['Iron Man', 'Batman', 'Spider-Man', 'Superman'] },
  { topic: 'Anime Royale', names: ['Goku', 'Naruto', 'Luffy', 'Ichigo'] },
  { topic: 'Titan Monsters', names: ['Godzilla', 'Kong', 'T-Rex', 'Megalodon'] },
  { topic: 'Fast Food Clash', names: ['Burger', 'Pizza', 'Taco', 'Fries'] },
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

  // Queue State
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueMessage, setQueueMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Canvas & Engine Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Simulation State Refs
  const fightersRef = useRef<LiveFighter[]>([]);
  const itemsRef = useRef<ArenaItem[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const screenShakeRef = useRef(0);
  const nextItemSpawnRef = useRef<number>(210); // 7 seconds at 30fps

  // Circular Arena Setup (Centered in upper area of 1080x1920)
  const arenaRadius = 370;
  const arenaCenter = { x: 540, y: 780 };

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
            speed: 6,
            special_power: SPECIAL_POWERS[(i % (SPECIAL_POWERS.length - 1)) + 1].id,
          });
        }
      }
      return updated;
    });
  }, [contestantCount]);

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

  const playSound = (type: 'bounce' | 'hit' | 'heal' | 'item' | 'gun' | 'explosion' | 'victory') => {
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
        // High sparkle arpeggio
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
      }
    } catch (e) {}
  };

  // 3. Reset Simulation
  const resetSimulation = () => {
    setIsPlaying(false);
    setWinner(null);
    setAliveCount(contestants.length);
    particlesRef.current = [];
    floatingTextsRef.current = [];
    itemsRef.current = [];
    bulletsRef.current = [];
    screenShakeRef.current = 0;
    nextItemSpawnRef.current = 210; // 7 seconds

    const count = contestants.length;
    const fighters: LiveFighter[] = [];

    contestants.forEach((c, idx) => {
      const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
      const spawnRadius = arenaRadius * 0.6;
      const x = arenaCenter.x + Math.cos(angle) * spawnRadius;
      const y = arenaCenter.y + Math.sin(angle) * spawnRadius;

      let speed = c.speed || 6;
      if (c.special_power === 'speedster') speed *= 1.35;

      const moveAngle = angle + Math.PI + (Math.random() - 0.5) * 0.6;
      const vx = Math.cos(moveAngle) * speed;
      const vy = Math.sin(moveAngle) * speed;

      let imgObj: HTMLImageElement | null = null;
      if (c.image_url) {
        if (loadedImagesRef.current.has(c.image_url)) {
          imgObj = loadedImagesRef.current.get(c.image_url)!;
        } else {
          imgObj = new Image();
          imgObj.src = c.image_url;
          loadedImagesRef.current.set(c.image_url, imgObj);
        }
      }

      fighters.push({
        id: c.id,
        name: c.name,
        color: c.color,
        image: imgObj,
        x,
        y,
        vx,
        vy,
        size: 88,
        health: c.starting_health || 100,
        maxHealth: c.starting_health || 100,
        damage: c.damage || 25,
        baseSpeed: speed,
        specialPower: c.special_power || 'none',
        isDead: false,
        hitFlash: 0,
        invulnerableTimer: 0,
        phoenixUsed: false,
        hasShield: false,
        hasDagger: false,
        daggerTimer: 0,
        daggerActivated: false,
        gunBullets: 0,
        speedBoostTimer: 0,
      });
    });

    fightersRef.current = fighters;
    drawFrame();
  };

  useEffect(() => {
    resetSimulation();
  }, [contestants]);

  // 4. Random Item Spawner (Every 7 seconds)
  const spawnRandomItem = () => {
    const itemPool: { type: ArenaItemType; icon: string; name: string; color: string }[] = [
      { type: 'health', icon: '💚', name: '+30 HP Medkit', color: '#22c55e' },
      { type: 'dagger', icon: '🗡️', name: '2x Damage Dagger', color: '#f59e0b' },
      { type: 'gun', icon: '🔫', name: 'Blaster Gun (3 Bullets)', color: '#38bdf8' },
      { type: 'shield', icon: '🛡️', name: 'Energy Shield', color: '#a855f7' },
      { type: 'speed', icon: '⚡', name: 'Hyper Speed', color: '#eab308' },
    ];

    const pick = itemPool[Math.floor(Math.random() * itemPool.length)];
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * (arenaRadius - 80);

    itemsRef.current.push({
      id: `item_${Date.now()}_${Math.random()}`,
      type: pick.type,
      x: arenaCenter.x + Math.cos(angle) * r,
      y: arenaCenter.y + Math.sin(angle) * r,
      icon: pick.icon,
      name: pick.name,
      color: pick.color,
      spawnTime: 0,
      bobOffset: Math.random() * Math.PI * 2,
    });

    playSound('item');

    // Item arrival particles
    for (let i = 0; i < 15; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 4 + 1;
      particlesRef.current.push({
        x: arenaCenter.x + Math.cos(angle) * r,
        y: arenaCenter.y + Math.sin(angle) * r,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        color: pick.color,
        radius: Math.random() * 4 + 2,
        alpha: 1,
        decay: 0.03,
      });
    }
  };

  // 5. Physics & Simulation Engine
  const updatePhysics = () => {
    const fighters = fightersRef.current;
    const items = itemsRef.current;
    const bullets = bulletsRef.current;
    const particles = particlesRef.current;
    const floatingTexts = floatingTextsRef.current;
    const { x: cx, y: cy } = arenaCenter;

    if (screenShakeRef.current > 0) {
      screenShakeRef.current = Math.max(0, screenShakeRef.current - 0.7);
    }

    // 5.1 Item Spawn Timer (7 seconds = 210 frames at 30fps)
    nextItemSpawnRef.current -= simSpeed;
    if (nextItemSpawnRef.current <= 0) {
      if (items.length < 3) {
        spawnRandomItem();
      }
      nextItemSpawnRef.current = 210;
    }

    const aliveFighters = fighters.filter((f) => !f.isDead);

    // Check Victory condition
    if (aliveFighters.length === 1 && !winner && fighters.length > 1) {
      setWinner(aliveFighters[0]);
      setIsPlaying(false);
      playSound('victory');
      for (let i = 0; i < 80; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = Math.random() * 8 + 3;
        particles.push({
          x: aliveFighters[0].x,
          y: aliveFighters[0].y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 2,
          color: COLOR_SWATCHES[Math.floor(Math.random() * COLOR_SWATCHES.length)].hex,
          radius: Math.random() * 5 + 3,
          alpha: 1,
          decay: 0.015,
        });
      }
    }

    // 5.2 Move Fighters & Arena Wall Bounce
    aliveFighters.forEach((f) => {
      if (f.invulnerableTimer > 0) f.invulnerableTimer--;
      if (f.hitFlash > 0) f.hitFlash--;

      // Active Item Timers
      if (f.daggerActivated && f.daggerTimer > 0) {
        f.daggerTimer -= simSpeed;
        if (f.daggerTimer <= 0) {
          f.hasDagger = false;
          f.daggerActivated = false;
        }
      }

      if (f.speedBoostTimer > 0) {
        f.speedBoostTimer -= simSpeed;
      }

      // Move Fighter
      const speedMult = f.speedBoostTimer > 0 ? 1.6 : 1;
      f.x += f.vx * simSpeed * speedMult;
      f.y += f.vy * simSpeed * speedMult;

      // Realistic circular arena bounce
      const dx = f.x - cx;
      const dy = f.y - cy;
      const dist = Math.hypot(dx, dy);
      const halfSize = (f.size / 2) * 1.05;

      if (dist + halfSize >= arenaRadius) {
        const nx = -dx / dist;
        const ny = -dy / dist;

        f.x = cx - nx * (arenaRadius - halfSize);
        f.y = cy - ny * (arenaRadius - halfSize);

        const dot = f.vx * nx + f.vy * ny;
        f.vx = f.vx - 2 * dot * nx;
        f.vy = f.vy - 2 * dot * ny;

        playSound('bounce');

        // Wall sparks
        for (let i = 0; i < 4; i++) {
          particles.push({
            x: f.x,
            y: f.y,
            vx: nx * (Math.random() * 3 + 1) + (Math.random() - 0.5) * 3,
            vy: ny * (Math.random() * 3 + 1) + (Math.random() - 0.5) * 3,
            color: '#38bdf8',
            radius: Math.random() * 3 + 2,
            alpha: 1,
            decay: 0.05,
          });
        }
      }

      // 5.3 Gun Shooting (if player has bullets)
      if (f.gunBullets > 0 && Math.random() < 0.04) {
        f.gunBullets--;
        playSound('gun');

        // Fire bullet towards moving direction
        const vLen = Math.hypot(f.vx, f.vy) || 1;
        const bSpeed = 16;
        bullets.push({
          x: f.x + (f.vx / vLen) * 50,
          y: f.y + (f.vy / vLen) * 50,
          vx: (f.vx / vLen) * bSpeed,
          vy: (f.vy / vLen) * bSpeed,
          ownerId: f.id,
          color: '#38bdf8',
          damage: 5,
          life: 90,
        });

        floatingTexts.push({
          x: f.x,
          y: f.y - 40,
          text: `🔫 BANG!`,
          color: '#38bdf8',
          alpha: 1,
          vy: -2,
          scale: 1,
        });
      }
    });

    // 5.4 Item Pickup Collision
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      item.spawnTime += 0.05 * simSpeed;

      for (const f of aliveFighters) {
        const dist = Math.hypot(f.x - item.x, f.y - item.y);
        if (dist < f.size / 2 + 25) {
          // Player collected item!
          playSound('item');

          if (item.type === 'health') {
            const healAmt = 30;
            f.health = Math.min(f.maxHealth, f.health + healAmt);
            playSound('heal');
            floatingTexts.push({
              x: f.x,
              y: f.y - 45,
              text: `+${healAmt} HP`,
              color: '#22c55e',
              alpha: 1,
              vy: -2.5,
              scale: 1.3,
            });
          } else if (item.type === 'dagger') {
            f.hasDagger = true;
            f.daggerActivated = false;
            f.daggerTimer = 90; // 3 seconds at 30fps
            floatingTexts.push({
              x: f.x,
              y: f.y - 45,
              text: `🗡️ 2X DAMAGE!`,
              color: '#f59e0b',
              alpha: 1,
              vy: -2.5,
              scale: 1.2,
            });
          } else if (item.type === 'gun') {
            f.gunBullets = 3;
            floatingTexts.push({
              x: f.x,
              y: f.y - 45,
              text: `🔫 3 BULLETS!`,
              color: '#38bdf8',
              alpha: 1,
              vy: -2.5,
              scale: 1.2,
            });
          } else if (item.type === 'shield') {
            f.hasShield = true;
            floatingTexts.push({
              x: f.x,
              y: f.y - 45,
              text: `🛡️ SHIELD READY`,
              color: '#a855f7',
              alpha: 1,
              vy: -2.5,
              scale: 1.2,
            });
          } else if (item.type === 'speed') {
            f.speedBoostTimer = 120; // 4s speed
            floatingTexts.push({
              x: f.x,
              y: f.y - 45,
              text: `⚡ HYPER SPEED!`,
              color: '#eab308',
              alpha: 1,
              vy: -2.5,
              scale: 1.2,
            });
          }

          items.splice(i, 1);
          break;
        }
      }
    }

    // 5.5 Bullets Update & Hit Detection
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * simSpeed;
      b.y += b.vy * simSpeed;
      b.life -= simSpeed;

      // Arena boundary hit
      const bDist = Math.hypot(b.x - cx, b.y - cy);
      if (bDist >= arenaRadius || b.life <= 0) {
        bullets.splice(i, 1);
        continue;
      }

      // Check hit against other fighters
      for (const target of aliveFighters) {
        if (target.id === b.ownerId) continue;
        const d = Math.hypot(target.x - b.x, target.y - b.y);
        if (d < target.size / 2) {
          // Bullet Hit!
          target.health = Math.max(0, target.health - b.damage);
          target.hitFlash = 10;
          playSound('hit');

          floatingTexts.push({
            x: target.x,
            y: target.y - 30,
            text: `-${b.damage}`,
            color: '#38bdf8',
            alpha: 1,
            vy: -2,
            scale: 1,
          });

          // Check death
          if (target.health <= 0 && !target.isDead) {
            handleDeath(target);
          }

          bullets.splice(i, 1);
          break;
        }
      }
    }

    // 5.6 Box-to-Box Collision & Special Powers Combat
    for (let i = 0; i < aliveFighters.length; i++) {
      for (let j = i + 1; j < aliveFighters.length; j++) {
        const A = aliveFighters[i];
        const B = aliveFighters[j];

        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const dist = Math.hypot(dx, dy);
        const minDist = (A.size + B.size) / 2;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Separation
          const overlap = minDist - dist;
          A.x -= (nx * overlap) / 2;
          A.y -= (ny * overlap) / 2;
          B.x += (nx * overlap) / 2;
          B.y += (ny * overlap) / 2;

          // Elastic collision velocity swap
          const kx = A.vx - B.vx;
          const ky = A.vy - B.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;

          A.vx -= p * nx;
          A.vy -= p * ny;
          B.vx += p * nx;
          B.vy += p * ny;

          if (A.invulnerableTimer === 0 && B.invulnerableTimer === 0) {
            A.invulnerableTimer = 18;
            B.invulnerableTimer = 18;
            A.hitFlash = 12;
            B.hitFlash = 12;
            screenShakeRef.current = 6;
            playSound('hit');

            // --- Compute Damage from A to B ---
            let dmgA = A.damage;
            if (A.hasDagger) {
              dmgA *= 2;
              A.daggerActivated = true;
            }
            if (A.specialPower === 'berserker' && A.health / A.maxHealth <= 0.2) {
              dmgA *= 2;
            }
            if (B.hasShield) {
              dmgA = 0;
              B.hasShield = false;
              floatingTexts.push({ x: B.x, y: B.y - 40, text: `BLOCKED!`, color: '#a855f7', alpha: 1, vy: -2, scale: 1.2 });
            } else if (B.specialPower === 'iron_shield' && B.health / B.maxHealth <= 0.5) {
              dmgA = Math.round(dmgA * 0.5);
              floatingTexts.push({ x: B.x, y: B.y - 55, text: `🛡️ -50%`, color: '#38bdf8', alpha: 1, vy: -2, scale: 1 });
            }

            // --- Compute Damage from B to A ---
            let dmgB = B.damage;
            if (B.hasDagger) {
              dmgB *= 2;
              B.daggerActivated = true;
            }
            if (B.specialPower === 'berserker' && B.health / B.maxHealth <= 0.2) {
              dmgB *= 2;
            }
            if (A.hasShield) {
              dmgB = 0;
              A.hasShield = false;
              floatingTexts.push({ x: A.x, y: A.y - 40, text: `BLOCKED!`, color: '#a855f7', alpha: 1, vy: -2, scale: 1.2 });
            } else if (A.specialPower === 'iron_shield' && A.health / A.maxHealth <= 0.5) {
              dmgB = Math.round(dmgB * 0.5);
              floatingTexts.push({ x: A.x, y: A.y - 55, text: `🛡️ -50%`, color: '#38bdf8', alpha: 1, vy: -2, scale: 1 });
            }

            // Apply Damage
            B.health = Math.max(0, B.health - dmgA);
            A.health = Math.max(0, A.health - dmgB);

            // Special: Vampiric
            if (A.specialPower === 'vampiric' && dmgA > 0) {
              A.health = Math.min(A.maxHealth, A.health + Math.round(dmgA * 0.2));
            }
            if (B.specialPower === 'vampiric' && dmgB > 0) {
              B.health = Math.min(B.maxHealth, B.health + Math.round(dmgB * 0.2));
            }

            // Special: Thorns Counter
            if (B.specialPower === 'thorns' && dmgA > 0) {
              const recoil = Math.round(dmgA * 0.3);
              A.health = Math.max(0, A.health - recoil);
              floatingTexts.push({ x: A.x, y: A.y - 50, text: `🌵 -${recoil}`, color: '#10b981', alpha: 1, vy: -2, scale: 1 });
            }
            if (A.specialPower === 'thorns' && dmgB > 0) {
              const recoil = Math.round(dmgB * 0.3);
              B.health = Math.max(0, B.health - recoil);
              floatingTexts.push({ x: B.x, y: B.y - 50, text: `🌵 -${recoil}`, color: '#10b981', alpha: 1, vy: -2, scale: 1 });
            }

            // Floating Numbers
            if (dmgA > 0) {
              floatingTexts.push({
                x: B.x + (Math.random() - 0.5) * 20,
                y: B.y - 40,
                text: `-${dmgA}`,
                color: '#ef4444',
                alpha: 1,
                vy: -2.5,
                scale: 1.2,
              });
            }
            if (dmgB > 0) {
              floatingTexts.push({
                x: A.x + (Math.random() - 0.5) * 20,
                y: A.y - 40,
                text: `-${dmgB}`,
                color: '#ef4444',
                alpha: 1,
                vy: -2.5,
                scale: 1.2,
              });
            }

            // Spark particles
            const midX = (A.x + B.x) / 2;
            const midY = (A.y + B.y) / 2;
            for (let k = 0; k < 12; k++) {
              const angle = Math.random() * Math.PI * 2;
              const spd = Math.random() * 6 + 2;
              particles.push({
                x: midX,
                y: midY,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                color: Math.random() > 0.5 ? A.color : B.color,
                radius: Math.random() * 4 + 2,
                alpha: 1,
                decay: 0.04,
              });
            }

            // Check Phoenix or Death
            [A, B].forEach((fighter) => {
              if (fighter.health <= 0) {
                if (fighter.specialPower === 'phoenix' && !fighter.phoenixUsed) {
                  fighter.phoenixUsed = true;
                  fighter.health = 20;
                  playSound('heal');
                  floatingTexts.push({
                    x: fighter.x,
                    y: fighter.y - 50,
                    text: `🦅 REBORN!`,
                    color: '#f59e0b',
                    alpha: 1,
                    vy: -3,
                    scale: 1.4,
                  });
                } else if (!fighter.isDead) {
                  handleDeath(fighter);
                }
              }
            });
          }
        }
      }
    }

    // 5.7 Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * simSpeed;
      p.y += p.vy * simSpeed;
      p.alpha -= p.decay * simSpeed;
      if (p.alpha <= 0) particles.splice(i, 1);
    }

    // 5.8 Update Floating Texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy * simSpeed;
      ft.alpha -= 0.025 * simSpeed;
      if (ft.alpha <= 0) floatingTexts.splice(i, 1);
    }
  };

  const handleDeath = (fighter: LiveFighter) => {
    fighter.isDead = true;
    playSound('explosion');
    setAliveCount((prev) => Math.max(0, prev - 1));

    for (let k = 0; k < 35; k++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 9 + 3;
      particlesRef.current.push({
        x: fighter.x,
        y: fighter.y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color: fighter.color,
        radius: Math.random() * 6 + 3,
        alpha: 1,
        decay: 0.025,
      });
    }
  };

  // 6. Minimalist 9:16 Canvas Drawing Function
  const drawFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1080;
    const height = 1920;
    const { x: cx, y: cy } = arenaCenter;

    ctx.save();

    // Screen Shake
    if (screenShakeRef.current > 0) {
      const shakeX = (Math.random() - 0.5) * screenShakeRef.current * 3;
      const shakeY = (Math.random() - 0.5) * screenShakeRef.current * 3;
      ctx.translate(shakeX, shakeY);
    }

    // Clean Minimalist Background: Deep obsidian black
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, width, height);

    // Subtle dark ambient lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // 6.1 Draw Circular Arena Floor
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0c101c';
    ctx.fill();

    // Radial gradient glow inside arena
    const floorGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, arenaRadius);
    floorGrad.addColorStop(0, 'rgba(30, 41, 59, 0.6)');
    floorGrad.addColorStop(0.85, 'rgba(15, 23, 42, 0.9)');
    floorGrad.addColorStop(1, 'rgba(2, 6, 23, 0.95)');
    ctx.fillStyle = floorGrad;
    ctx.fill();

    // Inner subtle ring
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius * 0.45, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // VS center watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.font = '900 80px "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', cx, cy);

    // Glowing Circular Wall
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#38bdf8';
    ctx.shadowColor = '#0284c7';
    ctx.shadowBlur = 24;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Outer boundary border
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius + 14, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.stroke();
    ctx.restore();

    // 6.2 Draw In-Arena Random Items
    itemsRef.current.forEach((item) => {
      const bob = Math.sin(item.spawnTime + item.bobOffset) * 6;
      ctx.save();
      ctx.translate(item.x, item.y + bob);

      // Glowing Aura
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.shadowColor = item.color;
      ctx.shadowBlur = 20;
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Item icon box
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 3;
      ctx.fill();
      ctx.stroke();

      // Emoji
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.icon, 0, 2);

      // Item label
      ctx.font = '800 12px "Montserrat", sans-serif';
      ctx.fillStyle = item.color;
      ctx.fillText(item.name, 0, 38);

      ctx.restore();
    });

    // 6.3 Draw Bullets
    bulletsRef.current.forEach((b) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.restore();
    });

    // 6.4 Draw Particles
    particlesRef.current.forEach((p) => {
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

    // 6.5 Draw Contestants (Square Boxes)
    fightersRef.current.forEach((f) => {
      if (f.isDead) return;

      const half = f.size / 2;
      const cornerRadius = 18;

      ctx.save();
      ctx.translate(f.x, f.y);

      // Box Glow
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 18;

      // Rounded square path
      ctx.beginPath();
      ctx.roundRect(-half, -half, f.size, f.size, cornerRadius);
      ctx.fillStyle = '#0f172a';
      ctx.fill();

      // Image or Initial Clip
      ctx.save();
      ctx.clip();

      if (f.image && f.image.complete && f.image.naturalWidth > 0) {
        ctx.drawImage(f.image, -half, -half, f.size, f.size);
      } else {
        const grad = ctx.createLinearGradient(-half, -half, half, half);
        grad.addColorStop(0, f.color);
        grad.addColorStop(1, '#020617');
        ctx.fillStyle = grad;
        ctx.fillRect(-half, -half, f.size, f.size);

        ctx.fillStyle = f.color === '#ffffff' ? '#000000' : '#ffffff';
        ctx.font = '900 42px "Montserrat", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.name.charAt(0).toUpperCase(), 0, 0);
      }

      // Hit Flash overlay
      if (f.hitFlash > 0) {
        ctx.fillStyle = `rgba(239, 68, 68, ${f.hitFlash / 12})`;
        ctx.fillRect(-half, -half, f.size, f.size);
      }

      ctx.restore(); // end clip

      // Border around square
      ctx.beginPath();
      ctx.roundRect(-half, -half, f.size, f.size, cornerRadius);
      ctx.lineWidth = 6;
      ctx.strokeStyle = f.hitFlash > 0 ? '#ffffff' : f.color;
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Active Item indicators above box
      let itemBadge = '';
      if (f.hasShield) itemBadge += '🛡️';
      if (f.hasDagger) itemBadge += '🗡️';
      if (f.gunBullets > 0) itemBadge += `🔫x${f.gunBullets}`;
      if (f.speedBoostTimer > 0) itemBadge += '⚡';

      if (itemBadge) {
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(itemBadge, 0, -half - 12);
      }

      ctx.restore();
    });

    // 6.6 Draw Floating Numbers & Texts
    floatingTextsRef.current.forEach((ft) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.fillStyle = ft.color;
      ctx.font = `900 ${Math.round(28 * ft.scale)}px "Montserrat", sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 8;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    // 6.7 Top Headline & Theme Title (Clean & Minimalist)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 54px "Montserrat", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 16;
    ctx.fillText(topic.toUpperCase() || 'ARENA CLASH', width / 2, 130);

    ctx.font = '800 22px "Montserrat", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('⚡ CIRCULAR ARENA BATTLE ⚡', width / 2, 180);
    ctx.restore();

    // 6.8 LIVE HEALTHBARS BELOW THE ROUND ARENA (2 Sides / Columns)
    // Area: y = 1250 to 1840
    // If 2 players: 1 Left, 1 Right
    // If 3 players: 2 on Left & Right, 1 below
    // If 4 players: 2 on Left, 2 on Right
    // If 5-8 players: dual columns left and right
    drawLiveHealthBars(ctx, fightersRef.current, width);

    // 6.9 Victory Overlay
    if (winner) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, 0, width, height);

      ctx.font = '90px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑', width / 2, height / 2 - 120);

      const winHalf = 70;
      ctx.beginPath();
      ctx.roundRect(width / 2 - winHalf, height / 2 - winHalf, 140, 140, 24);
      ctx.fillStyle = winner.color;
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 35;
      ctx.fill();

      if (winner.image && winner.image.complete && winner.image.naturalWidth > 0) {
        ctx.save();
        ctx.clip();
        ctx.drawImage(winner.image, width / 2 - winHalf, height / 2 - winHalf, 140, 140);
        ctx.restore();
      } else {
        ctx.fillStyle = winner.color === '#ffffff' ? '#000' : '#fff';
        ctx.font = '900 64px "Montserrat", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(winner.name.charAt(0).toUpperCase(), width / 2, height / 2);
      }

      ctx.lineWidth = 6;
      ctx.strokeStyle = '#facc15';
      ctx.stroke();

      ctx.font = '900 68px "Montserrat", sans-serif';
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#ca8a04';
      ctx.shadowBlur = 25;
      ctx.textAlign = 'center';
      ctx.fillText('VICTORY!', width / 2, height / 2 + 140);

      ctx.font = '800 44px "Montserrat", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${winner.name} WINS!`, width / 2, height / 2 + 210);

      ctx.restore();
    }

    ctx.restore();
  };

  // 7. Helper: Draw Two-Sided Minimalist Health Bars Below the Round Arena
  const drawLiveHealthBars = (ctx: CanvasRenderingContext2D, fighters: LiveFighter[], width: number) => {
    const startY = 1250;
    const count = fighters.length;

    // Determine grid layout: Left side vs Right side
    // Left column: x = 60 to 510 (width 450)
    // Right column: x = 570 to 1020 (width 450)
    const colWidth = 450;
    const leftX = 60;
    const rightX = width - colWidth - 60; // 570

    // Compute row height based on count
    const rows = Math.ceil(count / 2);
    const rowHeight = Math.min(115, 520 / Math.max(rows, 2));

    fighters.forEach((f, idx) => {
      let x = leftX;
      let y = startY;

      if (count === 2) {
        x = idx === 0 ? leftX : rightX;
        y = startY + 50;
      } else if (count === 3) {
        if (idx === 0) {
          x = leftX;
          y = startY;
        } else if (idx === 1) {
          x = rightX;
          y = startY;
        } else {
          x = (width - colWidth) / 2; // Centered below
          y = startY + rowHeight + 20;
        }
      } else {
        // 4, 5, 6, 7, 8: 2 columns
        const isRight = idx % 2 === 1;
        const row = Math.floor(idx / 2);
        x = isRight ? rightX : leftX;
        y = startY + row * rowHeight;
      }

      ctx.save();
      ctx.translate(x, y);

      // Card Background (Minimalist dark card with color accent border)
      ctx.beginPath();
      ctx.roundRect(0, 0, colWidth, rowHeight - 16, 18);
      ctx.fillStyle = f.isDead ? 'rgba(15, 23, 42, 0.4)' : 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.lineWidth = f.isDead ? 1 : 2;
      ctx.strokeStyle = f.isDead ? '#334155' : f.color;
      ctx.stroke();

      // Avatar Icon (Small Square Thumbnail)
      const thumbSize = rowHeight - 36;
      ctx.save();
      ctx.translate(10, 10);
      ctx.beginPath();
      ctx.roundRect(0, 0, thumbSize, thumbSize, 12);
      ctx.fillStyle = f.color;
      ctx.fill();
      ctx.clip();

      if (f.image && f.image.complete && f.image.naturalWidth > 0) {
        ctx.drawImage(f.image, 0, 0, thumbSize, thumbSize);
      } else {
        ctx.fillStyle = f.color === '#ffffff' ? '#000' : '#fff';
        ctx.font = '900 24px "Montserrat", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.name.charAt(0).toUpperCase(), thumbSize / 2, thumbSize / 2);
      }
      ctx.restore();

      // Top Row: Name + Special Power Icon + Item
      const textX = thumbSize + 24;
      ctx.font = '900 20px "Montserrat", sans-serif';
      ctx.fillStyle = f.isDead ? '#64748b' : '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const powerDef = SPECIAL_POWERS.find((p) => p.id === f.specialPower);
      const powerIcon = powerDef ? powerDef.icon : '';
      let itemTag = '';
      if (f.hasShield) itemTag += ' 🛡️';
      if (f.hasDagger) itemTag += ' 🗡️';
      if (f.gunBullets > 0) itemTag += ` 🔫x${f.gunBullets}`;
      if (f.speedBoostTimer > 0) itemTag += ' ⚡';

      ctx.fillText(`${f.name} ${powerIcon}${itemTag}`, textX, 12);

      // Status text (HP)
      ctx.font = '800 16px "Montserrat", sans-serif';
      ctx.fillStyle = f.isDead ? '#ef4444' : '#38bdf8';
      ctx.textAlign = 'right';
      ctx.fillText(f.isDead ? 'ELIMINATED' : `${Math.round(f.health)} / ${f.maxHealth} HP`, colWidth - 16, 14);

      // Health Bar Track
      const barX = textX;
      const barY = rowHeight - 38;
      const barW = colWidth - textX - 16;
      const barH = 14;

      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 7);
      ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
      ctx.fill();

      // Health Bar Fill
      if (!f.isDead && f.health > 0) {
        const hpPct = Math.max(0, f.health / f.maxHealth);
        let hpColor = '#10b981';
        if (hpPct < 0.25) hpColor = '#ef4444';
        else if (hpPct < 0.5) hpColor = '#f59e0b';

        ctx.beginPath();
        ctx.roundRect(barX, barY, barW * hpPct, barH, 7);
        ctx.fillStyle = hpColor;
        ctx.shadowColor = hpColor;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    });
  };

  // 8. Animation Frame Loop
  useEffect(() => {
    let active = true;

    const loop = () => {
      if (!active) return;
      if (isPlaying) {
        updatePhysics();
      }
      drawFrame();
      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPlaying, simSpeed, winner, topic]);

  // 9. Input & Contestant Handlers
  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Url = reader.result as string;
      setContestants((prev) => {
        const copy = [...prev];
        copy[index] = { ...copy[index], image_url: base64Url };
        return copy;
      });

      const img = new Image();
      img.src = base64Url;
      loadedImagesRef.current.set(base64Url, img);
      if (fightersRef.current[index]) {
        fightersRef.current[index].image = img;
      }
    };
    reader.readAsDataURL(file);
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
        speed: 6,
        special_power: SPECIAL_POWERS[(i % (SPECIAL_POWERS.length - 1)) + 1].id,
      }))
    );
  };

  // 10. Queue Video to YouTube Shorts
  const handleQueueVideo = async () => {
    setQueueLoading(true);
    setQueueMessage(null);

    try {
      const data_json = {
        topic,
        format: 'Arena Clash',
        contestants: contestants.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          image_url: c.image_url,
          starting_health: c.starting_health,
        })),
        duration_seconds: 25,
      };

      const response = await fetch('/api/queue-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_json,
          showSubtitles: false,
          duration: 25,
        }),
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        setQueueMessage({
          type: 'success',
          text: 'Battle queued successfully! GitHub Actions is rendering your video.',
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation Bar */}
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-3xl p-6 flex flex-wrap justify-between items-center gap-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚔️</span>
            <div>
              <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-red-500 via-amber-400 to-cyan-400 bg-clip-text text-transparent">
                ARENA CLASH ROYALE
              </h1>
              <p className="text-xs text-slate-400">Custom 2D Circular Arena Physics Simulator & Video Generator</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
            >
              📊 Chart Generator
            </Link>
            <Link
              href="/aesthetic"
              className="px-4 py-2 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/50 text-purple-300 text-sm font-semibold transition"
            >
              🌸 Aesthetic Generator
            </Link>
            <Link
              href="/admin"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
            >
              ⚙️ Admin
            </Link>
          </div>
        </div>

        {/* Status Message */}
        {queueMessage && (
          <div
            className={`p-4 rounded-2xl text-sm font-semibold flex items-center justify-between ${
              queueMessage.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-300'
                : 'bg-rose-950/80 border border-rose-500 text-rose-300'
            }`}
          >
            <span>{queueMessage.text}</span>
            <button onClick={() => setQueueMessage(null)} className="text-lg opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        {/* Main Grid: Left Setup, Right 9:16 Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ================= LEFT CONFIGURATION PANEL (7 Cols) ================= */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Topic & Headline Box */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span>🏷️</span> Topic / Battle Headline
                </label>
                <span className="text-xs text-slate-400">Shows prominently on screen</span>
              </div>

              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Marvel vs DC"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-white font-bold text-lg focus:outline-none focus:border-amber-400 transition"
              />

              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-xs text-slate-400 self-center mr-1">Presets:</span>
                {PRESET_TOPICS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleLoadPreset(idx)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition"
                  >
                    {p.topic}
                  </button>
                ))}
              </div>
            </div>

            {/* Contestant Count Selector */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span>👥</span> Number of Fighters (Clashers)
                </label>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {contestantCount} Fighters
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {[2, 3, 4, 5, 6, 7, 8].map((num) => (
                  <button
                    key={num}
                    onClick={() => setContestantCount(num)}
                    className={`py-3 rounded-2xl font-black text-lg transition-all ${
                      contestantCount === num
                        ? 'bg-gradient-to-r from-red-600 to-amber-500 text-white shadow-lg shadow-red-500/30 scale-105 border border-amber-300'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Contestants Cards (Configuration) */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <span>🥊</span> Configure Fighters & Special Powers
                </h3>
                <span className="text-xs text-slate-400">Custom stats, powers & colors</span>
              </div>

              <div className="space-y-4 max-h-[620px] overflow-y-auto pr-2 custom-scrollbar">
                {contestants.map((fighter, idx) => (
                  <div
                    key={fighter.id}
                    className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center gap-4 hover:border-slate-700 transition"
                  >
                    {/* Square Avatar Box & Upload */}
                    <div className="relative group shrink-0 self-center md:self-auto">
                      <div
                        className="w-20 h-20 rounded-2xl border-4 overflow-hidden flex items-center justify-center bg-slate-900 shadow-md relative"
                        style={{ borderColor: fighter.color }}
                      >
                        {fighter.image_url ? (
                          <img
                            src={fighter.image_url}
                            alt={fighter.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span
                            className="text-2xl font-black"
                            style={{ color: fighter.color === '#ffffff' ? '#ffffff' : fighter.color }}
                          >
                            {fighter.name.charAt(0).toUpperCase()}
                          </span>
                        )}

                        <label className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition text-[10px] text-white font-bold text-center p-1">
                          <span>📷 Change</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(idx, e)}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-slate-800 border border-slate-600 text-xs font-black flex items-center justify-center text-amber-400">
                        {idx + 1}
                      </span>
                    </div>

                    {/* Inputs Grid */}
                    <div className="flex-1 w-full space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Name */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-400 block mb-1">Name</label>
                          <input
                            type="text"
                            value={fighter.name}
                            onChange={(e) => updateContestant(idx, { name: e.target.value })}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-sm focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        {/* Color Selector (including White & Black) */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-400 block mb-1">Color Theme</label>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {COLOR_SWATCHES.map((c) => (
                              <button
                                key={c.hex}
                                type="button"
                                title={c.name}
                                onClick={() => updateContestant(idx, { color: c.hex })}
                                className={`w-6 h-6 rounded-lg transition-transform border border-slate-600 ${
                                  fighter.color === c.hex ? 'scale-125 ring-2 ring-amber-400' : 'opacity-70 hover:opacity-100'
                                }`}
                                style={{ backgroundColor: c.hex }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Special Power Dropdown */}
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Special Power / Trait</label>
                        <select
                          value={fighter.special_power}
                          onChange={(e) => updateContestant(idx, { special_power: e.target.value })}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-amber-300 font-bold text-xs focus:outline-none focus:border-amber-400"
                        >
                          {SPECIAL_POWERS.map((p) => (
                            <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                              {p.icon} {p.name} - {p.description}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Health & Damage (Direct Number Typing + Range) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 mb-1">
                            <span>Health (HP)</span>
                            <input
                              type="number"
                              min="10"
                              max="500"
                              value={fighter.starting_health}
                              onChange={(e) =>
                                updateContestant(idx, { starting_health: Math.max(10, Number(e.target.value) || 10) })
                              }
                              className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right text-emerald-400 font-bold text-xs"
                            />
                          </div>
                          <input
                            type="range"
                            min="50"
                            max="300"
                            step="10"
                            value={fighter.starting_health}
                            onChange={(e) =>
                              updateContestant(idx, { starting_health: Number(e.target.value) })
                            }
                            className="w-full accent-emerald-500"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 mb-1">
                            <span>Damage (DMG)</span>
                            <input
                              type="number"
                              min="1"
                              max="150"
                              value={fighter.damage}
                              onChange={(e) =>
                                updateContestant(idx, { damage: Math.max(1, Number(e.target.value) || 1) })
                              }
                              className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right text-rose-400 font-bold text-xs"
                            />
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="75"
                            step="5"
                            value={fighter.damage}
                            onChange={(e) => updateContestant(idx, { damage: Number(e.target.value) })}
                            className="w-full accent-rose-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audio Settings */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 shadow-xl flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔊</span>
                <div>
                  <span className="text-sm font-bold block text-slate-200">Game Audio & SFX</span>
                  <span className="text-xs text-slate-400">Bounce, clash, items & victory chimes</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={soundVolume}
                  onChange={(e) => setSoundVolume(Number(e.target.value))}
                  className="accent-cyan-500 w-24"
                />
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    soundEnabled
                      ? 'bg-emerald-950 border border-emerald-500 text-emerald-300'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {soundEnabled ? 'SFX ON' : 'MUTED'}
                </button>
              </div>
            </div>
          </div>

          {/* ================= RIGHT 9:16 INTERACTIVE SCREEN (5 Cols) ================= */}
          <div className="lg:col-span-5 flex flex-col items-center space-y-4">
            
            {/* 9:16 Smartphone Container */}
            <div className="relative w-full max-w-[390px] aspect-[9/16] bg-slate-950 rounded-[44px] p-2.5 shadow-2xl shadow-cyan-950/40 border-[6px] border-slate-800 ring-2 ring-slate-700/50 flex flex-col overflow-hidden">
              
              {/* Dynamic Island Notch */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-20 flex items-center justify-center pointer-events-none">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-900 mr-2" />
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              </div>

              {/* Status Header Overlay */}
              <div className="absolute top-9 left-6 right-6 flex justify-between items-center z-20 pointer-events-none">
                <span className="px-3 py-1 rounded-full bg-slate-900/90 backdrop-blur border border-slate-700 text-[11px] font-black text-amber-300">
                  {aliveCount} / {contestants.length} ALIVE
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-900/90 backdrop-blur border border-slate-700 text-[11px] font-bold text-slate-300">
                  {simSpeed}x SPEED
                </span>
              </div>

              {/* Canvas Viewport (1080 x 1920 Logical) */}
              <div className="flex-1 w-full h-full rounded-[34px] overflow-hidden bg-black relative">
                <canvas
                  ref={canvasRef}
                  width={1080}
                  height={1920}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Bottom Playback & Queue Controls */}
            <div className="w-full max-w-[390px] bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
              
              {/* Play / Reset Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex-1 py-3.5 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all shadow-lg ${
                    isPlaying
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/30'
                  }`}
                >
                  <span>{isPlaying ? '⏸️ PAUSE' : '▶️ PLAY CLASH'}</span>
                </button>

                <button
                  onClick={resetSimulation}
                  title="Reset Game"
                  className="px-4 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl font-bold text-sm text-slate-200 transition"
                >
                  🔄 RESET
                </button>
              </div>

              {/* Speed Controls */}
              <div className="flex items-center justify-between bg-slate-950 p-2 rounded-2xl border border-slate-800 text-xs font-bold text-slate-400">
                <span className="pl-2">Game Speed:</span>
                <div className="flex gap-1">
                  {[1, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setSimSpeed(spd)}
                      className={`px-3 py-1 rounded-xl transition ${
                        simSpeed === spd
                          ? 'bg-cyan-500 text-slate-950 font-black'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
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
                className="w-full py-3 bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 hover:opacity-95 text-white rounded-2xl font-black text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30"
              >
                <span>🚀</span>
                <span>{queueLoading ? 'Queuing Video...' : 'Queue as YouTube Short (Render)'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
