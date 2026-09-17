// Deterministic 2D Physics Simulator for Arena Clash Royale

export interface FighterInput {
  id: string;
  name: string;
  color: string;
  image_url?: string | null;
  starting_health?: number;
  damage?: number;
  speed?: number;
  special_power?: string;
}

export interface SimFighter {
  id: string;
  name: string;
  color: string;
  image_url: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  health: number;
  maxHealth: number;
  damage: number;
  specialPower: string;
  isDead: boolean;
  hitFlash: number;
  invulnerableTimer: number;
  phoenixUsed: boolean;
  hasShield: boolean;
  hasDagger: boolean;
  daggerTimer: number;
  daggerActivated: boolean;
  gunBullets: number;
  speedBoostTimer: number;
}

export interface SimItem {
  id: string;
  type: 'health' | 'dagger' | 'gun' | 'shield' | 'speed';
  x: number;
  y: number;
  icon: string;
  name: string;
  color: string;
  bobOffset: number;
}

export interface SimBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  color: string;
  damage: number;
  life: number;
}

export interface SimFloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
  scale: number;
}

export interface SimParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
}

export interface SimFrameState {
  fighters: SimFighter[];
  items: SimItem[];
  bullets: SimBullet[];
  floatingTexts: SimFloatingText[];
  particles: SimParticle[];
  winner: SimFighter | null;
  aliveCount: number;
}

// Simple seeded pseudo-random number generator for 100% deterministic simulation
function createSeededRng(seed = 123456789) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export const ARENA_RADIUS = 370;
export const ARENA_CENTER = { x: 540, y: 780 };

