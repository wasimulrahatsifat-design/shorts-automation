// Deterministic 2D Physics Simulator for Ben 10 Square Arena Ball Battle

export interface SpecialAbility {
  name: string;             // e.g., "Sonic Clap", "Supernova Inferno"
  icon: string;             // Emoji e.g. "💥", "🔥", "⚡", "💎", "🛡️"
  type: 'damage' | 'shield' | 'heal' | 'freeze' | 'speed';
  cooldown_seconds: number; // e.g. 5, 8
  power_value: number;      // Damage amount, heal amount, shield durability, or freeze duration
  description?: string;
  trigger_type?: 'charge' | 'hp_threshold' | 'hit_combo' | 'cooldown';
  trigger_value?: number;   // 100 for 100% charge, 50 for 50% HP, 5 for 5 hits
  weapon_type?: 'sword' | 'fist' | 'flame' | 'crystal' | 'none';
  weapon_icon?: string;
}

export interface FighterInput {
  id: string;
  name: string;
  color: string;
  image_url?: string | null;
  starting_health?: number;
  damage?: number;
  speed?: number;
  special_power?: string;
  special_ability?: SpecialAbility;
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
  angle: number;             // Radians rotation for ball rolling & weapon
  energyCharge: number;      // 0 to 100% (Omnitrix gauge)
  hitCombo: number;          // Consecutive hits landed
  health: number;
  maxHealth: number;
  damage: number;
  specialPower: string;
  specialAbility: SpecialAbility;
  abilityCooldownTimer: number;
  abilityCooldownMax: number;
  abilityAuraTimer: number;
  abilityAuraColor: string;
  abilityAuraIcon: string;
  frozenTimer: number;
  bonusShield: number;
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
  specialMoveReady: boolean;
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

export interface SoundEvent {
  frame: number;
  sound: 'hit' | 'bounce' | 'item' | 'gun' | 'explosion' | 'winner' | 'ability';
  abilityType?: string;
  volume?: number;
}

export interface SimFrameState {
  fighters: SimFighter[];
  items: SimItem[];
  bullets: SimBullet[];
  floatingTexts: SimFloatingText[];
  particles: SimParticle[];
  winner: SimFighter | null;
  aliveCount: number;
  isOvertime?: boolean;
}

export interface SimulationResult {
  frames: SimFrameState[];
  soundEvents: SoundEvent[];
  totalFrames: number;
  totalSeconds: number;
  winner: SimFighter | null;
}

function createSeededRng(seed = 123456789) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Proportional dynamic fighter sizing based on fighter count
export function getFighterSize(count: number): number {
  if (count <= 2) return 130;
  if (count <= 4) return 110;
  if (count <= 6) return 92;
  if (count <= 8) return 78;
  return Math.max(62, Math.round(300 / Math.sqrt(count)));
}

// High-tech Square Arena dimensions (Centered in 1080x1920 Shorts canvas)
export const ARENA_BOX = {
  left: 90,
  top: 250,
  right: 990,
  bottom: 1150,
  width: 900,
  height: 900,
};
export const ARENA_RADIUS = 450; // Kept for backwards compatibility
export const ARENA_CENTER = { x: 540, y: 700 };
export const BOX_SIZE = 120; // Default fallback for backwards compatibility

// Authentic Ben 10 Alien Presets & Abilities
export const BEN10_DEFAULT_ABILITIES: Record<string, SpecialAbility> = {
  four_arms: {
    name: 'Sonic Clap',
    icon: '💥',
    type: 'damage',
    cooldown_seconds: 5,
    power_value: 40,
    trigger_type: 'charge',
    trigger_value: 100,
    weapon_type: 'fist',
    weapon_icon: '🥊',
    description: 'Deals massive shockwave blast and knocks opponents back!',
  },
  heatblast: {
    name: 'Supernova Inferno',
    icon: '🔥',
    type: 'damage',
    cooldown_seconds: 6,
    power_value: 45,
    trigger_type: 'hp_threshold',
    trigger_value: 50,
    weapon_type: 'flame',
    weapon_icon: '🔥',
    description: 'Ignites when HP < 50%, unleashing blazing firestorm beams!',
  },
  xlr8: {
    name: 'Turbo Blitz',
    icon: '⚡',
    type: 'speed',
    cooldown_seconds: 4,
    power_value: 2.2,
    trigger_type: 'charge',
    trigger_value: 100,
    weapon_type: 'none',
    description: 'Lightspeed acceleration bouncing across the square arena!',
  },
  diamondhead: {
    name: 'Crystal Spike',
    icon: '💎',
    type: 'shield',
    cooldown_seconds: 6,
    power_value: 50,
    trigger_type: 'charge',
    trigger_value: 100,
    weapon_type: 'crystal',
    weapon_icon: '💎',
    description: 'Erupts indestructible crystal barriers absorbing hits!',
  },
  cannonbolt: {
    name: 'Wrecking Roll',
    icon: '🛡️',
    type: 'damage',
    cooldown_seconds: 5,
    power_value: 38,
    trigger_type: 'charge',
    trigger_value: 100,
    weapon_type: 'none',
    description: 'Indestructible rolling ball crushing opponents!',
  },
  upgrade: {
    name: 'Circuit Overload',
    icon: '🤖',
    type: 'damage',
    cooldown_seconds: 5,
    power_value: 36,
    trigger_type: 'charge',
    trigger_value: 100,
    weapon_type: 'none',
    description: 'Electrifies the square arena walls with green laser sparks!',
  },
  ghostfreak: {
    name: 'Shadow Phase',
    icon: '👻',
    type: 'freeze',
    cooldown_seconds: 7,
    power_value: 2.5,
    trigger_type: 'hp_threshold',
    trigger_value: 40,
    weapon_type: 'none',
    description: 'Phases through reality and telekinetically freezes opponents!',
  },
  ripjaws: {
    name: 'Steel Jaw Bite',
    icon: '🦈',
    type: 'damage',
    cooldown_seconds: 5,
    power_value: 42,
    trigger_type: 'hit_combo',
    trigger_value: 4,
    weapon_type: 'none',
    description: 'After 4 hit combo, chomps down with ferocious crushing jaws!',
  },
  // Generic fallbacks
  iron_shield: { name: 'Iron Bastion', icon: '🛡️', type: 'shield', cooldown_seconds: 6, power_value: 40, trigger_type: 'charge', trigger_value: 100 },
  berserker: { name: 'Berserk Strike', icon: '💥', type: 'damage', cooldown_seconds: 5, power_value: 35, trigger_type: 'hp_threshold', trigger_value: 30 },
  vampiric: { name: 'Life Drain', icon: '🩸', type: 'heal', cooldown_seconds: 6, power_value: 25, trigger_type: 'charge', trigger_value: 100 },
  thorns: { name: 'Spike Burst', icon: '🌵', type: 'damage', cooldown_seconds: 5, power_value: 30, trigger_type: 'charge', trigger_value: 100 },
  speedster: { name: 'Flash Dash', icon: '⚡', type: 'speed', cooldown_seconds: 4, power_value: 2, trigger_type: 'charge', trigger_value: 100 },
  phoenix: { name: 'Holy Heal', icon: '💚', type: 'heal', cooldown_seconds: 7, power_value: 35, trigger_type: 'hp_threshold', trigger_value: 35 },
  freeze: { name: 'Frost Freeze', icon: '❄️', type: 'freeze', cooldown_seconds: 7, power_value: 2.2, trigger_type: 'charge', trigger_value: 100 },
  none: { name: 'Omnitrix Blast', icon: '⚡', type: 'damage', cooldown_seconds: 5, power_value: 30, trigger_type: 'charge', trigger_value: 100 },
};

export const DEFAULT_ABILITIES = BEN10_DEFAULT_ABILITIES;

export function generateArenaSimulation(
  contestants: FighterInput[],
  maxFrames = 3600, // Safe upper limit (2 minutes), battle stops when winner emerges!
  seed = 42
): SimulationResult {
  const rng = createSeededRng(seed);
  const count = Math.max(2, contestants.length);
  const dynamicSize = getFighterSize(count);

  // Initialize Fighters inside Square Arena Box
  const fighters: SimFighter[] = contestants.map((c, idx) => {
    const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
    const spawnRadius = (ARENA_BOX.width / 2) * 0.62;
    const x = ARENA_CENTER.x + Math.cos(angle) * spawnRadius;
    const y = ARENA_CENTER.y + Math.sin(angle) * spawnRadius;

    let baseSpd = c.speed || 6.8;
    if (c.special_power === 'speedster') baseSpd *= 1.35;

    const moveAngle = angle + Math.PI + (rng() - 0.5) * 0.7;
    const vx = Math.cos(moveAngle) * baseSpd;
    const vy = Math.sin(moveAngle) * baseSpd;

    // Resolve Special Ability
    const ability: SpecialAbility = c.special_ability ||
      BEN10_DEFAULT_ABILITIES[c.special_power || 'none'] ||
      BEN10_DEFAULT_ABILITIES['four_arms'] || {
        name: 'Omnitrix Blast',
        icon: '⚡',
        type: 'damage',
        cooldown_seconds: 5,
        power_value: 35,
        trigger_type: 'charge',
        trigger_value: 100,
      };

    const cooldownFrames = Math.max(60, Math.round(ability.cooldown_seconds * 30));
    const initialCooldown = Math.round(cooldownFrames * (0.3 + rng() * 0.4));

    return {
      id: c.id || `fighter_${idx + 1}`,
      name: c.name || `Fighter ${idx + 1}`,
      color: c.color || '#3b82f6',
      image_url: c.image_url || null,
      x,
      y,
      vx,
      vy,
      size: dynamicSize,
      angle: rng() * Math.PI * 2,
      energyCharge: 0,
      hitCombo: 0,
      health: c.starting_health || 100,
      maxHealth: c.starting_health || 100,
      damage: c.damage || 25,
      specialPower: c.special_power || 'none',
      specialAbility: ability,
      abilityCooldownTimer: initialCooldown,
      abilityCooldownMax: cooldownFrames,
      abilityAuraTimer: 0,
      abilityAuraColor: '#00ff66',
      abilityAuraIcon: ability.icon,
      frozenTimer: 0,
      bonusShield: 0,
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
      specialMoveReady: false,
    };
  });

  const frames: SimFrameState[] = [];
  const soundEvents: SoundEvent[] = [];
  let items: SimItem[] = [];
  const bullets: SimBullet[] = [];
  const floatingTexts: SimFloatingText[] = [];
  const particles: SimParticle[] = [];

  let winner: SimFighter | null = null;
  let winnerAnnouncedFrame = -1;
  let nextItemSpawnCooldown = 60; // First item spawns 2 seconds in
  let lastBounceFrame = -10;
  let lastHitFrame = -10;
  let announcedOvertime = false;

  const itemTypes: { type: SimItem['type']; icon: string; name: string; color: string }[] = [
    { type: 'health', icon: '💚', name: '+30 HP Medkit', color: '#22c55e' },
    { type: 'dagger', icon: '🗡️', name: '2x DMG Dagger', color: '#f59e0b' },
    { type: 'gun', icon: '🔫', name: 'Blaster (5 Shots)', color: '#38bdf8' },
    { type: 'shield', icon: '🛡️', name: 'Energy Shield', color: '#a855f7' },
    { type: 'speed', icon: '⚡', name: 'Hyper Speed', color: '#eab308' },
  ];

  for (let frame = 0; frame < maxFrames; frame++) {
    const aliveFighters = fighters.filter((f) => !f.isDead);

    // Sudden death / overtime after 35s (frame 1050) if match is still ongoing
    const isOvertime = frame >= 1050 && aliveFighters.length > 1;
    if (isOvertime && !announcedOvertime) {
      announcedOvertime = true;
      floatingTexts.push({
        id: `overtime_${frame}`,
        x: ARENA_CENTER.x,
        y: ARENA_CENTER.y - 120,
        text: '⚡ OVERTIME: 2X DAMAGE! ⚡',
        color: '#ef4444',
        alpha: 1,
        vy: -1,
        scale: 1.6,
      });
      soundEvents.push({ frame, sound: 'ability', abilityType: 'damage', volume: 1.0 });
    }

    // Check winner: Battle runs until last fighter standing!
    if (aliveFighters.length === 1 && !winner && fighters.length > 1) {
      winner = { ...aliveFighters[0] };
      winnerAnnouncedFrame = frame;
      soundEvents.push({ frame, sound: 'winner', volume: 1.0 });
    } else if (aliveFighters.length === 0 && !winner && fighters.length > 1) {
      // Mutual elimination fallback: resurrect fighter with highest maxHealth
      const survivor = fighters[0];
      survivor.isDead = false;
      survivor.health = 15;
      winner = { ...survivor };
      winnerAnnouncedFrame = frame;
      soundEvents.push({ frame, sound: 'winner', volume: 1.0 });
    }

    // Stop simulation exactly 120 frames (4 seconds) after winner is declared
    if (winner && winnerAnnouncedFrame > 0 && frame >= winnerAnnouncedFrame + 120) {
      break;
    }

    // Item Spawner: 8 seconds (240 frames) AFTER an item is picked up (or initial spawn) inside ARENA_BOX
    if (items.length === 0 && !winner) {
      if (nextItemSpawnCooldown > 0) {
        nextItemSpawnCooldown--;
      } else {
        const pick = itemTypes[Math.floor(rng() * itemTypes.length)];
        const spawnX = ARENA_BOX.left + 90 + rng() * (ARENA_BOX.width - 180);
        const spawnY = ARENA_BOX.top + 90 + rng() * (ARENA_BOX.height - 180);
        items.push({
          id: `item_${frame}`,
          type: pick.type,
          x: spawnX,
          y: spawnY,
          icon: pick.icon,
          name: pick.name,
          color: pick.color,
          bobOffset: rng() * Math.PI * 2,
        });
        soundEvents.push({ frame, sound: 'item', volume: 0.6 });
      }
    }

    // Process Ben 10 Special Moves with specific Trigger Criteria for each alive fighter
    if (!winner) {
      aliveFighters.forEach((f) => {
        if (f.frozenTimer > 0) {
          f.frozenTimer--;
          return; // Frozen fighters cannot execute abilities
        }

        if (f.abilityAuraTimer > 0) f.abilityAuraTimer--;
        if (f.abilityCooldownTimer > 0) f.abilityCooldownTimer--;

        const ab = f.specialAbility;
        const triggerType = ab.trigger_type || 'charge';
        const triggerVal = ab.trigger_value !== undefined ? ab.trigger_value : (triggerType === 'charge' ? 100 : triggerType === 'hp_threshold' ? 50 : 4);

        // Check if criteria is satisfied
        let isTriggerReady = false;
        if (triggerType === 'charge') {
          isTriggerReady = f.energyCharge >= 100 && f.abilityCooldownTimer <= 0;
        } else if (triggerType === 'hp_threshold') {
          isTriggerReady = f.health <= (f.maxHealth * triggerVal) / 100 && f.abilityCooldownTimer <= 0;
        } else if (triggerType === 'hit_combo') {
          isTriggerReady = f.hitCombo >= triggerVal && f.abilityCooldownTimer <= 0;
        } else if (triggerType === 'cooldown') {
          isTriggerReady = f.abilityCooldownTimer <= 0;
        }

        f.specialMoveReady = isTriggerReady;

        if (isTriggerReady) {
          const otherFighters = aliveFighters.filter((opp) => opp.id !== f.id);
          if (otherFighters.length === 0) return;

          // Find nearest target
          let nearestOpp = otherFighters[0];
          let minDist = Infinity;
          for (const opp of otherFighters) {
            const d = Math.hypot(opp.x - f.x, opp.y - f.y);
            if (d < minDist) {
              minDist = d;
              nearestOpp = opp;
            }
          }

          // Special Move Announcement Banner
          floatingTexts.push({
            id: `ab_banner_${frame}_${f.id}`,
            x: f.x,
            y: f.y - (f.size / 2 + 35),
            text: `⚡ ${f.name.toUpperCase()}: ${ab.name.toUpperCase()}! ⚡`,
            color: '#00ff66',
            alpha: 1,
            vy: -2.8,
            scale: 1.4,
          });

          f.abilityAuraTimer = 45;
          f.abilityAuraIcon = ab.icon;
          f.abilityAuraColor = '#00ff66';

          // Reset trigger gauges
          f.energyCharge = 0;
          f.hitCombo = 0;
          f.specialMoveReady = false;
          f.abilityCooldownTimer = isOvertime
            ? Math.round(f.abilityCooldownMax * 0.6)
            : f.abilityCooldownMax;

          // Execute Alien Signature Move
          if (ab.type === 'damage') {
            const baseDmg = ab.power_value || 38;
            const finalDmg = isOvertime ? baseDmg * 2 : baseDmg;

            // Damage nearest opponent
            nearestOpp.hitFlash = 16;
            nearestOpp.health = Math.max(0, nearestOpp.health - finalDmg);
            soundEvents.push({ frame, sound: 'ability', abilityType: 'damage', volume: 1.0 });

            // Push nearest opponent violently back (knockback)
            const knockAngle = Math.atan2(nearestOpp.y - f.y, nearestOpp.x - f.x);
            nearestOpp.vx = Math.cos(knockAngle) * 18;
            nearestOpp.vy = Math.sin(knockAngle) * 18;

            floatingTexts.push({
              id: `ab_dmg_${frame}_${nearestOpp.id}`,
              x: nearestOpp.x,
              y: nearestOpp.y - 45,
              text: `-${finalDmg} ${ab.icon}`,
              color: '#ef4444',
              alpha: 1,
              vy: -2.5,
              scale: 1.3,
            });

            // Omnitrix Green Shockwave particles
            for (let k = 0; k < 16; k++) {
              particles.push({
                x: nearestOpp.x + (rng() - 0.5) * 40,
                y: nearestOpp.y + (rng() - 0.5) * 40,
                vx: (rng() - 0.5) * 12,
                vy: (rng() - 0.5) * 12,
                color: '#00ff66',
                radius: rng() * 6 + 3,
                alpha: 1,
              });
            }

            if (nearestOpp.health <= 0 && !nearestOpp.isDead) {
              nearestOpp.isDead = true;
              soundEvents.push({ frame, sound: 'explosion', volume: 1.0 });
            }
          } else if (ab.type === 'shield') {
            f.hasShield = true;
            f.bonusShield = ab.power_value || 50;
            soundEvents.push({ frame, sound: 'ability', abilityType: 'shield', volume: 0.9 });

            floatingTexts.push({
              id: `ab_shd_${frame}_${f.id}`,
              x: f.x,
              y: f.y - 40,
              text: `💎 CRYSTAL SHIELD +${f.bonusShield}`,
              color: '#10b981',
              alpha: 1,
              vy: -2.2,
              scale: 1.25,
            });

            for (let k = 0; k < 12; k++) {
              particles.push({
                x: f.x + (rng() - 0.5) * (f.size + 20),
                y: f.y + (rng() - 0.5) * (f.size + 20),
                vx: (rng() - 0.5) * 4,
                vy: (rng() - 0.5) * 4,
                color: '#10b981',
                radius: rng() * 4 + 2,
                alpha: 1,
              });
            }
          } else if (ab.type === 'heal') {
            const healAmt = Math.min(f.maxHealth - f.health, ab.power_value || 35);
            f.health += healAmt;
            soundEvents.push({ frame, sound: 'ability', abilityType: 'heal', volume: 0.9 });

            floatingTexts.push({
              id: `ab_heal_${frame}_${f.id}`,
              x: f.x,
              y: f.y - 40,
              text: `+${healAmt} HP 💚`,
              color: '#22c55e',
              alpha: 1,
              vy: -2.2,
              scale: 1.25,
            });

            for (let k = 0; k < 10; k++) {
              particles.push({
                x: f.x + (rng() - 0.5) * 40,
                y: f.y + (rng() - 0.5) * 40,
                vx: (rng() - 0.5) * 4,
                vy: -rng() * 4 - 1,
                color: '#22c55e',
                radius: rng() * 4 + 2,
                alpha: 1,
              });
            }
          } else if (ab.type === 'freeze') {
            nearestOpp.frozenTimer = Math.round((ab.power_value || 2.5) * 30);
            soundEvents.push({ frame, sound: 'ability', abilityType: 'freeze', volume: 1.0 });

            floatingTexts.push({
              id: `ab_frz_${frame}_${nearestOpp.id}`,
              x: nearestOpp.x,
              y: nearestOpp.y - 40,
              text: `❄️ FROZEN! (${ab.power_value}s)`,
              color: '#38bdf8',
              alpha: 1,
              vy: -2,
              scale: 1.25,
            });

            for (let k = 0; k < 12; k++) {
              particles.push({
                x: nearestOpp.x + (rng() - 0.5) * 45,
                y: nearestOpp.y + (rng() - 0.5) * 45,
                vx: (rng() - 0.5) * 4,
                vy: (rng() - 0.5) * 4,
                color: '#38bdf8',
                radius: rng() * 4 + 3,
                alpha: 1,
              });
            }
          } else if (ab.type === 'speed') {
            f.speedBoostTimer = Math.round((ab.power_value || 2.8) * 30);
            soundEvents.push({ frame, sound: 'ability', abilityType: 'speed', volume: 0.9 });

            floatingTexts.push({
              id: `ab_spd_${frame}_${f.id}`,
              x: f.x,
              y: f.y - 40,
              text: `⚡ XLR8 TURBO!`,
              color: '#00ff66',
              alpha: 1,
              vy: -2.5,
              scale: 1.35,
            });
          }
        }
      });
    }

    // Move Spherical Balls & 4-Wall Bounces inside ARENA_BOX
    aliveFighters.forEach((f) => {
      if (f.invulnerableTimer > 0) f.invulnerableTimer--;
      if (f.hitFlash > 0) f.hitFlash--;

      if (f.frozenTimer > 0) {
        // Frozen: ball cannot move or roll
        return;
      }

      if (f.daggerActivated && f.daggerTimer > 0) {
        f.daggerTimer--;
        if (f.daggerTimer <= 0) {
          f.hasDagger = false;
          f.daggerActivated = false;
        }
      }

      if (f.speedBoostTimer > 0) f.speedBoostTimer--;

      const spdMult = f.speedBoostTimer > 0 ? 1.6 : 1.0;
      f.x += f.vx * spdMult;
      f.y += f.vy * spdMult;

      // Ball rolling rotation angle
      const rollSpeed = Math.hypot(f.vx, f.vy) / (f.size / 2);
      f.angle = (f.angle || 0) + (f.vx >= 0 ? rollSpeed : -rollSpeed) * 0.4;

      const r = f.size / 2;
      let bounced = false;

      // Left Wall Bounce
      if (f.x - r <= ARENA_BOX.left) {
        f.x = ARENA_BOX.left + r;
        f.vx = Math.abs(f.vx) * 1.02;
        bounced = true;
        for (let k = 0; k < 4; k++) {
          particles.push({
            x: ARENA_BOX.left,
            y: f.y + (rng() - 0.5) * 30,
            vx: rng() * 4 + 2,
            vy: (rng() - 0.5) * 4,
            color: '#00ff66',
            radius: rng() * 3 + 2,
            alpha: 1,
          });
        }
      }
      // Right Wall Bounce
      else if (f.x + r >= ARENA_BOX.right) {
        f.x = ARENA_BOX.right - r;
        f.vx = -Math.abs(f.vx) * 1.02;
        bounced = true;
        for (let k = 0; k < 4; k++) {
          particles.push({
            x: ARENA_BOX.right,
            y: f.y + (rng() - 0.5) * 30,
            vx: -rng() * 4 - 2,
            vy: (rng() - 0.5) * 4,
            color: '#00ff66',
            radius: rng() * 3 + 2,
            alpha: 1,
          });
        }
      }

      // Top Wall Bounce
      if (f.y - r <= ARENA_BOX.top) {
        f.y = ARENA_BOX.top + r;
        f.vy = Math.abs(f.vy) * 1.02;
        bounced = true;
        for (let k = 0; k < 4; k++) {
          particles.push({
            x: f.x + (rng() - 0.5) * 30,
            y: ARENA_BOX.top,
            vx: (rng() - 0.5) * 4,
            vy: rng() * 4 + 2,
            color: '#00ff66',
            radius: rng() * 3 + 2,
            alpha: 1,
          });
        }
      }
      // Bottom Wall Bounce
      else if (f.y + r >= ARENA_BOX.bottom) {
        f.y = ARENA_BOX.bottom - r;
        f.vy = -Math.abs(f.vy) * 1.02;
        bounced = true;
        for (let k = 0; k < 4; k++) {
          particles.push({
            x: f.x + (rng() - 0.5) * 30,
            y: ARENA_BOX.bottom,
            vx: (rng() - 0.5) * 4,
            vy: -rng() * 4 - 2,
            color: '#00ff66',
            radius: rng() * 3 + 2,
            alpha: 1,
          });
        }
      }

      if (bounced) {
        // Wall bounce charges energy gauge (+5%)
        f.energyCharge = Math.min(100, (f.energyCharge || 0) + 5);
        if (frame - lastBounceFrame > 2) {
          soundEvents.push({ frame, sound: 'bounce', volume: 0.5 });
          lastBounceFrame = frame;
        }
      }

      // Gun firing: Aim directly at nearest living opponent
      if (f.gunBullets > 0 && rng() < 0.08) {
        let nearestTarget: SimFighter | null = null;
        let nearestDist = Infinity;
        for (const opp of aliveFighters) {
          if (opp.id === f.id) continue;
          const d = Math.hypot(opp.x - f.x, opp.y - f.y);
          if (d < nearestDist) {
            nearestDist = d;
            nearestTarget = opp;
          }
        }

        if (nearestTarget) {
          f.gunBullets--;
          soundEvents.push({ frame, sound: 'gun', volume: 0.6 });

          const angleToOpp = Math.atan2(nearestTarget.y - f.y, nearestTarget.x - f.x);
          const bulletSpeed = 22;
          bullets.push({
            x: f.x + Math.cos(angleToOpp) * (f.size / 2 + 15),
            y: f.y + Math.sin(angleToOpp) * (f.size / 2 + 15),
            vx: Math.cos(angleToOpp) * bulletSpeed,
            vy: Math.sin(angleToOpp) * bulletSpeed,
            ownerId: f.id,
            color: '#00ff66',
            damage: 12,
            life: 80,
          });

          for (let k = 0; k < 4; k++) {
            particles.push({
              x: f.x + Math.cos(angleToOpp) * (f.size / 2 + 10),
              y: f.y + Math.sin(angleToOpp) * (f.size / 2 + 10),
              vx: Math.cos(angleToOpp + (rng() - 0.5)) * (rng() * 4 + 2),
              vy: Math.sin(angleToOpp + (rng() - 0.5)) * (rng() * 4 + 2),
              color: '#00ff66',
              radius: rng() * 3 + 2,
              alpha: 1,
            });
          }
        }
      }
    });

    // Item Pickup
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      for (const f of aliveFighters) {
        const d = Math.hypot(f.x - it.x, f.y - it.y);
        if (d < f.size / 2 + 25) {
          soundEvents.push({ frame, sound: 'item', volume: 0.8 });

          if (it.type === 'health') {
            f.health = Math.min(f.maxHealth, f.health + 30);
            floatingTexts.push({ id: `ft_${frame}_${i}`, x: f.x, y: f.y - 50, text: '+30 HP', color: '#22c55e', alpha: 1, vy: -2.5, scale: 1.3 });
          } else if (it.type === 'dagger') {
            f.hasDagger = true;
            f.daggerActivated = false;
            f.daggerTimer = 90;
            floatingTexts.push({ id: `ft_${frame}_${i}`, x: f.x, y: f.y - 50, text: '🗡️ 2X DMG', color: '#f59e0b', alpha: 1, vy: -2.5, scale: 1.2 });
          } else if (it.type === 'gun') {
            f.gunBullets = 5;
            floatingTexts.push({ id: `ft_${frame}_${i}`, x: f.x, y: f.y - 50, text: '🔫 5 SHOTS', color: '#38bdf8', alpha: 1, vy: -2.5, scale: 1.2 });
          } else if (it.type === 'shield') {
            f.hasShield = true;
            floatingTexts.push({ id: `ft_${frame}_${i}`, x: f.x, y: f.y - 50, text: '🛡️ SHIELD', color: '#a855f7', alpha: 1, vy: -2.5, scale: 1.2 });
          } else if (it.type === 'speed') {
            f.speedBoostTimer = 120;
            floatingTexts.push({ id: `ft_${frame}_${i}`, x: f.x, y: f.y - 50, text: '⚡ SPEED', color: '#eab308', alpha: 1, vy: -2.5, scale: 1.2 });
          }

          items.splice(i, 1);
          nextItemSpawnCooldown = 240;
          break;
        }
      }
    }

    // Bullets Hit & Square Arena Boundary
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;

      if (
        b.x <= ARENA_BOX.left ||
        b.x >= ARENA_BOX.right ||
        b.y <= ARENA_BOX.top ||
        b.y >= ARENA_BOX.bottom ||
        b.life <= 0
      ) {
        bullets.splice(i, 1);
        continue;
      }

      for (const t of aliveFighters) {
        if (t.id === b.ownerId) continue;
        if (Math.hypot(t.x - b.x, t.y - b.y) < t.size / 2) {
          t.health = Math.max(0, t.health - b.damage);
          t.hitFlash = 10;
          soundEvents.push({ frame, sound: 'hit', volume: 0.6 });
          floatingTexts.push({ id: `b_${frame}_${i}`, x: t.x, y: t.y - 35, text: `-${b.damage}`, color: '#38bdf8', alpha: 1, vy: -2, scale: 1 });

          if (t.health <= 0 && !t.isDead) {
            t.isDead = true;
            soundEvents.push({ frame, sound: 'explosion', volume: 0.9 });
          }
          bullets.splice(i, 1);
          break;
        }
      }
    }

