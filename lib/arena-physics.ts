// Deterministic 2D Physics Simulator for Ben 10 Square Arena Ball Battle

export type AlienType =
  | 'heatblast'
  | 'four_arms'
  | 'xlr8'
  | 'diamondhead'
  | 'cannonbolt'
  | 'wildmutt'
  | 'ripjaws'
  | 'upgrade'
  | 'ghostfreak'
  | 'grey_matter'
  | 'stinkfly'
  | 'normal';

export function getAlienType(f?: { id?: string; name?: string; special_power?: string; specialPower?: string } | null): AlienType {
  if (!f) return 'normal';
  const str = `${f.id || ''} ${f.name || ''} ${f.special_power || ''} ${f.specialPower || ''}`.toLowerCase().replace(/[\s_-]+/g, '');
  if (str.includes('heatblast') || str.includes('fire')) return 'heatblast';
  if (str.includes('fourarms') || str.includes('four_arms')) return 'four_arms';
  if (str.includes('xlr8') || str.includes('speedster')) return 'xlr8';
  if (str.includes('diamondhead') || str.includes('diamond')) return 'diamondhead';
  if (str.includes('cannonbolt') || str.includes('cannon')) return 'cannonbolt';
  if (str.includes('wildmutt')) return 'wildmutt';
  if (str.includes('ripjaws') || str.includes('ripjaw')) return 'ripjaws';
  if (str.includes('upgrade')) return 'upgrade';
  if (str.includes('ghostfreak') || str.includes('ghost')) return 'ghostfreak';
  if (str.includes('greymatter') || str.includes('graymatter') || str.includes('galvan')) return 'grey_matter';
  if (str.includes('stinkfly') || str.includes('stink')) return 'stinkfly';
  return 'normal';
}

export interface SpecialAbility {
  name: string;             // e.g., "Sonic Clap", "Supernova Inferno"
  icon: string;             // Clean text label (no emojis)
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
  bulletType?: 'shockwave' | 'fireball' | 'laser' | 'beam' | 'shard' | 'acid' | 'normal';
  size?: number;
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
  isSelectionIntro?: boolean;
  selectionDialScale?: number;
  selectedAlienName?: string;
  selectedAlienColor?: string;
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
  top: 380,
  right: 990,
  bottom: 1280,
  width: 900,
  height: 900,
};
export const ARENA_RADIUS = 450; // Kept for backwards compatibility
export const ARENA_CENTER = { x: 540, y: 830 };
export const BOX_SIZE = 120; // Default fallback for backwards compatibility

