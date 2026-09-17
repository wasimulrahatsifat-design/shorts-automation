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
} from './types';

// Types & Definitions
export { SPECIAL_POWERS, COLOR_SWATCHES };
export type { ContestantConfig };

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

  // Canvas & Engine Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
  const nextItemSpawnRef = useRef<number>(210);

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
    nextItemSpawnRef.current = 210;

    const count = contestants.length;
    const fighters: LiveFighter[] = [];

    contestants.forEach((c, idx) => {
      const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
      const spawnRadius = ARENA_RADIUS * 0.6;
      const x = ARENA_CENTER.x + Math.cos(angle) * spawnRadius;
      const y = ARENA_CENTER.y + Math.sin(angle) * spawnRadius;

      let speed = c.speed || 6.5;
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
    const itemPool: { type: ArenaItem['type']; icon: string; name: string; color: string }[] = [
      { type: 'health', icon: '💚', name: '+30 HP Medkit', color: '#22c55e' },
      { type: 'dagger', icon: '🗡️', name: '2x DMG Dagger', color: '#f59e0b' },
      { type: 'gun', icon: '🔫', name: 'Blaster Gun (3 Bullets)', color: '#38bdf8' },
      { type: 'shield', icon: '🛡️', name: 'Energy Shield', color: '#a855f7' },
      { type: 'speed', icon: '⚡', name: 'Hyper Speed', color: '#eab308' },
    ];

    const pick = itemPool[Math.floor(Math.random() * itemPool.length)];
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * (ARENA_RADIUS - 80);

    itemsRef.current.push({
      id: `item_${Date.now()}_${Math.random()}`,
      type: pick.type,
      x: ARENA_CENTER.x + Math.cos(angle) * r,
      y: ARENA_CENTER.y + Math.sin(angle) * r,
      icon: pick.icon,
      name: pick.name,
      color: pick.color,
      spawnTime: 0,
      bobOffset: Math.random() * Math.PI * 2,
    });

    playSound('item');

    for (let i = 0; i < 15; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 4 + 1;
      particlesRef.current.push({
        x: ARENA_CENTER.x + Math.cos(angle) * r,
        y: ARENA_CENTER.y + Math.sin(angle) * r,
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
    const { x: cx, y: cy } = ARENA_CENTER;

    if (screenShakeRef.current > 0) {
      screenShakeRef.current = Math.max(0, screenShakeRef.current - 0.7);
    }

    // Item Spawn Timer (Every 7s)
    nextItemSpawnRef.current -= simSpeed;
    if (nextItemSpawnRef.current <= 0) {
      if (items.length < 3) spawnRandomItem();
      nextItemSpawnRef.current = 210;
    }

    const aliveFighters = fighters.filter((f) => !f.isDead);

    // Victory Check
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

    // Move Fighters & Circular Arena Bounce
    aliveFighters.forEach((f) => {
      if (f.invulnerableTimer > 0) f.invulnerableTimer--;
      if (f.hitFlash > 0) f.hitFlash--;

      if (f.daggerActivated && f.daggerTimer > 0) {
        f.daggerTimer -= simSpeed;
        if (f.daggerTimer <= 0) {
          f.hasDagger = false;
          f.daggerActivated = false;
        }
      }

      if (f.speedBoostTimer > 0) f.speedBoostTimer -= simSpeed;

      const speedMult = f.speedBoostTimer > 0 ? 1.6 : 1;
      f.x += f.vx * simSpeed * speedMult;
      f.y += f.vy * simSpeed * speedMult;

      const dx = f.x - cx;
      const dy = f.y - cy;
      const dist = Math.hypot(dx, dy);
      const halfSize = (f.size / 2) * 1.05;

      if (dist + halfSize >= ARENA_RADIUS) {
        const nx = -dx / dist;
        const ny = -dy / dist;

        f.x = cx - nx * (ARENA_RADIUS - halfSize);
        f.y = cy - ny * (ARENA_RADIUS - halfSize);

        const dot = f.vx * nx + f.vy * ny;
        f.vx = f.vx - 2 * dot * nx;
        f.vy = f.vy - 2 * dot * ny;

        playSound('bounce');

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

      // Gun Shooting
      if (f.gunBullets > 0 && Math.random() < 0.04) {
        f.gunBullets--;
        playSound('gun');
        const vLen = Math.hypot(f.vx, f.vy) || 1;
        bullets.push({
          x: f.x + (f.vx / vLen) * 50,
          y: f.y + (f.vy / vLen) * 50,
          vx: (f.vx / vLen) * 16,
          vy: (f.vy / vLen) * 16,
          ownerId: f.id,
          color: '#38bdf8',
          damage: 5,
          life: 90,
        });
      }
    });

    // Item Pickup Collision
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      item.spawnTime += 0.05 * simSpeed;

      for (const f of aliveFighters) {
        if (Math.hypot(f.x - item.x, f.y - item.y) < f.size / 2 + 25) {
          playSound('item');

          if (item.type === 'health') {
            f.health = Math.min(f.maxHealth, f.health + 30);
            playSound('heal');
            floatingTexts.push({ x: f.x, y: f.y - 45, text: '+30 HP', color: '#22c55e', alpha: 1, vy: -2.5, scale: 1.3 });
          } else if (item.type === 'dagger') {
            f.hasDagger = true;
            f.daggerActivated = false;
            f.daggerTimer = 90;
            floatingTexts.push({ x: f.x, y: f.y - 45, text: '🗡️ 2X DMG', color: '#f59e0b', alpha: 1, vy: -2.5, scale: 1.2 });
          } else if (item.type === 'gun') {
            f.gunBullets = 3;
            floatingTexts.push({ x: f.x, y: f.y - 45, text: '🔫 3 BULLETS', color: '#38bdf8', alpha: 1, vy: -2.5, scale: 1.2 });
          } else if (item.type === 'shield') {
            f.hasShield = true;
            floatingTexts.push({ x: f.x, y: f.y - 45, text: '🛡️ SHIELD', color: '#a855f7', alpha: 1, vy: -2.5, scale: 1.2 });
          } else if (item.type === 'speed') {
            f.speedBoostTimer = 120;
            floatingTexts.push({ x: f.x, y: f.y - 45, text: '⚡ SPEED', color: '#eab308', alpha: 1, vy: -2.5, scale: 1.2 });
          }

          items.splice(i, 1);
          break;
        }
      }
    }

    // Bullets Hit
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * simSpeed;
      b.y += b.vy * simSpeed;
      b.life -= simSpeed;

      if (Math.hypot(b.x - cx, b.y - cy) >= ARENA_RADIUS || b.life <= 0) {
        bullets.splice(i, 1);
        continue;
      }

      for (const target of aliveFighters) {
        if (target.id === b.ownerId) continue;
        if (Math.hypot(target.x - b.x, target.y - b.y) < target.size / 2) {
          target.health = Math.max(0, target.health - b.damage);
          target.hitFlash = 10;
          playSound('hit');

          floatingTexts.push({ x: target.x, y: target.y - 30, text: `-${b.damage}`, color: '#38bdf8', alpha: 1, vy: -2, scale: 1 });

          if (target.health <= 0 && !target.isDead) handleDeath(target);
          bullets.splice(i, 1);
          break;
        }
      }
    }

    // Box to Box Combat
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

          const overlap = minDist - dist;
          A.x -= (nx * overlap) / 2;
          A.y -= (ny * overlap) / 2;
          B.x += (nx * overlap) / 2;
          B.y += (ny * overlap) / 2;

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

            let dmgA = A.damage;
            if (A.hasDagger) { dmgA *= 2; A.daggerActivated = true; }
            if (A.specialPower === 'berserker' && A.health / A.maxHealth <= 0.2) dmgA *= 2;
            if (B.hasShield) { dmgA = 0; B.hasShield = false; floatingTexts.push({ x: B.x, y: B.y - 40, text: `BLOCKED!`, color: '#a855f7', alpha: 1, vy: -2, scale: 1.2 }); }
            else if (B.specialPower === 'iron_shield' && B.health / B.maxHealth <= 0.5) { dmgA = Math.round(dmgA * 0.5); floatingTexts.push({ x: B.x, y: B.y - 55, text: `🛡️ -50%`, color: '#38bdf8', alpha: 1, vy: -2, scale: 1 }); }

            let dmgB = B.damage;
            if (B.hasDagger) { dmgB *= 2; B.daggerActivated = true; }
            if (B.specialPower === 'berserker' && B.health / B.maxHealth <= 0.2) dmgB *= 2;
            if (A.hasShield) { dmgB = 0; A.hasShield = false; floatingTexts.push({ x: A.x, y: A.y - 40, text: `BLOCKED!`, color: '#a855f7', alpha: 1, vy: -2, scale: 1.2 }); }
            else if (A.specialPower === 'iron_shield' && A.health / A.maxHealth <= 0.5) { dmgB = Math.round(dmgB * 0.5); floatingTexts.push({ x: A.x, y: A.y - 55, text: `🛡️ -50%`, color: '#38bdf8', alpha: 1, vy: -2, scale: 1 }); }

            B.health = Math.max(0, B.health - dmgA);
            A.health = Math.max(0, A.health - dmgB);

            if (A.specialPower === 'vampiric' && dmgA > 0) A.health = Math.min(A.maxHealth, A.health + Math.round(dmgA * 0.2));
            if (B.specialPower === 'vampiric' && dmgB > 0) B.health = Math.min(B.maxHealth, B.health + Math.round(dmgB * 0.2));

            if (B.specialPower === 'thorns' && dmgA > 0) { const rec = Math.round(dmgA * 0.3); A.health = Math.max(0, A.health - rec); floatingTexts.push({ x: A.x, y: A.y - 50, text: `🌵 -${rec}`, color: '#10b981', alpha: 1, vy: -2, scale: 1 }); }
            if (A.specialPower === 'thorns' && dmgB > 0) { const rec = Math.round(dmgB * 0.3); B.health = Math.max(0, B.health - rec); floatingTexts.push({ x: B.x, y: B.y - 50, text: `🌵 -${rec}`, color: '#10b981', alpha: 1, vy: -2, scale: 1 }); }

            if (dmgA > 0) floatingTexts.push({ x: B.x + (Math.random() - 0.5) * 20, y: B.y - 40, text: `-${dmgA}`, color: '#ef4444', alpha: 1, vy: -2.5, scale: 1.2 });
            if (dmgB > 0) floatingTexts.push({ x: A.x + (Math.random() - 0.5) * 20, y: A.y - 40, text: `-${dmgB}`, color: '#ef4444', alpha: 1, vy: -2.5, scale: 1.2 });

            const midX = (A.x + B.x) / 2;
            const midY = (A.y + B.y) / 2;
            for (let k = 0; k < 12; k++) {
              const a = Math.random() * Math.PI * 2;
              const s = Math.random() * 6 + 2;
              particles.push({ x: midX, y: midY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: Math.random() > 0.5 ? A.color : B.color, radius: Math.random() * 4 + 2, alpha: 1, decay: 0.04 });
            }

            [A, B].forEach((f) => {
              if (f.health <= 0) {
                if (f.specialPower === 'phoenix' && !f.phoenixUsed) {
                  f.phoenixUsed = true;
                  f.health = 20;
                  playSound('heal');
                  floatingTexts.push({ x: f.x, y: f.y - 50, text: `🦅 REBORN!`, color: '#f59e0b', alpha: 1, vy: -3, scale: 1.4 });
                } else if (!f.isDead) handleDeath(f);
              }
            });
          }
        }
      }
    }

    // Decay Particles & Floating Texts
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * simSpeed;
      p.y += p.vy * simSpeed;
      p.alpha -= p.decay * simSpeed;
      if (p.alpha <= 0) particles.splice(i, 1);
    }

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

  // 6. Draw Frame on Canvas
  const drawFrame = () => {
    const canvases = [canvasRef.current, fullscreenCanvasRef.current].filter(Boolean) as HTMLCanvasElement[];
    canvases.forEach((canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = 1080;
      const height = 1920;
      const { x: cx, y: cy } = ARENA_CENTER;

      ctx.save();

      if (screenShakeRef.current > 0) {
        const shakeX = (Math.random() - 0.5) * screenShakeRef.current * 3;
        const shakeY = (Math.random() - 0.5) * screenShakeRef.current * 3;
        ctx.translate(shakeX, shakeY);
      }

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

      // Circular Arena Floor
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, ARENA_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#0c101c';
      ctx.fill();

      const floorGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, ARENA_RADIUS);
      floorGrad.addColorStop(0, 'rgba(30, 41, 59, 0.6)');
      floorGrad.addColorStop(0.85, 'rgba(15, 23, 42, 0.9)');
      floorGrad.addColorStop(1, 'rgba(2, 6, 23, 0.95)');
      ctx.fillStyle = floorGrad;
      ctx.fill();

      // Inner ring
      ctx.beginPath();
      ctx.arc(cx, cy, ARENA_RADIUS * 0.45, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.font = '900 80px "Montserrat", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VS', cx, cy);

      // Glowing Wall
      ctx.beginPath();
      ctx.arc(cx, cy, ARENA_RADIUS, 0, Math.PI * 2);
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#38bdf8';
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 24;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Draw Items
      itemsRef.current.forEach((item) => {
        const bob = Math.sin(item.spawnTime + item.bobOffset) * 6;
        ctx.save();
        ctx.translate(item.x, item.y + bob);

        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.shadowColor = item.color;
        ctx.shadowBlur = 20;
        ctx.globalAlpha = 0.25;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();

        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.icon, 0, 2);

        ctx.font = '800 13px "Montserrat", sans-serif';
        ctx.fillStyle = item.color;
        ctx.fillText(item.name, 0, 38);
        ctx.restore();
      });

      // Bullets
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

      // Particles
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

      // Contestants (Square Boxes)
      fightersRef.current.forEach((f) => {
        if (f.isDead) return;

        const half = f.size / 2;
        const cornerRadius = 18;

        ctx.save();
        ctx.translate(f.x, f.y);

        ctx.shadowColor = f.color;
        ctx.shadowBlur = 18;

        ctx.beginPath();
        ctx.roundRect(-half, -half, f.size, f.size, cornerRadius);
        ctx.fillStyle = '#0f172a';
        ctx.fill();

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

          ctx.fillStyle = f.color === '#ffffff' ? '#000' : '#fff';
          ctx.font = '900 42px "Montserrat", sans-serif';
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
        ctx.lineWidth = 6;
        ctx.strokeStyle = f.hitFlash > 0 ? '#ffffff' : f.color;
        ctx.stroke();

        ctx.shadowBlur = 0;

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

      // Floating Numbers
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

      // Top Headline
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

      // Dual Sided Healthbars below arena
      drawLiveHealthBars(ctx, fightersRef.current, width);

      // Victory Overlay
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
    });
  };

  // Helper: Live Health Bars below arena
  const drawLiveHealthBars = (ctx: CanvasRenderingContext2D, fighters: LiveFighter[], width: number) => {
    const startY = 1250;
    const count = fighters.length;
    const colWidth = 450;
    const leftX = 60;
    const rightX = width - colWidth - 60;
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
      ctx.roundRect(0, 0, colWidth, rowHeight - 16, 18);
      ctx.fillStyle = f.isDead ? 'rgba(15, 23, 42, 0.4)' : 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.lineWidth = f.isDead ? 1 : 2;
      ctx.strokeStyle = f.isDead ? '#334155' : f.color;
      ctx.stroke();

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

      ctx.font = '800 16px "Montserrat", sans-serif';
      ctx.fillStyle = f.isDead ? '#ef4444' : '#38bdf8';
      ctx.textAlign = 'right';
      ctx.fillText(f.isDead ? 'ELIMINATED' : `${Math.round(f.health)} HP`, colWidth - 16, 14);

      const barX = textX;
      const barY = rowHeight - 38;
      const barW = colWidth - textX - 16;
      const barH = 14;

      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 7);
      ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
      ctx.fill();

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

  // 7. Animation Loop
  useEffect(() => {
    let active = true;

    const loop = () => {
      if (!active) return;
      if (isPlaying) updatePhysics();
      drawFrame();
      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPlaying, simSpeed, winner, topic, isFullscreen]);

  // 8. Handlers
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
      if (fightersRef.current[index]) fightersRef.current[index].image = img;
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
        speed: 6.5,
        special_power: SPECIAL_POWERS[(i % (SPECIAL_POWERS.length - 1)) + 1].id,
      }))
    );
  };

  // 9. Queue Video to YouTube Shorts
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
          damage: c.damage,
          speed: c.speed,
          special_power: c.special_power,
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
          text: 'Video queued successfully! GitHub Actions is rendering your exact gameplay.',
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
                ARENA CLASH <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">2D PHYSICS</span>
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
            <Link href="/admin" className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 transition">
              Admin
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

        {/* Minimalist Workspace Grid */}
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
                  {/* Avatar Upload */}
                  <div className="relative group shrink-0">
                    <div
                      className="w-14 h-14 rounded-xl border-2 overflow-hidden flex items-center justify-center bg-slate-950 relative"
                      style={{ borderColor: fighter.color }}
                    >
                      {fighter.image_url ? (
                        <img src={fighter.image_url} alt={fighter.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-black" style={{ color: fighter.color === '#ffffff' ? '#fff' : fighter.color }}>
                          {fighter.name.charAt(0).toUpperCase()}
                        </span>
                      )}

                      <label className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition text-[9px] text-white font-bold">
                        <span>📷</span>
                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(idx, e)} className="hidden" />
                      </label>
                    </div>
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
              
              {/* Dynamic Island / Notch */}
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
                  onClick={() => setIsPlaying(!isPlaying)}
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
                <span>{queueLoading ? 'Queuing Video...' : 'Queue as YouTube Short (Render Gameplay)'}</span>
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
                  onClick={() => setIsPlaying(!isPlaying)}
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
      </div>
    </div>
  );
}