    // Fighter to Fighter Clash (Proportional distance: (A.size + B.size) / 2)
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

            if (frame - lastHitFrame > 2) {
              soundEvents.push({ frame, sound: 'hit', volume: 0.8 });
              lastHitFrame = frame;
            }

            // Both balls gain +15% Omnitrix energy on impact and increment hit combo
            A.energyCharge = Math.min(100, (A.energyCharge || 0) + 15);
            B.energyCharge = Math.min(100, (B.energyCharge || 0) + 15);
            A.hitCombo = (A.hitCombo || 0) + 1;
            B.hitCombo = (B.hitCombo || 0) + 1;

            let dmgA = A.damage;
            if (isOvertime) dmgA *= 2;
            if (A.hasDagger) { dmgA *= 2; A.daggerActivated = true; }
            if (A.specialPower === 'berserker' && A.health / A.maxHealth <= 0.2) dmgA *= 2;

            // Check B shield
            if (B.bonusShield > 0) {
              const absorbed = Math.min(B.bonusShield, dmgA);
              B.bonusShield -= absorbed;
              dmgA -= absorbed;
              floatingTexts.push({ id: `shdA_${frame}`, x: B.x, y: B.y - 30, text: `SHIELD -${absorbed}`, color: '#a855f7', alpha: 1, vy: -2, scale: 1 });
            } else if (B.hasShield) {
              dmgA = 0;
              B.hasShield = false;
            } else if (B.specialPower === 'iron_shield' && B.health / B.maxHealth <= 0.5) {
              dmgA = Math.round(dmgA * 0.5);
            }