// Authentic Ben 10 Alien Presets & Abilities
export const BEN10_DEFAULT_ABILITIES: Record<string, SpecialAbility> = {
  four_arms: {
    name: 'Sonic Shockwave',
    icon: 'SONIC CLAP',
    type: 'damage',
    cooldown_seconds: 5,
    power_value: 30,
    trigger_type: 'charge',
    trigger_value: 100,
    weapon_type: 'none',
    description: 'Claps four muscular hands to unleash a devastating physical shockwave!',
  },
  heatblast: {
    name: 'Fire Wave Dash',
    icon: 'FIRE WAVE',
    type: 'damage',
    cooldown_seconds: 5,
    power_value: 28,
    trigger_type: 'charge',
    trigger_value: 100,
    weapon_type: 'none',
    description: 'Propels forward on a wave of heat and fire, dealing burning impact damage!',
  },
  xlr8: {
    name: 'Wind Funnel',
    icon: 'WIND FUNNEL',
    type: 'speed',
    cooldown_seconds: 4,
    power_value: 2.5,
    trigger_type: 'charge',
    trigger_value: 100,
    weapon_type: 'none',
    description: 'Spins at ultra speed generating a wind tornado that flings opponents outward!',
  },
  diamondhead: {
    name: 'Crystal Wall Eruption',
    icon: 'CRYSTAL WALL',
    type: 'shield',
    cooldown_seconds: 6,
    power_value: 45,
    trigger_type: 'charge',
    trigger_value: 100,
    weapon_type: 'none',
    description: 'Erupts impenetrable Taydenite crystal armor reflecting incoming damage!',
  },
  cannonbolt: {
    name: 'Armored Roll Slam',
    icon: 'ARMORED ROLL',
    type: 'damage',
    cooldown_seconds: 5,
    power_value: 32,
    trigger_type: 'charge',
    trigger_value: 100,
    weapon_type: 'none',
    description: 'Tucks into an invulnerable sphere, rebounding off walls with crushing kinetic force!',
  },
  wildmutt: {
    name: 'Predator Sense Pounce',
    icon: 'PREDATOR POUNCE',
    type: 'damage',
    cooldown_seconds: 5,
    power_value: 26,
    trigger_type: 'charge',
    trigger_value: 100,
    weapon_type: 'none',
    description: 'Uses sensory neck gills to lock-on, lunging into a steel-crushing bite and drool slow!',
  },
  ripjaws: {
    name: 'Steel Jaw Bite',
    icon: 'STEEL BITE',
    type: 'damage',
    cooldown_seconds: 5,
    power_value: 36,
    trigger_type: 'hit_combo',
    trigger_value: 4,
    weapon_type: 'none',
    description: 'Snaps giant steel-piercing jaws on collision, shredding shields and dealing critical damage!',
  },
  upgrade: {
    name: 'Optic Plasma Laser',
    icon: 'PLASMA BEAM',
    type: 'damage',
    cooldown_seconds: 5,
    power_value: 26,
    trigger_type: 'charge',
    trigger_value: 100,
    weapon_type: 'none',
    description: 'Fires an optic plasma laser beam and upgrades combat stats on wall rebound!',
  },
  ghostfreak: {
    name: 'Intangible Phase',
    icon: 'INTANGIBLE',
    type: 'freeze',
    cooldown_seconds: 7,
    power_value: 2.5,
    trigger_type: 'hp_threshold',
    trigger_value: 50,
    weapon_type: 'none',
    description: 'Becomes intangible to physical attacks and haunts passing opponents with confusion!',
  },
  grey_matter: {
    name: 'Sun Gun Beam',
    icon: 'SUN GUN',
    type: 'damage',
    cooldown_seconds: 5,
    power_value: 30,
    trigger_type: 'charge',
    trigger_value: 100,
    weapon_type: 'none',
    description: 'Galvan genius fires a concentrated solar laser beam from an engineered device!',
  },
  stinkfly: {
    name: 'Acid Goop Spray',
    icon: 'ACID GOOP',
    type: 'damage',
    cooldown_seconds: 5,
    power_value: 22,
    trigger_type: 'charge',
    trigger_value: 100,
    weapon_type: 'none',
    description: 'Sprays sticky corrosive acid slime that slows down enemy balls and corrodes armor!',
  },
  // Generic fallbacks
  iron_shield: { name: 'Iron Bastion', icon: 'IRON SHIELD', type: 'shield', cooldown_seconds: 6, power_value: 40, trigger_type: 'charge', trigger_value: 100 },
  berserker: { name: 'Berserk Strike', icon: 'BERSERK STRIKE', type: 'damage', cooldown_seconds: 5, power_value: 35, trigger_type: 'hp_threshold', trigger_value: 30 },
  vampiric: { name: 'Life Drain', icon: 'LIFE DRAIN', type: 'heal', cooldown_seconds: 6, power_value: 25, trigger_type: 'charge', trigger_value: 100 },
  thorns: { name: 'Spike Burst', icon: 'SPIKE BURST', type: 'damage', cooldown_seconds: 5, power_value: 30, trigger_type: 'charge', trigger_value: 100 },
  speedster: { name: 'Flash Dash', icon: 'FLASH DASH', type: 'speed', cooldown_seconds: 4, power_value: 2, trigger_type: 'charge', trigger_value: 100 },
  phoenix: { name: 'Holy Heal', icon: 'HOLY HEAL', type: 'heal', cooldown_seconds: 7, power_value: 35, trigger_type: 'hp_threshold', trigger_value: 35 },
  freeze: { name: 'Frost Freeze', icon: 'FROST FREEZE', type: 'freeze', cooldown_seconds: 7, power_value: 2.2, trigger_type: 'charge', trigger_value: 100 },
  none: { name: 'Omnitrix Blast', icon: 'OMNITRIX BLAST', type: 'damage', cooldown_seconds: 5, power_value: 30, trigger_type: 'charge', trigger_value: 100 },
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
    let x = ARENA_CENTER.x + Math.cos(angle) * spawnRadius;
    let y = ARENA_CENTER.y + Math.sin(angle) * spawnRadius;

    const alienType = getAlienType(c);
    let baseSpd = c.speed || 6.8;
    if (alienType === 'xlr8') {
      baseSpd = 14.0; // Always noticeably and significantly faster than other balls
    } else if (c.special_power === 'speedster') {
      baseSpd *= 1.35;
    }

    const moveAngle = angle + Math.PI + (rng() - 0.5) * 0.7;
    let vx = Math.cos(moveAngle) * baseSpd;
    let vy = Math.sin(moveAngle) * baseSpd;

    if (count === 2) {
      x = idx === 0 ? ARENA_CENTER.x - 220 : ARENA_CENTER.x + 220;
      y = ARENA_CENTER.y;
      vx = idx === 0 ? Math.abs(baseSpd) * 0.9 : -Math.abs(baseSpd) * 0.9;
      vy = (rng() - 0.5) * baseSpd * 0.6;
    }

    // Resolve Special Ability
    const ability: SpecialAbility = c.special_ability ||
      BEN10_DEFAULT_ABILITIES[alienType] ||
      BEN10_DEFAULT_ABILITIES[c.special_power || 'none'] ||
      BEN10_DEFAULT_ABILITIES['four_arms'] || {
        name: 'Omnitrix Blast',
        icon: 'OMNITRIX BLAST',
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
      damage: c.damage && c.damage > 0 ? c.damage : 25,
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
    { type: 'health', icon: 'HP', name: '+30 HP Medkit', color: '#22c55e' },
    { type: 'dagger', icon: 'DMG', name: '2x DMG Dagger', color: '#f59e0b' },
    { type: 'gun', icon: 'GUN', name: 'Blaster (5 Shots)', color: '#38bdf8' },
    { type: 'shield', icon: 'SHIELD', name: 'Energy Shield', color: '#a855f7' },
    { type: 'speed', icon: 'SPEED', name: 'Hyper Speed', color: '#eab308' },
  ];

  // Interactive selection is handled on screen before battle, so physics simulation starts immediately at frame 0
  const SELECTION_INTRO_FRAMES = 0;

  for (let frame = 0; frame < maxFrames; frame++) {
    const aliveFighters = fighters.filter((f) => !f.isDead);
    const isSelectionIntro = frame < SELECTION_INTRO_FRAMES;
    let selectionDialScale = 1.0;
    let selectedAlienName = '';
    let selectedAlienColor = '#00ff66';
    const isOvertime = !isSelectionIntro && frame >= 1050 && aliveFighters.length > 1;

    if (isSelectionIntro) {
      if (frame === 0) {
        soundEvents.push({ frame: 0, sound: 'ability', abilityType: 'speed', volume: 0.8 });
      }

      // 1. Dial Scale Expansion & Slam-down
      if (frame < 18) {
        // Zoom in from 1.0 to 2.14
        const p = frame / 18;
        selectionDialScale = 1.0 + (1 - Math.pow(1 - p, 3)) * 1.14;
      } else if (frame < 72) {
        // Hold large during alien dial cycling
        selectionDialScale = 2.14;
      } else if (frame < 85) {
        // Slam down rapidly back to 1.0
        const p = (frame - 72) / 13;
        selectionDialScale = 2.14 - Math.pow(p, 2) * 1.14;
      } else {
        // Flush with floor
        selectionDialScale = 1.0;
      }

      // 2. Selection cycle text & sound: clean without emoji, only It's Hero Time! at the end
      selectedAlienName = '';
      if (frame >= 85) {
        selectedAlienName = "It's Hero Time!";
        selectedAlienColor = '#00ff66';
      }

      // Slam down impact at frame 85: Shockwave particle burst + slam sound!
      if (frame === 85) {
        soundEvents.push({ frame: 85, sound: 'hit', volume: 1.0 });
        for (let pIdx = 0; pIdx < 28; pIdx++) {
          const pAngle = (pIdx / 28) * Math.PI * 2;
          const pSpeed = 6 + rng() * 9;
          particles.push({
            x: ARENA_CENTER.x,
            y: ARENA_CENTER.y,
            vx: Math.cos(pAngle) * pSpeed,
            vy: Math.sin(pAngle) * pSpeed,
            color: pIdx % 2 === 0 ? '#00ff66' : '#ffffff',
            radius: 4 + rng() * 5,
            alpha: 1,
          });
        }
        floatingTexts.push({
          id: 'hero_time_text',
          x: ARENA_CENTER.x,
          y: ARENA_CENTER.y - 150,
          text: "It's Hero Time!",
          color: '#00ff66',
          alpha: 1,
          vy: -1.2,
          scale: 1.8,
        });
      }
    } else {
      // Sudden death / overtime after 35s (frame 1050) if match is still ongoing
      if (isOvertime && !announcedOvertime) {
        announcedOvertime = true;
        floatingTexts.push({
          id: `overtime_${frame}`,
          x: ARENA_CENTER.x,
          y: ARENA_CENTER.y - 120,
          text: 'OVERTIME: 2X DAMAGE!',
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

      // Random item spawner is disabled per user request: No random items will spawn.
      // items array remains empty throughout the battle.

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

          // Special Move Announcement Banner (NO EMOJIS)
          floatingTexts.push({
            id: `ab_banner_${frame}_${f.id}`,
            x: f.x,
            y: f.y - (f.size / 2 + 35),
            text: `${f.name.toUpperCase()}: ${ab.name.toUpperCase()}!`,
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

          // Execute Alien-Specific Signature Move (PHYSICAL ONLY - NO REMOTE INVISIBLE DAMAGE)
          const aType = getAlienType(f);
          const targetAngle = Math.atan2(nearestOpp.y - f.y, nearestOpp.x - f.x);
          const abilityPower = f.specialAbility?.power_value || Math.round(f.damage * 1.1) || 30;

          if (aType === 'four_arms') {
            // FOUR ARMS: SONIC SHOCKWAVE CLAP!
            // Fires an expanding sonic shockwave blast toward the enemy and emits a massive shockwave ring
            soundEvents.push({ frame, sound: 'ability', abilityType: 'damage', volume: 1.0 });
            f.abilityAuraTimer = 60;
            f.abilityAuraColor = '#dc2626';

            // Giant sonic shockwave projectile flying toward the opponent
            bullets.push({
              x: f.x + Math.cos(targetAngle) * (f.size / 2 + 20),
              y: f.y + Math.sin(targetAngle) * (f.size / 2 + 20),
              vx: Math.cos(targetAngle) * 19,
              vy: Math.sin(targetAngle) * 19,
              ownerId: f.id,
              color: '#dc2626',
              damage: Math.round(abilityPower),
              life: 55,
              bulletType: 'shockwave',
              size: 44,
            });

            // Expanding sonic shockwave dust & distortion particles
            for (let k = 0; k < 24; k++) {
              const ang = (k / 24) * Math.PI * 2;
              particles.push({
                x: f.x + Math.cos(ang) * (f.size / 2 + 10),
                y: f.y + Math.sin(ang) * (f.size / 2 + 10),
                vx: Math.cos(ang) * 14,
                vy: Math.sin(ang) * 14,
                color: k % 2 === 0 ? '#dc2626' : '#ffffff',
                radius: rng() * 4 + 3,
                alpha: 1,
              });
            }
          } else if (aType === 'heatblast') {
            // HEATBLAST: BLAZING PYRONITE FLAMETHROWER & FIREBALL BURST!
            // Fires 3 giant blazing fireballs in a spread towards enemy
            soundEvents.push({ frame, sound: 'ability', abilityType: 'damage', volume: 1.0 });
            f.abilityAuraTimer = 75;
            f.abilityAuraColor = '#ea580c';
            f.vx = Math.cos(targetAngle) * 14;
            f.vy = Math.sin(targetAngle) * 14;

            for (const spread of [-0.18, 0, 0.18]) {
              bullets.push({
                x: f.x + Math.cos(targetAngle + spread) * (f.size / 2 + 18),
                y: f.y + Math.sin(targetAngle + spread) * (f.size / 2 + 18),
                vx: Math.cos(targetAngle + spread) * 19,
                vy: Math.sin(targetAngle + spread) * 19,
                ownerId: f.id,
                color: '#ea580c',
                damage: Math.max(5, Math.round(abilityPower / 3)),
                life: 60,
                bulletType: 'fireball',
                size: 28,
              });
            }

            for (let k = 0; k < 20; k++) {
              particles.push({
                x: f.x + (rng() - 0.5) * f.size,
                y: f.y + (rng() - 0.5) * f.size,
                vx: Math.cos(targetAngle + (rng() - 0.5) * 0.8) * (rng() * 10 + 6),
                vy: Math.sin(targetAngle + (rng() - 0.5) * 0.8) * (rng() * 10 + 6),
                color: rng() > 0.5 ? '#ea580c' : '#facc15',
                radius: rng() * 6 + 3,
                alpha: 1,
              });
            }
          } else if (aType === 'xlr8') {
            // XLR8: HYPERSPEED CYCLONE TORNADO!
            // Dashes at extreme speed, spins a whirlwind around himself
            f.speedBoostTimer = 110;
            f.abilityAuraTimer = 110;
            f.abilityAuraColor = '#0284c7';
            f.vx = Math.cos(targetAngle) * 22;
            f.vy = Math.sin(targetAngle) * 22;
            soundEvents.push({ frame, sound: 'ability', abilityType: 'speed', volume: 1.0 });

            for (let k = 0; k < 18; k++) {
              const ang = (k / 18) * Math.PI * 2;
              particles.push({
                x: f.x + Math.cos(ang) * (f.size / 2 + 15),
                y: f.y + Math.sin(ang) * (f.size / 2 + 15),
                vx: Math.cos(ang + Math.PI / 2) * 14,
                vy: Math.sin(ang + Math.PI / 2) * 14,
                color: '#38bdf8',
                radius: rng() * 4 + 2,
                alpha: 1,
              });
            }
          } else if (aType === 'diamondhead') {
            // DIAMONDHEAD: CRYSTAL DIAMOND SHARD VOLLEY & PRISM BARRIER
            f.bonusShield = Math.round(abilityPower * 1.5) || 50;
            f.abilityAuraTimer = 85;
            f.abilityAuraColor = '#10b981';
            soundEvents.push({ frame, sound: 'ability', abilityType: 'shield', volume: 0.9 });
            floatingTexts.push({ id: `shd_${frame}_${f.id}`, x: f.x, y: f.y - 40, text: `CRYSTAL BARRIER +${f.bonusShield}`, color: '#10b981', alpha: 1, vy: -2.2, scale: 1.25 });

            // Volley of 4 sharp emerald crystal shards aimed at enemy
            for (let s = -1.5; s <= 1.5; s += 1.0) {
              const sp = s * 0.12;
              bullets.push({
                x: f.x + Math.cos(targetAngle + sp) * (f.size / 2 + 16),
                y: f.y + Math.sin(targetAngle + sp) * (f.size / 2 + 16),
                vx: Math.cos(targetAngle + sp) * 21,
                vy: Math.sin(targetAngle + sp) * 21,
                ownerId: f.id,
                color: '#10b981',
                damage: Math.max(3, Math.round(abilityPower / 4)),
                life: 55,
                bulletType: 'shard',
                size: 24,
              });
            }
          } else if (aType === 'cannonbolt') {
            // CANNONBOLT: HYPER ARMORED KINETIC WRECKING BALL
            f.invulnerableTimer = 80;
            f.abilityAuraTimer = 80;
            f.abilityAuraColor = '#f59e0b';
            f.vx = Math.cos(targetAngle) * 24;
            f.vy = Math.sin(targetAngle) * 24;
            soundEvents.push({ frame, sound: 'ability', abilityType: 'damage', volume: 1.0 });
          } else if (aType === 'wildmutt') {
            // WILDMUTT: PREDATOR SENSE POUNCE
            f.vx = Math.cos(targetAngle) * 21;
            f.vy = Math.sin(targetAngle) * 21;
            f.abilityAuraTimer = 70;
            f.abilityAuraColor = '#f97316';
            soundEvents.push({ frame, sound: 'ability', abilityType: 'damage', volume: 0.9 });
          } else if (aType === 'ripjaws') {
            // RIPJAWS: STEEL JAW BITE CHARGE
            f.vx = Math.cos(targetAngle) * 19;
            f.vy = Math.sin(targetAngle) * 19;
            f.abilityAuraTimer = 75;
            f.abilityAuraColor = '#06b6d4';
            soundEvents.push({ frame, sound: 'ability', abilityType: 'damage', volume: 1.0 });
          } else if (aType === 'upgrade') {
            // UPGRADE: OPTIC PLASMA LASER (Burst of 3 high-speed laser bolts)
            soundEvents.push({ frame, sound: 'gun', volume: 0.9 });
            f.abilityAuraTimer = 65;
            f.abilityAuraColor = '#22c55e';
            for (let k = 0; k < 3; k++) {
              bullets.push({
                x: f.x + Math.cos(targetAngle) * (f.size / 2 + 16 + k * 30),
                y: f.y + Math.sin(targetAngle) * (f.size / 2 + 16 + k * 30),
                vx: Math.cos(targetAngle) * 26,
                vy: Math.sin(targetAngle) * 26,
                ownerId: f.id,
                color: '#22c55e',
                damage: Math.max(4, Math.round(abilityPower / 3)),
                life: 50,
                bulletType: 'laser',
                size: 30,
              });
            }
          } else if (aType === 'grey_matter') {
            // GREY MATTER: SOLAR FOCUS DEATH RAY
            soundEvents.push({ frame, sound: 'gun', volume: 1.0 });
            f.abilityAuraTimer = 65;
            f.abilityAuraColor = '#facc15';
            bullets.push({
              x: f.x + Math.cos(targetAngle) * (f.size / 2 + 18),
              y: f.y + Math.sin(targetAngle) * (f.size / 2 + 18),
              vx: Math.cos(targetAngle) * 28,
              vy: Math.sin(targetAngle) * 28,
              ownerId: f.id,
              color: '#facc15',
              damage: Math.round(abilityPower),
              life: 50,
              bulletType: 'beam',
              size: 38,
            });
          } else if (aType === 'stinkfly') {
            // STINKFLY: TOXIC ACID GOOP SPRAY (3 Bubbling Slime Globs)
            soundEvents.push({ frame, sound: 'gun', volume: 0.85 });
            f.abilityAuraTimer = 70;
            f.abilityAuraColor = '#84cc16';
            for (const spread of [-0.22, 0, 0.22]) {
              bullets.push({
                x: f.x + Math.cos(targetAngle + spread) * (f.size / 2 + 16),
                y: f.y + Math.sin(targetAngle + spread) * (f.size / 2 + 16),
                vx: Math.cos(targetAngle + spread) * 16,
                vy: Math.sin(targetAngle + spread) * 16,
                ownerId: f.id,
                color: '#84cc16',
                damage: Math.max(3, Math.round(abilityPower / 3)),
                life: 55,
                bulletType: 'acid',
                size: 26,
              });
            }
          } else if (aType === 'ghostfreak') {
            // GHOSTFREAK: SPECTRAL INTANGIBILITY & CURSE WAVE
            f.invulnerableTimer = 85;
            f.abilityAuraTimer = 85;
            f.abilityAuraColor = '#cbd5e1';
            soundEvents.push({ frame, sound: 'ability', abilityType: 'freeze', volume: 0.9 });
            bullets.push({
              x: f.x + Math.cos(targetAngle) * (f.size / 2 + 18),
              y: f.y + Math.sin(targetAngle) * (f.size / 2 + 18),
              vx: Math.cos(targetAngle) * 15,
              vy: Math.sin(targetAngle) * 15,
              ownerId: f.id,
              color: '#a855f7',
              damage: Math.round(abilityPower * 0.7),
              life: 60,
              bulletType: 'shockwave',
              size: 38,
            });
          } else {
            // Generic Fallback
            f.abilityAuraTimer = 45;
            f.abilityAuraColor = f.color;
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

      const aType = getAlienType(f);
      if (aType === 'xlr8') {
        const curSpd = Math.hypot(f.vx, f.vy);
        const targetSpd = 14.0;
        if (curSpd < targetSpd && curSpd > 0.05) {
          f.vx = (f.vx / curSpd) * targetSpd;
          f.vy = (f.vy / curSpd) * targetSpd;
        }
      }

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
            floatingTexts.push({ id: `ft_${frame}_${i}`, x: f.x, y: f.y - 50, text: '2X DMG', color: '#f59e0b', alpha: 1, vy: -2.5, scale: 1.2 });
          } else if (it.type === 'gun') {
            f.gunBullets = 5;
            floatingTexts.push({ id: `ft_${frame}_${i}`, x: f.x, y: f.y - 50, text: '5 SHOTS', color: '#38bdf8', alpha: 1, vy: -2.5, scale: 1.2 });
          } else if (it.type === 'shield') {
            f.hasShield = true;
            floatingTexts.push({ id: `ft_${frame}_${i}`, x: f.x, y: f.y - 50, text: 'SHIELD', color: '#a855f7', alpha: 1, vy: -2.5, scale: 1.2 });
          } else if (it.type === 'speed') {
            f.speedBoostTimer = 120;
            floatingTexts.push({ id: `ft_${frame}_${i}`, x: f.x, y: f.y - 50, text: 'SPEED', color: '#eab308', alpha: 1, vy: -2.5, scale: 1.2 });
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
        if (t.invulnerableTimer > 0) continue; // Phased through intangible fighter!
        if (Math.hypot(t.x - b.x, t.y - b.y) < t.size / 2 + (b.size ? b.size / 3 : 5)) {
          t.health = Math.max(0, t.health - b.damage);
          t.hitFlash = 14;

          // Kinetic knockback in bullet's flight direction
          const bDist = Math.hypot(b.vx, b.vy) || 1;
          t.vx += (b.vx / bDist) * 8;
          t.vy += (b.vy / bDist) * 8;

          soundEvents.push({ frame, sound: 'hit', volume: 0.8 });
          floatingTexts.push({
            id: `b_${frame}_${i}`,
            x: t.x,
            y: t.y - 35,
            text: `-${b.damage}`,
            color: b.color || '#ef4444',
            alpha: 1,
            vy: -2.4,
            scale: 1.25,
          });

          // Impact explosion particles
          for (let k = 0; k < 12; k++) {
            particles.push({
              x: b.x,
              y: b.y,
              vx: (rng() - 0.5) * 12,
              vy: (rng() - 0.5) * 12,
              color: b.color,
              radius: rng() * 5 + 3,
              alpha: 1,
            });
          }

          if (t.health <= 0 && !t.isDead) {
            t.isDead = true;
            soundEvents.push({ frame, sound: 'explosion', volume: 1.0 });
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

            const aAlien = getAlienType(A);
            const bAlien = getAlienType(B);

            let dmgA = A.damage;
            let dmgB = B.damage;

            // Alien specific physical collision buffs
            if (A.abilityAuraTimer > 0) {
              if (aAlien === 'heatblast') {
                dmgA += Math.round(A.damage * 0.6) || 20; // Burning impact
                floatingTexts.push({ id: `fire_${frame}_${B.id}`, x: B.x, y: B.y - 45, text: 'FIRE BLAST!', color: '#ea580c', alpha: 1, vy: -2, scale: 1.1 });
              } else if (aAlien === 'cannonbolt') {
                dmgA += Math.round(A.damage * 0.75) || 25; // Armored kinetic impact
                B.vx += nx * 14; B.vy += ny * 14;
                floatingTexts.push({ id: `slam_${frame}_${B.id}`, x: B.x, y: B.y - 45, text: 'KINETIC SLAM!', color: '#f59e0b', alpha: 1, vy: -2, scale: 1.1 });
              } else if (aAlien === 'wildmutt') {
                dmgA += Math.round(A.damage * 0.6) || 20; // Steel bite
                B.speedBoostTimer = -45; // Slow down
                floatingTexts.push({ id: `bite_${frame}_${B.id}`, x: B.x, y: B.y - 45, text: 'STEEL BITE!', color: '#f97316', alpha: 1, vy: -2, scale: 1.1 });
              } else if (aAlien === 'ripjaws') {
                dmgA += Math.round(A.damage * 0.9) || 30; // Pierce jaws
                B.bonusShield = 0; B.hasShield = false; // shred shield
                floatingTexts.push({ id: `jaw_${frame}_${B.id}`, x: B.x, y: B.y - 45, text: 'PIERCE CRUSH!', color: '#06b6d4', alpha: 1, vy: -2, scale: 1.2 });
              }
            }

            if (B.abilityAuraTimer > 0) {
              if (bAlien === 'heatblast') {
                dmgB += Math.round(B.damage * 0.6) || 20;
                floatingTexts.push({ id: `fire_${frame}_${A.id}`, x: A.x, y: A.y - 45, text: 'FIRE BLAST!', color: '#ea580c', alpha: 1, vy: -2, scale: 1.1 });
              } else if (bAlien === 'cannonbolt') {
                dmgB += Math.round(B.damage * 0.75) || 25;
                A.vx -= nx * 14; A.vy -= ny * 14;
                floatingTexts.push({ id: `slam_${frame}_${A.id}`, x: A.x, y: A.y - 45, text: 'KINETIC SLAM!', color: '#f59e0b', alpha: 1, vy: -2, scale: 1.1 });
              } else if (bAlien === 'wildmutt') {
                dmgB += Math.round(B.damage * 0.6) || 20;
                A.speedBoostTimer = -45;
                floatingTexts.push({ id: `bite_${frame}_${A.id}`, x: A.x, y: A.y - 45, text: 'STEEL BITE!', color: '#f97316', alpha: 1, vy: -2, scale: 1.1 });
              } else if (bAlien === 'ripjaws') {
                dmgB += Math.round(B.damage * 0.9) || 30;
                A.bonusShield = 0; A.hasShield = false;
                floatingTexts.push({ id: `jaw_${frame}_${A.id}`, x: A.x, y: A.y - 45, text: 'PIERCE CRUSH!', color: '#06b6d4', alpha: 1, vy: -2, scale: 1.2 });
              }
            }

            // Diamondhead reflection
            if (B.abilityAuraTimer > 0 && bAlien === 'diamondhead') {
              const reflect = Math.round(dmgA * 0.35);
              A.health = Math.max(0, A.health - reflect);
              floatingTexts.push({ id: `refA_${frame}`, x: A.x, y: A.y - 30, text: `REFLECT -${reflect}`, color: '#10b981', alpha: 1, vy: -2, scale: 1 });
            }
            if (A.abilityAuraTimer > 0 && aAlien === 'diamondhead') {
              const reflect = Math.round(dmgB * 0.35);
              B.health = Math.max(0, B.health - reflect);
              floatingTexts.push({ id: `refB_${frame}`, x: B.x, y: B.y - 30, text: `REFLECT -${reflect}`, color: '#10b981', alpha: 1, vy: -2, scale: 1 });
            }

            if (isOvertime) { dmgA *= 1.5; dmgB *= 1.5; }
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
                floatingTexts.push({ id: `vamp_${frame}_${A.id}`, x: A.x, y: A.y - 45, text: `+${leech} HP`, color: '#ef4444', alpha: 1, vy: -2.5, scale: 1 });
              }
              if (B.specialPower === 'thorns') {
                const recoil = Math.round(dmgA * 0.3);
                A.health = Math.max(0, A.health - recoil);
                floatingTexts.push({ id: `thorn_${frame}_${A.id}`, x: A.x, y: A.y - 35, text: `-${recoil}`, color: '#eab308', alpha: 1, vy: -2, scale: 1 });
              }
            }

            if (dmgB > 0) {
              A.health = Math.max(0, A.health - dmgB);
              floatingTexts.push({ id: `hit_${frame}_${A.id}`, x: A.x, y: A.y - 35, text: `-${dmgB}`, color: '#f87171', alpha: 1, vy: -2, scale: 1.15 });

              if (B.specialPower === 'vampiric') {
                const leech = Math.round(dmgB * 0.2);
                B.health = Math.min(B.maxHealth, B.health + leech);
                floatingTexts.push({ id: `vamp_${frame}_${B.id}`, x: B.x, y: B.y - 45, text: `+${leech} HP`, color: '#ef4444', alpha: 1, vy: -2.5, scale: 1 });
              }
              if (A.specialPower === 'thorns') {
                const recoil = Math.round(dmgB * 0.3);
                B.health = Math.max(0, B.health - recoil);
                floatingTexts.push({ id: `thorn_${frame}_${B.id}`, x: B.x, y: B.y - 35, text: `-${recoil}`, color: '#eab308', alpha: 1, vy: -2, scale: 1 });
              }
            }

            // Phoenix Rebirth
            if (A.health <= 0 && A.specialPower === 'phoenix' && !A.phoenixUsed) {
              A.phoenixUsed = true;
              A.health = 20;
              floatingTexts.push({ id: `phx_${frame}_${A.id}`, x: A.x, y: A.y - 50, text: 'REBIRTH!', color: '#f59e0b', alpha: 1, vy: -3, scale: 1.3 });
            }
            if (B.health <= 0 && B.specialPower === 'phoenix' && !B.phoenixUsed) {
              B.phoenixUsed = true;
              B.health = 20;
              floatingTexts.push({ id: `phx_${frame}_${B.id}`, x: B.x, y: B.y - 50, text: 'REBIRTH!', color: '#f59e0b', alpha: 1, vy: -3, scale: 1.3 });
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
      isSelectionIntro,
      selectionDialScale,
      selectedAlienName,
      selectedAlienColor,
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
