'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Types
export interface ContestantConfig {
  id: string;
  name: string;
  color: string;
  image_url: string | null;
  starting_health: number;
  damage: number;
  speed: number;
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
  speed: number;
  isDead: boolean;
  hitFlash: number;
  invulnerableTimer: number;
}

const DEFAULT_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Yellow
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

const PRESET_TOPICS = [
  { topic: 'Marvel vs DC', names: ['Iron Man', 'Batman', 'Spider-Man', 'Superman'] },
  { topic: 'Anime Royale', names: ['Goku', 'Naruto', 'Luffy', 'Ichigo'] },
  { topic: 'Titan Monsters', names: ['Godzilla', 'King Kong', 'T-Rex', 'Megalodon'] },
  { topic: 'Fast Food Clash', names: ['Burger', 'Pizza', 'Taco', 'French Fries'] },
  { topic: 'Gaming Legends', names: ['Mario', 'Sonic', 'Master Chief', 'Kratos'] },
];

export default function GamePage() {
  // Setup State
  const [topic, setTopic] = useState('Marvel vs DC');
  const [contestantCount, setContestantCount] = useState<number>(4);
  const [contestants, setContestants] = useState<ContestantConfig[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.5);

  // Simulation Controls
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [aliveCount, setAliveCount] = useState(4);
  const [winner, setWinner] = useState<LiveFighter | null>(null);
  const [announcerLoading, setAnnouncerLoading] = useState(false);
  const [announcerAudioUrl, setAnnouncerAudioUrl] = useState<string | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueMessage, setQueueMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Canvas & Audio Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Simulation State Refs (for high performance canvas loop)
  const fightersRef = useRef<LiveFighter[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const screenShakeRef = useRef(0);
  const arenaRadiusRef = useRef(380);
  const arenaCenterRef = useRef({ x: 540, y: 960 });

  // 1. Initialize Contestants when Count Changes
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
            color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
            image_url: null,
            starting_health: 100,
            damage: 25,
            speed: 6,
          });
        }
      }
      return updated;
    });
  }, [contestantCount]);

  // 2. Sound Effects Engine (Web Audio API Synthesizer)
  const getAudioContext = () => {
    if (!audioCtxRef.current && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playBounceSound = () => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.3 * soundVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
  };

  const playHitSound = () => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.5 * soundVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  };

  const playExplosionSound = () => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      // White noise buffer for explosion
      const bufferSize = ctx.sampleRate * 0.4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.8 * soundVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
      noise.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  };

  const playVictorySound = () => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, i) => {
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
    } catch (e) {}
  };

  // 3. Reset & Setup Live Simulation Fighters
  const resetSimulation = () => {
    setIsPlaying(false);
    setWinner(null);
    setAliveCount(contestants.length);
    particlesRef.current = [];
    floatingTextsRef.current = [];
    screenShakeRef.current = 0;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = 1080;
    const height = 1920;
    const centerX = width / 2;
    const centerY = height / 2;
    const arenaRadius = 380;

    arenaCenterRef.current = { x: centerX, y: centerY };
    arenaRadiusRef.current = arenaRadius;

    const count = contestants.length;
    const fighters: LiveFighter[] = [];

    contestants.forEach((c, idx) => {
      // Distribute evenly along a starting circle
      const angle = (idx / count) * Math.PI * 2 + Math.PI / 4;
      const spawnRadius = arenaRadius * 0.6;
      const x = centerX + Math.cos(angle) * spawnRadius;
      const y = centerY + Math.sin(angle) * spawnRadius;

      // Random inward velocity vector
      const speed = c.speed || 6;
      const moveAngle = angle + Math.PI + (Math.random() - 0.5) * 0.8;
      const vx = Math.cos(moveAngle) * speed;
      const vy = Math.sin(moveAngle) * speed;

      // Check cached image
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
        size: 90, // Small square box size
        health: c.starting_health || 100,
        maxHealth: c.starting_health || 100,
        damage: c.damage || 25,
        speed: c.speed || 6,
        isDead: false,
        hitFlash: 0,
        invulnerableTimer: 0,
      });
    });

    fightersRef.current = fighters;
    drawFrame();
  };

  // Re-initialize when contestants array changes
  useEffect(() => {
    resetSimulation();
  }, [contestants]);

  // 4. Physics Engine & Render Loop
  const updatePhysics = () => {
    const fighters = fightersRef.current;
    const particles = particlesRef.current;
    const floatingTexts = floatingTextsRef.current;
    const { x: cx, y: cy } = arenaCenterRef.current;
    const arenaRadius = arenaRadiusRef.current;

    // Decay screen shake
    if (screenShakeRef.current > 0) {
      screenShakeRef.current = Math.max(0, screenShakeRef.current - 0.8);
    }

    const aliveFighters = fighters.filter((f) => !f.isDead);

    // If only 1 survivor remains, declare victory!
    if (aliveFighters.length === 1 && !winner && fighters.length > 1) {
      setWinner(aliveFighters[0]);
      setIsPlaying(false);
      playVictorySound();

      // Confetti burst for winner
      for (let i = 0; i < 70; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 3;
        particles.push({
          x: aliveFighters[0].x,
          y: aliveFighters[0].y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
          radius: Math.random() * 5 + 3,
          alpha: 1,
          decay: 0.01 + Math.random() * 0.015,
        });
      }
    }

    // 4.1 Update Position and Circular Boundary Bounce
    aliveFighters.forEach((f) => {
      // Invulnerability / cooldown timer
      if (f.invulnerableTimer > 0) f.invulnerableTimer--;
      if (f.hitFlash > 0) f.hitFlash--;

      // Move by velocity * simulation speed multiplier
      f.x += f.vx * simSpeed;
      f.y += f.vy * simSpeed;

      // Realistic circular arena bounce
      const dx = f.x - cx;
      const dy = f.y - cy;
      const dist = Math.hypot(dx, dy);
      const halfSize = (f.size / 2) * 1.1; // box boundary buffer

      if (dist + halfSize >= arenaRadius) {
        // Inward normal unit vector
        const nx = -dx / dist;
        const ny = -dy / dist;

        // Push back inside circular boundary
        f.x = cx - nx * (arenaRadius - halfSize);
        f.y = cy - ny * (arenaRadius - halfSize);

        // Reflection vector: v' = v - 2(v . n)n
        const dot = f.vx * nx + f.vy * ny;
        f.vx = f.vx - 2 * dot * nx;
        f.vy = f.vy - 2 * dot * ny;

        // Wall spark particles
        playBounceSound();
        for (let i = 0; i < 4; i++) {
          particles.push({
            x: f.x,
            y: f.y,
            vx: nx * (Math.random() * 3 + 1) + (Math.random() - 0.5) * 3,
            vy: ny * (Math.random() * 3 + 1) + (Math.random() - 0.5) * 3,
            color: '#facc15',
            radius: Math.random() * 3 + 2,
            alpha: 1,
            decay: 0.04,
          });
        }
      }
    });

    // 4.2 Box-to-Box Elastic Collision & Combat Damage
    for (let i = 0; i < aliveFighters.length; i++) {
      for (let j = i + 1; j < aliveFighters.length; j++) {
        const A = aliveFighters[i];
        const B = aliveFighters[j];

        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const dist = Math.hypot(dx, dy);
        const minDist = (A.size + B.size) / 2;

        if (dist < minDist && dist > 0) {
          // Normal vector from A to B
          const nx = dx / dist;
          const ny = dy / dist;

          // Separate boxes to prevent sticking
          const overlap = minDist - dist;
          A.x -= (nx * overlap) / 2;
          A.y -= (ny * overlap) / 2;
          B.x += (nx * overlap) / 2;
          B.y += (ny * overlap) / 2;

          // Elastic momentum exchange
          const kx = A.vx - B.vx;
          const ky = A.vy - B.vy;
          const p = 2 * (nx * kx + ny * ky) / 2; // Assuming equal mass

          A.vx -= p * nx;
          A.vy -= p * ny;
          B.vx += p * nx;
          B.vy += p * ny;

          // Apply damage if not on hit cooldown
          if (A.invulnerableTimer === 0 && B.invulnerableTimer === 0) {
            A.health = Math.max(0, A.health - B.damage);
            B.health = Math.max(0, B.health - A.damage);

            A.hitFlash = 12;
            B.hitFlash = 12;
            A.invulnerableTimer = 18;
            B.invulnerableTimer = 18;

            playHitSound();
            screenShakeRef.current = 6;

            // Damage floating texts
            floatingTexts.push({
              x: A.x + (Math.random() - 0.5) * 20,
              y: A.y - 40,
              text: `-${B.damage}`,
              color: '#ef4444',
              alpha: 1,
              vy: -2.5,
              scale: 1.2,
            });

            floatingTexts.push({
              x: B.x + (Math.random() - 0.5) * 20,
              y: B.y - 40,
              text: `-${A.damage}`,
              color: '#ef4444',
              alpha: 1,
              vy: -2.5,
              scale: 1.2,
            });

            // Clash spark particles
            const midX = (A.x + B.x) / 2;
            const midY = (A.y + B.y) / 2;
            for (let pIdx = 0; pIdx < 12; pIdx++) {
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

            // Check for death
            [A, B].forEach((fighter) => {
              if (fighter.health <= 0 && !fighter.isDead) {
                fighter.isDead = true;
                playExplosionSound();
                setAliveCount((prev) => Math.max(0, prev - 1));

                // Explosion burst
                for (let k = 0; k < 35; k++) {
                  const angle = Math.random() * Math.PI * 2;
                  const spd = Math.random() * 9 + 3;
                  particles.push({
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
              }
            });
          }
        }
      }
    }

    // 4.3 Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * simSpeed;
      p.y += p.vy * simSpeed;
      p.alpha -= p.decay * simSpeed;
      if (p.alpha <= 0) particles.splice(i, 1);
    }

    // 4.4 Update Floating Damage Numbers
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy * simSpeed;
      ft.alpha -= 0.03 * simSpeed;
      if (ft.alpha <= 0) floatingTexts.splice(i, 1);
    }
  };

  // 5. Canvas Drawing Function
  const drawFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1080;
    const height = 1920;
    const { x: cx, y: cy } = arenaCenterRef.current;
    const arenaRadius = arenaRadiusRef.current;

    ctx.save();

    // Screen Shake effect
    if (screenShakeRef.current > 0) {
      const shakeX = (Math.random() - 0.5) * screenShakeRef.current * 3;
      const shakeY = (Math.random() - 0.5) * screenShakeRef.current * 3;
      ctx.translate(shakeX, shakeY);
    }

    // Background: Deep dark cyberpunk arena
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Cyberpunk grid backdrop
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    const gridSize = 80;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 5.1 Draw Circular Arena Floor
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Radial gradient glow on floor
    const floorGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, arenaRadius);
    floorGrad.addColorStop(0, 'rgba(30, 41, 59, 0.9)');
    floorGrad.addColorStop(0.7, 'rgba(15, 23, 42, 0.95)');
    floorGrad.addColorStop(1, 'rgba(30, 58, 138, 0.4)');
    ctx.fillStyle = floorGrad;
    ctx.fill();

    // Arena Center Battle Emblem
    ctx.beginPath();
    ctx.arc(cx, cy, 140, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.font = '900 70px "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', cx, cy);

    // Glowing Circular Arena Wall
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#38bdf8';
    ctx.shadowColor = '#0284c7';
    ctx.shadowBlur = 25;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Outer hazard ring
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius + 16, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();
    ctx.restore();

    // 5.2 Draw Particles
    particlesRef.current.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.restore();
    });

    // 5.3 Draw Contestants (Square Boxes)
    fightersRef.current.forEach((f) => {
      if (f.isDead) return;

      const half = f.size / 2;
      const cornerRadius = 16;

      ctx.save();
      ctx.translate(f.x, f.y);

      // Glow under box
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 20;

      // Draw rounded square path
      ctx.beginPath();
      ctx.roundRect(-half, -half, f.size, f.size, cornerRadius);
      ctx.fillStyle = '#1e293b';
      ctx.fill();

      // Clip image inside rounded square
      ctx.save();
      ctx.clip();

      if (f.image && f.image.complete && f.image.naturalWidth > 0) {
        ctx.drawImage(f.image, -half, -half, f.size, f.size);
      } else {
        // Fallback: Gradient with Name Initial
        const grad = ctx.createLinearGradient(-half, -half, half, half);
        grad.addColorStop(0, f.color);
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(-half, -half, f.size, f.size);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 40px "Montserrat", sans-serif';
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

      ctx.shadowBlur = 0; // reset shadow

      // 5.4 Floating Health Bar (Above each square box)
      const barWidth = 110;
      const barHeight = 14;
      const barY = -half - 24;

      // Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(-barWidth / 2, barY, barWidth, barHeight, 7);
      ctx.fill();
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Health Fill
      const healthPct = Math.max(0, f.health / f.maxHealth);
      let hpColor = '#22c55e'; // Green
      if (healthPct < 0.3) hpColor = '#ef4444'; // Red
      else if (healthPct < 0.6) hpColor = '#eab308'; // Yellow

      if (healthPct > 0) {
        ctx.fillStyle = hpColor;
        ctx.beginPath();
        ctx.roundRect(-barWidth / 2 + 1, barY + 1, (barWidth - 2) * healthPct, barHeight - 2, 5);
        ctx.fill();
      }

      // HP Number Text
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(f.health)} HP`, 0, barY + barHeight / 2);

      // Fighter Name tag below health bar
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 13px sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(f.name, 0, barY - 10);

      ctx.restore();
    });

    // 5.5 Draw Floating Damage Numbers
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

    // 5.6 Top Headline & Banner
    ctx.save();
    ctx.textAlign = 'center';

    // Topic / Battle Headline
    ctx.font = '900 58px "Montserrat", sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 20;
    ctx.fillText(topic.toUpperCase() || 'ARENA CLASH', width / 2, 140);

    // Subtitle badge
    ctx.font = '800 24px "Montserrat", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('⚡ CIRCULAR ARENA BATTLE ROYALE ⚡', width / 2, 190);

    ctx.restore();

    // 5.7 Victory Screen Overlay
    if (winner) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, width, height);

      // Golden Crown 👑 above winner
      ctx.font = '100px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑', width / 2, height / 2 - 130);

      // Winner Box in center
      const winHalf = 70;
      ctx.beginPath();
      ctx.roundRect(width / 2 - winHalf, height / 2 - winHalf, 140, 140, 24);
      ctx.fillStyle = winner.color;
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 40;
      ctx.fill();

      if (winner.image && winner.image.complete && winner.image.naturalWidth > 0) {
        ctx.save();
        ctx.clip();
        ctx.drawImage(winner.image, width / 2 - winHalf, height / 2 - winHalf, 140, 140);
        ctx.restore();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 60px "Montserrat", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(winner.name.charAt(0).toUpperCase(), width / 2, height / 2);
      }

      ctx.lineWidth = 8;
      ctx.strokeStyle = '#facc15';
      ctx.stroke();

      // Victory Text
      ctx.font = '900 70px "Montserrat", sans-serif';
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#ca8a04';
      ctx.shadowBlur = 25;
      ctx.textAlign = 'center';
      ctx.fillText('VICTORY!', width / 2, height / 2 + 150);

      ctx.font = '800 48px "Montserrat", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.fillText(`${winner.name} WINS!`, width / 2, height / 2 + 220);

      ctx.restore();
    }

    ctx.restore();
  };

  // 6. Animation Loop
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

  // 7. Handle Contestant Image Upload
  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Url = reader.result as string;

      // Update configuration state
      setContestants((prev) => {
        const copy = [...prev];
        copy[index] = { ...copy[index], image_url: base64Url };
        return copy;
      });

      // Update image cache
      const img = new Image();
      img.src = base64Url;
      loadedImagesRef.current.set(base64Url, img);

      // Update live fighter if simulation initialized
      if (fightersRef.current[index]) {
        fightersRef.current[index].image = img;
      }
    };
    reader.readAsDataURL(file);
  };

  // 8. Update Individual Contestant Field
  const updateContestant = (index: number, updates: Partial<ContestantConfig>) => {
    setContestants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  // 9. Quick Preset Loader
  const handleLoadPreset = (presetIndex: number) => {
    const p = PRESET_TOPICS[presetIndex];
    setTopic(p.topic);
    setContestantCount(p.names.length);
    setContestants(
      p.names.map((name, i) => ({
        id: `fighter_${i + 1}`,
        name,
        color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
        image_url: null,
        starting_health: 100,
        damage: 25,
        speed: 6,
      }))
    );
  };

  // 10. Optional Announcer Voice (ElevenLabs)
  const handleGenerateAnnouncer = async () => {
    setAnnouncerLoading(true);
    try {
      const namesList = contestants.map((c) => c.name).join(', ');
      const script = `Arena Clash! ${topic}. Fighters enter the circle: ${namesList}! 3, 2, 1... FIGHT!`;

      const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
        },
        body: JSON.stringify({ text: script, model_id: 'eleven_multilingual_v2' }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setAnnouncerAudioUrl(url);
        const audio = new Audio(url);
        audio.play();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAnnouncerLoading(false);
    }
  };

  // 11. Queue Battle as YouTube Short Video
  const handleQueueVideo = async () => {
    setQueueLoading(true);
    setQueueMessage(null);

    try {
      // Build data_json for Remotion
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
          text: 'Battle queued successfully! Rendering started via GitHub Actions.',
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
              <p className="text-xs text-slate-400">Custom 2D Circular Arena Physics Simulator</p>
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

        {/* Main Layout Grid: Left Settings, Right 9:16 Interactive Canvas */}
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

              <div className="flex gap-2">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Marvel vs DC"
                  className="flex-1 px-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-white font-bold text-lg focus:outline-none focus:border-amber-400 transition"
                />
              </div>

              {/* Preset Quick Chips */}
              <div className="flex flex-wrap gap-2 pt-2">
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

              {/* Number Buttons: 2 to 8 */}
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

            {/* Contestants Setup System (Cards for each contestant) */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <span>🥊</span> Configure Fighters (Small Square Boxes)
                </h3>
                <span className="text-xs text-slate-400">Name, Image, Health & Damage</span>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {contestants.map((fighter, idx) => (
                  <div
                    key={fighter.id}
                    className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4 hover:border-slate-700 transition"
                  >
                    {/* Square Avatar Box & Upload */}
                    <div className="relative group shrink-0">
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
                          <span className="text-2xl font-black text-slate-400">
                            {fighter.name.charAt(0).toUpperCase()}
                          </span>
                        )}

                        {/* Upload Hover Overlay */}
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition text-[10px] text-white font-bold text-center p-1">
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

                    {/* Fighter Info & Stats */}
                    <div className="flex-1 w-full space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Name Input */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-400 block mb-1">Name</label>
                          <input
                            type="text"
                            value={fighter.name}
                            onChange={(e) => updateContestant(idx, { name: e.target.value })}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-sm focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        {/* Color Selector */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-400 block mb-1">Color Theme</label>
                          <div className="flex items-center gap-1.5">
                            {DEFAULT_COLORS.slice(0, 6).map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => updateContestant(idx, { color: c })}
                                className={`w-6 h-6 rounded-lg transition-transform ${
                                  fighter.color === c ? 'scale-110 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                                }`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Health & Damage Sliders */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1">
                            <span>Starting Health</span>
                            <span className="text-emerald-400 font-bold">{fighter.starting_health} HP</span>
                          </div>
                          <input
                            type="range"
                            min="50"
                            max="250"
                            step="10"
                            value={fighter.starting_health}
                            onChange={(e) =>
                              updateContestant(idx, { starting_health: Number(e.target.value) })
                            }
                            className="w-full accent-emerald-500"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1">
                            <span>Damage per Hit</span>
                            <span className="text-rose-400 font-bold">{fighter.damage} DMG</span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="60"
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

            {/* Audio Settings & ElevenLabs Voice */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span>🔊</span> Sound Effects & Announcer
                </label>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    soundEnabled ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-600' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {soundEnabled ? 'SFX ON' : 'SFX MUTED'}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">Volume</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={soundVolume}
                    onChange={(e) => setSoundVolume(Number(e.target.value))}
                    className="accent-cyan-500 w-32"
                  />
                </div>

                <button
                  onClick={handleGenerateAnnouncer}
                  disabled={announcerLoading}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-md"
                >
                  <span>🎙️</span>
                  <span>{announcerLoading ? 'Generating Voice...' : 'Announcer Voice (ElevenLabs)'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ================= RIGHT 9:16 INTERACTIVE SCREEN (5 Cols) ================= */}
          <div className="lg:col-span-5 flex flex-col items-center space-y-4">
            
            {/* 9:16 Smartphone Container */}
            <div className="relative w-full max-w-[380px] aspect-[9/16] bg-slate-950 rounded-[44px] p-3 shadow-2xl shadow-cyan-950/40 border-[6px] border-slate-800 ring-2 ring-slate-700/50 flex flex-col overflow-hidden">
              
              {/* Dynamic Island / Speaker Notch */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-20 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-slate-900 mr-2" />
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              </div>

              {/* Status Header Overlay */}
              <div className="absolute top-10 left-6 right-6 flex justify-between items-center z-20 pointer-events-none">
                <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur border border-slate-700 text-[11px] font-black text-amber-300">
                  {aliveCount} / {contestants.length} ALIVE
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur border border-slate-700 text-[11px] font-bold text-slate-300">
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
            <div className="w-full max-w-[380px] bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
              
              {/* Main Play & Reset Buttons */}
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