            let dmgB = B.damage;
            if (isOvertime) dmgB *= 2;
            if (B.hasDagger) { dmgB *= 2; B.daggerActivated = true; }
            if (B.specialPower === 'berserker' && B.health / B.maxHealth <= 0.2) dmgB *= 2;

            // Check A shield
            if (A.bonusShield > 0) {
              const absorbed = Math.min(A.bonusShield, dmgB);
              A.bonusShield -= absorbed;
              dmgB -= absorbed;
              floatingTexts.push({ id: `shdB_${frame}`, x: A.x, y: A.y - 30, text: `SHIELD -${absorbed}`, color: '#a855f7', alpha: 1, vy: -2, scale: 1 });
            } else if (A.hasShield) {
              dmgB = 0;
              A.hasShield = false;
            } else if (A.specialPower === 'iron_shield' && A.health / A.maxHealth <= 0.5) {
              dmgB = Math.round(dmgB * 0.5);
            }

            // Apply Damage
            if (dmgA > 0) {
              B.health = Math.max(0, B.health - dmgA);
              floatingTexts.push({ id: `hit_${frame}_${B.id}`, x: B.x, y: B.y - 35, text: `-${dmgA}`, color: '#f87171', alpha: 1, vy: -2, scale: 1.15 });

              if (A.specialPower === 'vampiric') {
                const leech = Math.round(dmgA * 0.2);
                A.health = Math.min(A.maxHealth, A.health + leech);
                floatingTexts.push({ id: `vamp_${frame}_${A.id}`, x: A.x, y: A.y - 45, text: `+${leech} 🩸`, color: '#ef4444', alpha: 1, vy: -2.5, scale: 1 });
              }
              if (B.specialPower === 'thorns') {
                const recoil = Math.round(dmgA * 0.3);
                A.health = Math.max(0, A.health - recoil);
                floatingTexts.push({ id: `thorn_${frame}_${A.id}`, x: A.x, y: A.y - 35, text: `-${recoil} 🌵`, color: '#eab308', alpha: 1, vy: -2, scale: 1 });
              }
            }