export function generateArenaSimulation(
  contestants: FighterInput[],
  totalFrames = 750,
  seed = 42
): SimFrameState[] {
  const rng = createSeededRng(seed);
  const count = Math.max(2, contestants.length);

  // Initialize Fighters
  const fighters: SimFighter[] = contestants.map((c, idx) => {
    const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
    const spawnRadius = ARENA_RADIUS * 0.6;
    const x = ARENA_CENTER.x + Math.cos(angle) * spawnRadius;
    const y = ARENA_CENTER.y + Math.sin(angle) * spawnRadius;

    let baseSpd = c.speed || 6.5;
    if (c.special_power === 'speedster') baseSpd *= 1.35;

    const moveAngle = angle + Math.PI + (rng() - 0.5) * 0.6;
    const vx = Math.cos(moveAngle) * baseSpd;
    const vy = Math.sin(moveAngle) * baseSpd;

    return {
      id: c.id || `fighter_${idx + 1}`,
      name: c.name || `Fighter ${idx + 1}`,
      color: c.color || '#3b82f6',
      image_url: c.image_url || null,
      x,
      y,
      vx,
      vy,
      size: 88,
      health: c.starting_health || 100,
      maxHealth: c.starting_health || 100,
      damage: c.damage || 25,
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
    };
  });

  const frames: SimFrameState[] = [];
  const items: SimItem[] = [];
  const bullets: SimBullet[] = [];
  const floatingTexts: SimFloatingText[] = [];
  const particles: SimParticle[] = [];
  let winner: SimFighter | null = null;
  let nextItemSpawn = 210; // 7s at 30fps

  const itemTypes: { type: SimItem['type']; icon: string; name: string; color: string }[] = [
    { type: 'health', icon: '💚', name: '+30 HP', color: '#22c55e' },
    { type: 'dagger', icon: '🗡️', name: '2x DMG', color: '#f59e0b' },
    { type: 'gun', icon: '🔫', name: 'Blaster', color: '#38bdf8' },
    { type: 'shield', icon: '🛡️', name: 'Shield', color: '#a855f7' },
    { type: 'speed', icon: '⚡', name: 'Speed', color: '#eab308' },
  ];

  for (let frame = 0; frame < totalFrames; frame++) {
    const aliveFighters = fighters.filter((f) => !f.isDead);

    // Check winner
    if (aliveFighters.length === 1 && !winner && fighters.length > 1) {
      winner = { ...aliveFighters[0] };
    }

    // Item Spawner (every 7 seconds)
    nextItemSpawn--;
    if (nextItemSpawn <= 0) {
      if (items.length < 3 && !winner) {
        const pick = itemTypes[Math.floor(rng() * itemTypes.length)];
        const a = rng() * Math.PI * 2;
        const r = rng() * (ARENA_RADIUS - 80);
        items.push({
          id: `item_${frame}`,
          type: pick.type,
          x: ARENA_CENTER.x + Math.cos(a) * r,
          y: ARENA_CENTER.y + Math.sin(a) * r,
          icon: pick.icon,
          name: pick.name,
          color: pick.color,
          bobOffset: rng() * Math.PI * 2,
        });
      }
      nextItemSpawn = 210;
    }

    // Move Fighters & Circular Wall Bounce
    aliveFighters.forEach((f) => {
      if (f.invulnerableTimer > 0) f.invulnerableTimer--;
      if (f.hitFlash > 0) f.hitFlash--;

      if (f.daggerActivated && f.daggerTimer > 0) {
        f.daggerTimer--;
        if (f.daggerTimer <= 0) {
          f.hasDagger = false;
          f.daggerActivated = false;
        }
      }

      if (f.speedBoostTimer > 0) f.speedBoostTimer--;

      const spdMult = f.speedBoostTimer > 0 ? 1.6 : 1;
      f.x += f.vx * spdMult;
      f.y += f.vy * spdMult;

      // Circle bounce
      const dx = f.x - ARENA_CENTER.x;
      const dy = f.y - ARENA_CENTER.y;
      const dist = Math.hypot(dx, dy);
      const halfSize = (f.size / 2) * 1.05;

      if (dist + halfSize >= ARENA_RADIUS) {
        const nx = -dx / dist;
        const ny = -dy / dist;

        f.x = ARENA_CENTER.x - nx * (ARENA_RADIUS - halfSize);
        f.y = ARENA_CENTER.y - ny * (ARENA_RADIUS - halfSize);

        const dot = f.vx * nx + f.vy * ny;
        f.vx = f.vx - 2 * dot * nx;
        f.vy = f.vy - 2 * dot * ny;

        // Spark particles
        for (let k = 0; k < 3; k++) {
          particles.push({
            x: f.x,
            y: f.y,
            vx: nx * (rng() * 3 + 1) + (rng() - 0.5) * 3,
            vy: ny * (rng() * 3 + 1) + (rng() - 0.5) * 3,
            color: '#38bdf8',
            radius: rng() * 3 + 2,
            alpha: 1,
          });
        }
      }

      // Gun firing
      if (f.gunBullets > 0 && rng() < 0.04) {
        f.gunBullets--;
        const vLen = Math.hypot(f.vx, f.vy) || 1;
        bullets.push({
          x: f.x + (f.vx / vLen) * 50,
          y: f.y + (f.vy / vLen) * 50,
          vx: (f.vx / vLen) * 16,
          vy: (f.vy / vLen) * 16,
          ownerId: f.id,
          color: '#38bdf8',
          damage: 5,
          life: 80,
        });
      }
    });

    // Item Pickup
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      for (const f of aliveFighters) {
        const d = Math.hypot(f.x - it.x, f.y - it.y);
        if (d < f.size / 2 + 25) {
          if (it.type === 'health') {
            f.health = Math.min(f.maxHealth, f.health + 30);
            floatingTexts.push({ id: `ft_${frame}_${i}`, x: f.x, y: f.y - 45, text: '+30 HP', color: '#22c55e', alpha: 1, vy: -2.5, scale: 1.3 });
          } else if (it.type === 'dagger') {
            f.hasDagger = true;
            f.daggerActivated = false;
            f.daggerTimer = 90;
            floatingTexts.push({ id: `ft_${frame}_${i}`, x: f.x, y: f.y - 45, text: '🗡️ 2X DMG', color: '#f59e0b', alpha: 1, vy: -2.5, scale: 1.2 });
          } else if (it.type === 'gun') {
            f.gunBullets = 3;
            floatingTexts.push({ id: `ft_${frame}_${i}`, x: f.x, y: f.y - 45, text: '🔫 3 SHOTS', color: '#38bdf8', alpha: 1, vy: -2.5, scale: 1.2 });
          } else if (it.type === 'shield') {
            f.hasShield = true;
            floatingTexts.push({ id: `ft_${frame}_${i}`, x: f.x, y: f.y - 45, text: '🛡️ SHIELD', color: '#a855f7', alpha: 1, vy: -2.5, scale: 1.2 });
          } else if (it.type === 'speed') {
            f.speedBoostTimer = 120;
            floatingTexts.push({ id: `ft_${frame}_${i}`, x: f.x, y: f.y - 45, text: '⚡ SPEED', color: '#eab308', alpha: 1, vy: -2.5, scale: 1.2 });
          }
          items.splice(i, 1);
          break;
        }
      }
    }

    // Bullets Hit
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;

      const bDist = Math.hypot(b.x - ARENA_CENTER.x, b.y - ARENA_CENTER.y);
      if (bDist >= ARENA_RADIUS || b.life <= 0) {
        bullets.splice(i, 1);
        continue;
      }

      for (const t of aliveFighters) {
        if (t.id === b.ownerId) continue;
        if (Math.hypot(t.x - b.x, t.y - b.y) < t.size / 2) {
          t.health = Math.max(0, t.health - b.damage);
          t.hitFlash = 10;
          floatingTexts.push({ id: `b_${frame}_${i}`, x: t.x, y: t.y - 30, text: `-${b.damage}`, color: '#38bdf8', alpha: 1, vy: -2, scale: 1 });

          if (t.health <= 0 && !t.isDead) {
            t.isDead = true;
          }
          bullets.splice(i, 1);
          break;
        }
      }
    }

    // Box to Box Clash
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

            let dmgA = A.damage;
            if (A.hasDagger) { dmgA *= 2; A.daggerActivated = true; }
            if (A.specialPower === 'berserker' && A.health / A.maxHealth <= 0.2) dmgA *= 2;
            if (B.hasShield) { dmgA = 0; B.hasShield = false; }
            else if (B.specialPower === 'iron_shield' && B.health / B.maxHealth <= 0.5) dmgA = Math.round(dmgA * 0.5);

            let dmgB = B.damage;
            if (B.hasDagger) { dmgB *= 2; B.daggerActivated = true; }
            if (B.specialPower === 'berserker' && B.health / B.maxHealth <= 0.2) dmgB *= 2;
            if (A.hasShield) { dmgB = 0; A.hasShield = false; }
            else if (A.specialPower === 'iron_shield' && A.health / A.maxHealth <= 0.5) dmgB = Math.round(dmgB * 0.5);

            B.health = Math.max(0, B.health - dmgA);
            A.health = Math.max(0, A.health - dmgB);

            if (A.specialPower === 'vampiric' && dmgA > 0) A.health = Math.min(A.maxHealth, A.health + Math.round(dmgA * 0.2));
            if (B.specialPower === 'vampiric' && dmgB > 0) B.health = Math.min(B.maxHealth, B.health + Math.round(dmgB * 0.2));

            if (dmgA > 0) floatingTexts.push({ id: `dmgA_${frame}`, x: B.x, y: B.y - 40, text: `-${dmgA}`, color: '#ef4444', alpha: 1, vy: -2.5, scale: 1.2 });
            if (dmgB > 0) floatingTexts.push({ id: `dmgB_${frame}`, x: A.x, y: A.y - 40, text: `-${dmgB}`, color: '#ef4444', alpha: 1, vy: -2.5, scale: 1.2 });

            [A, B].forEach((f) => {
              if (f.health <= 0) {
                if (f.specialPower === 'phoenix' && !f.phoenixUsed) {
                  f.phoenixUsed = true;
                  f.health = 20;
                  floatingTexts.push({ id: `phx_${frame}`, x: f.x, y: f.y - 50, text: '🦅 REBORN!', color: '#f59e0b', alpha: 1, vy: -3, scale: 1.3 });
                } else if (!f.isDead) {
                  f.isDead = true;
                }
              }
            });
          }
        }
      }
    }

    // Decay Particles & Floating Texts
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].x += particles[i].vx;
      particles[i].y += particles[i].vy;
      particles[i].alpha -= 0.04;
      if (particles[i].alpha <= 0) particles.splice(i, 1);
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      floatingTexts[i].y += floatingTexts[i].vy;
      floatingTexts[i].alpha -= 0.03;
      if (floatingTexts[i].alpha <= 0) floatingTexts.splice(i, 1);
    }

    // Save snapshot of current frame
    frames.push({
      fighters: fighters.map((f) => ({ ...f })),
      items: items.map((it) => ({ ...it })),
      bullets: bullets.map((b) => ({ ...b })),
      floatingTexts: floatingTexts.map((ft) => ({ ...ft })),
      particles: particles.map((p) => ({ ...p })),
      winner: winner ? { ...winner } : null,
      aliveCount: aliveFighters.length,
    });
  }

  return frames;
}