            if (dmgB > 0) {
              A.health = Math.max(0, A.health - dmgB);
              floatingTexts.push({ id: `hit_${frame}_${A.id}`, x: A.x, y: A.y - 35, text: `-${dmgB}`, color: '#f87171', alpha: 1, vy: -2, scale: 1.15 });

              if (B.specialPower === 'vampiric') {
                const leech = Math.round(dmgB * 0.2);
                B.health = Math.min(B.maxHealth, B.health + leech);
                floatingTexts.push({ id: `vamp_${frame}_${B.id}`, x: B.x, y: B.y - 45, text: `+${leech} 🩸`, color: '#ef4444', alpha: 1, vy: -2.5, scale: 1 });
              }
              if (A.specialPower === 'thorns') {
                const recoil = Math.round(dmgB * 0.3);
                B.health = Math.max(0, B.health - recoil);
                floatingTexts.push({ id: `thorn_${frame}_${B.id}`, x: B.x, y: B.y - 35, text: `-${recoil} 🌵`, color: '#eab308', alpha: 1, vy: -2, scale: 1 });
              }
            }

            // Phoenix Rebirth
            if (A.health <= 0 && A.specialPower === 'phoenix' && !A.phoenixUsed) {
              A.phoenixUsed = true;
              A.health = 20;
              floatingTexts.push({ id: `phx_${frame}_${A.id}`, x: A.x, y: A.y - 50, text: '🦅 REBIRTH!', color: '#f59e0b', alpha: 1, vy: -3, scale: 1.3 });
            }
            if (B.health <= 0 && B.specialPower === 'phoenix' && !B.phoenixUsed) {
              B.phoenixUsed = true;
              B.health = 20;
              floatingTexts.push({ id: `phx_${frame}_${B.id}`, x: B.x, y: B.y - 50, text: '🦅 REBIRTH!', color: '#f59e0b', alpha: 1, vy: -3, scale: 1.3 });
            }

            // Check eliminations
            if (A.health <= 0 && !A.isDead) {
              A.isDead = true;
              soundEvents.push({ frame, sound: 'explosion', volume: 1.0 });
            }
            if (B.health <= 0 && !B.isDead) {
              B.isDead = true;
              soundEvents.push({ frame, sound: 'explosion', volume: 1.0 });
            }

            // Sparks
            const midX = (A.x + B.x) / 2;
            const midY = (A.y + B.y) / 2;
            for (let k = 0; k < 8; k++) {
              particles.push({
                x: midX,
                y: midY,
                vx: (rng() - 0.5) * 6,
                vy: (rng() - 0.5) * 6,
                color: '#facc15',
                radius: rng() * 4 + 2,
                alpha: 1,
              });
            }
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

    // Snapshot frame
    frames.push({
      fighters: fighters.map((f) => ({ ...f })),
      items: items.map((it) => ({ ...it })),
      bullets: bullets.map((b) => ({ ...b })),
      floatingTexts: floatingTexts.map((ft) => ({ ...ft })),
      particles: particles.map((p) => ({ ...p })),
      winner: winner ? { ...winner } : null,
      aliveCount: aliveFighters.length,
      isOvertime,
    });
  }

  const finalSeconds = Math.max(15, Math.ceil(frames.length / 30));
  const targetFrameCount = finalSeconds * 30;

  // Pad final victory frames so all frames up to targetFrameCount are valid
  while (frames.length < targetFrameCount && frames.length > 0) {
    const lastFrame = frames[frames.length - 1];
    frames.push({
      ...lastFrame,
      particles: [],
      floatingTexts: [],
    });
  }

  return {
    frames,
    soundEvents,
    totalFrames: targetFrameCount,
    totalSeconds: finalSeconds,
    winner,
  };
}
