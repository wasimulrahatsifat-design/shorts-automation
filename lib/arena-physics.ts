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

export function getAlienType(f?: { id?: string; name?: string; special_power?: string; specialPower?: string; specialAbility?: { name?: string; icon?: string; description?: string } } | null): AlienType {
  if (!f) return 'normal';
  const ab = (f as any).specialAbility;

  // 1. Direct ID & Name Matching (Exact & High-Priority)
  const rawId = (f.id || '').toLowerCase().replace(/[\s_-]+/g, '');
  const rawName = (f.name || '').toLowerCase().replace(/[\s_-]+/g, '');

  if (rawId === 'greymatter' || rawId === 'graymatter' || rawName.includes('greymatter') || rawName.includes('graymatter')) return 'grey_matter';
  if (rawId === 'heatblast' || rawName.includes('heatblast')) return 'heatblast';
  if (rawId === 'fourarms' || rawName.includes('fourarms')) return 'four_arms';
  if (rawId === 'xlr8' || rawName.includes('xlr8')) return 'xlr8';
  if (rawId === 'diamondhead' || rawName.includes('diamondhead')) return 'diamondhead';
  if (rawId === 'cannonbolt' || rawName.includes('cannonbolt')) return 'cannonbolt';
  if (rawId === 'wildmutt' || rawName.includes('wildmutt')) return 'wildmutt';
  if (rawId === 'ripjaws' || rawName.includes('ripjaw')) return 'ripjaws';
  if (rawId === 'upgrade' || rawName.includes('upgrade')) return 'upgrade';
  if (rawId === 'ghostfreak' || rawName.includes('ghostfreak')) return 'ghostfreak';
  if (rawId === 'stinkfly' || rawName.includes('stinkfly')) return 'stinkfly';

  // 2. Secondary matching on abilities and powers
  const str = `${rawId} ${rawName} ${f.special_power || ''} ${f.specialPower || ''} ${ab?.name || ''} ${ab?.icon || ''}`
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  if (str.includes('greymatter') || str.includes('graymatter') || str.includes('galvan') || str.includes('sungun') || str.includes('deathray')) return 'grey_matter';
  if (str.includes('heatblast') || str.includes('firewave') || str.includes('fireblast') || str.includes('fireball') || str.includes('pyronite')) return 'heatblast';
  if (str.includes('fourarms') || str.includes('sonicclap') || str.includes('tetramand')) return 'four_arms';
  if (str.includes('xlr8') || str.includes('windfunnel') || str.includes('tornado') || str.includes('cyclone') || str.includes('speedster') || str.includes('kineceleran')) return 'xlr8';
  if (str.includes('diamondhead') || str.includes('crystalwall') || str.includes('crystal') || str.includes('taydenite') || str.includes('petrosapien')) return 'diamondhead';
  if (str.includes('cannonbolt') || str.includes('armoredroll') || str.includes('arburian')) return 'cannonbolt';
  if (str.includes('wildmutt') || str.includes('predator') || str.includes('vulpimancer')) return 'wildmutt';
  if (str.includes('ripjaws') || str.includes('steeljaw') || str.includes('piscciss')) return 'ripjaws';
  if (str.includes('upgrade') || str.includes('opticlaser') || str.includes('plasma') || str.includes('mechamorph')) return 'upgrade';
  if (str.includes('ghostfreak') || str.includes('ectoneurite')) return 'ghostfreak';
  if (str.includes('stinkfly') || str.includes('acidgoop') || str.includes('lepidopterran')) return 'stinkfly';
  return 'normal';
}

// Canonical physical size scale per Ben 10 alien lore (Grey Matter tiny, Four Arms huge)
export const ALIEN_SIZE_SCALES: Record<AlienType, number> = {
  grey_matter: 0.60,   // Galvan: 5 inches tall canonically, small ball (~60% of base)
  xlr8: 0.88,          // Kineceleran: Sleek aerodynamic speedster (~88%)
  ghostfreak: 0.92,    // Ectonurite: Slender wispy phantom (~92%)
  stinkfly: 0.95,      // Lepidopterran: Slender insectoid (~95%)
  upgrade: 1.0,        // Galvanic Mechamorph: Standard (~100%)
  heatblast: 1.0,      // Pyronite: Standard (~100%)
  wildmutt: 1.08,      // Vulpimancer: Muscular predator beast (~108%)
  ripjaws: 1.06,       // Piscciss Volann: Predatory aquatic alien (~106%)
  diamondhead: 1.14,   // Petrosapien: Tall dense crystal armored titan (~114%)
  cannonbolt: 1.24,    // Arburian Pelarota: Heavy armored sphere titan (~124%)
  four_arms: 1.35,     // Tetramand: 12-foot hulking 4-armed titan (~135%)
  normal: 1.0,
};

export function getAlienSizeMultiplier(alienType: AlienType): number {
  return ALIEN_SIZE_SCALES[alienType] || 1.0;
}

export interface AbilityStatus {
  label: string;
  progress: number;
  isReady: boolean;
}

export function getAbilityStatus(f: SimFighter): AbilityStatus {
  const ab = f.specialAbility;
  const triggerType = ab?.trigger_type || 'charge';

  let triggerVal = ab?.trigger_value;
  if (triggerType === 'hit_combo') {
    triggerVal = (triggerVal !== undefined && triggerVal > 0 && triggerVal <= 20) ? triggerVal : 4;
  } else if (triggerType === 'hp_threshold') {
    triggerVal = (triggerVal !== undefined && triggerVal > 0 && triggerVal < 100) ? triggerVal : 50;
  } else if (triggerType === 'charge') {
    triggerVal = 100;
  } else {
    triggerVal = triggerVal || 5;
  }

  let label = 'CHARGE';
  let progress = 0;
  let isReady = false;

  if (triggerType === 'charge') {
    const bounces = Math.min(5, Math.floor((f.energyCharge || 0) / 20));
    label = bounces >= 5 ? 'READY!' : `BOUNCE ${bounces}/5`;
    progress = Math.min(100, Math.round(f.energyCharge || 0));
    isReady = progress >= 100 || f.specialMoveReady;
  } else if (triggerType === 'hp_threshold') {
    label = `RAGE <${triggerVal}%`;
    const thresholdHp = (f.maxHealth * triggerVal) / 100;
    if (f.health <= thresholdHp) {
      if (f.abilityCooldownTimer <= 0) {
        progress = 100;
        isReady = true;
      } else {
        const cdMax = Math.max(30, Math.round((f.abilityCooldownMax || 150) * 0.5));
        progress = Math.min(99, Math.round(((cdMax - f.abilityCooldownTimer) / cdMax) * 100));
        isReady = false;
      }
    } else {
      const hpOver = f.health - thresholdHp;
      const totalOver = Math.max(1, f.maxHealth - thresholdHp);
      progress = Math.max(0, Math.min(99, Math.round((1 - hpOver / totalOver) * 100)));
      isReady = false;
    }
  } else if (triggerType === 'hit_combo') {
    label = `COMBO ${Math.min(triggerVal, f.hitCombo || 0)}/${triggerVal}`;
    const comboHits = f.hitCombo || 0;
    if (comboHits >= triggerVal) {
      progress = 100;
      isReady = true;
    } else {
      progress = Math.min(99, Math.round((comboHits / triggerVal) * 100));
      isReady = false;
    }
  } else if (triggerType === 'cooldown') {
    label = 'COOLDOWN';
    const cdMax = f.abilityCooldownMax || 150;
    if (f.abilityCooldownTimer <= 0) {
      progress = 100;
      isReady = true;
    } else {
      progress = Math.min(99, Math.round(((cdMax - f.abilityCooldownTimer) / cdMax) * 100));
      isReady = false;
    }
  }

  if (f.specialMoveReady) {
    isReady = true;
    progress = 100;
  }

  return { label, progress, isReady };
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
  rageModeActivated?: boolean;
  crystalTrapCount?: number;
  goopTrapCount?: number;
  goopTrappedTimer?: number;
  goopDamageTicksRemaining?: number;
  goopDamageIntervalTimer?: number;
  bleedTimer?: number;
  bleedTicksRemaining?: number;
  bleedIntervalTimer?: number;
  bleedSource?: 'ripjaws' | 'wildmutt';
  burnTimer?: number;
  burnTicksRemaining?: number;
  burnIntervalTimer?: number;
  hasUsedFirstAbility?: boolean;
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

export interface SimHazardZone {
  id: string;
  type: 'fire' | 'crystals' | 'vortex' | 'acid';
  x: number;
  y: number;
  radius: number;
  remainingFrames: number;
  maxFrames: number;
  color: string;
  ownerId?: string;
  damagePerFrame?: number;
}

export interface SoundEvent {
  frame: number;
  sound:
    | 'hit'
    | 'bounce'
    | 'item'
    | 'gun'
    | 'explosion'
    | 'winner'
    | 'ability'
    | 'omnitrix_open'
    | 'omnitrix_turn'
    | 'omnitrix_slam'
    | 'hero_time'
    | 'sonic_clap'
    | 'fireblast'
    | 'wind_tornado'
    | 'crystal_shatter'
    | 'laser_beam'
    | 'cannon_roll'
    | 'steel_bite'
    | 'predator_roar'
    | 'ghost_wail'
    | 'acid_splatter';
  abilityType?: string;
  alienType?: string;
  volume?: number;
}

export interface SimCinematicZoom {
  active: boolean;
  scale: number;
  focusX: number;
  focusY: number;
  reason: 'first_ability' | 'elimination';
  title: string;
  subTitle: string;
  fighterName: string;
  fighterColor: string;
  progress: number;
  impactFlash?: number;
  timeScale?: number;
}

export interface SimFrameState {
  fighters: SimFighter[];
  items: SimItem[];
  bullets: SimBullet[];
  floatingTexts: SimFloatingText[];
  particles: SimParticle[];
  hazardZones?: SimHazardZone[];
  screenShake?: number;
  winner: SimFighter | null;
  aliveCount: number;
  isOvertime?: boolean;
  isSelectionIntro?: boolean;
  selectionDialScale?: number;
  selectedAlienName?: string;
  selectedAlienColor?: string;
  cinematicZoom?: SimCinematicZoom;
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
    name: 'Fire Blast',
    icon: 'FIRE BLAST',
    type: 'damage',
    cooldown_seconds: 5,
    power_value: 32,
    trigger_type: 'charge',
    trigger_value: 100,
    weapon_type: 'none',
    description: 'Pyronite fires a straight blazing fire blast stream and dashes straight at the opponent! Contact inflicts 2s burn damage.',
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
    description: 'Lunges into a vicious predator bite dealing heavy damage and causing 4s bleed (-1 HP/s, 4 HP total)!',
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
    description: 'Snaps giant steel jaws shredding shields and inflicting a 3s bleed (-1 HP/s, 3 HP total)!',
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
    description: 'Galvan genius unleashes a concentrated solar laser beam from an engineered device!',
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
    description: 'Sprays sticky acid goop in the arena trapping enemies for 2s (1 dmg/s) and unleashing an acid barrage on the 3rd trap!',
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

function getEstimatedClashDamage(attacker: SimFighter, defender: SimFighter, isOvertime: boolean): number {
  let dmg = attacker.damage;
  if (attacker.abilityAuraTimer > 0) {
    const aAlien = getAlienType(attacker);
    if (aAlien === 'heatblast') dmg += Math.round(attacker.damage * 0.6) || 20;
    else if (aAlien === 'cannonbolt') dmg += Math.round(attacker.damage * 0.75) || 25;
    else if (aAlien === 'wildmutt') dmg += Math.round(attacker.damage * 0.6) || 20;
    else if (aAlien === 'ripjaws') dmg += Math.round(attacker.damage * 0.9) || 30;
    else if (aAlien === 'diamondhead') dmg += Math.round(attacker.damage * 0.5) || 15;
    else if (aAlien === 'four_arms') dmg += Math.round(attacker.damage * 0.8) || 28;
  }
  if (isOvertime) dmg *= 2;
  if (attacker.hasDagger) dmg *= 2;
  if (attacker.specialPower === 'berserker' && attacker.health / attacker.maxHealth <= 0.2) dmg *= 2;
  if (attacker.specialAbility?.trigger_type === 'hp_threshold' && attacker.health <= (attacker.maxHealth * (attacker.specialAbility.trigger_value || 50)) / 100) {
    dmg = Math.round(dmg * 1.35);
  }
  return dmg;
}

export function generateArenaSimulation(
  contestants: FighterInput[],
  maxFrames = 10800, // Safe upper limit (6 minutes), battle runs continuously until winner emerges!
  seed = 42
): SimulationResult {
  const rng = createSeededRng(seed);
  const count = Math.max(2, contestants.length);
  const baseSize = getFighterSize(count);

  // Initialize Fighters inside Square Arena Box
  const fighters: SimFighter[] = contestants.map((c, idx) => {
    const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
    const spawnRadius = (ARENA_BOX.width / 2) * 0.62;
    let x = ARENA_CENTER.x + Math.cos(angle) * spawnRadius;
    let y = ARENA_CENTER.y + Math.sin(angle) * spawnRadius;

    const alienType = getAlienType(c);
    const sizeMultiplier = ALIEN_SIZE_SCALES[alienType] || 1.0;
    const individualSize = Math.round(baseSize * sizeMultiplier);
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
    const baseAbility = c.special_ability ||
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

    const abilityType = baseAbility.trigger_type || 'charge';
    let abilityTriggerVal = baseAbility.trigger_value;
    if (abilityType === 'hit_combo') {
      abilityTriggerVal = (abilityTriggerVal !== undefined && abilityTriggerVal > 0 && abilityTriggerVal <= 20) ? abilityTriggerVal : 4;
    } else if (abilityType === 'hp_threshold') {
      abilityTriggerVal = (abilityTriggerVal !== undefined && abilityTriggerVal > 0 && abilityTriggerVal < 100) ? abilityTriggerVal : 50;
    } else if (abilityType === 'charge') {
      abilityTriggerVal = 100;
    } else {
      abilityTriggerVal = abilityTriggerVal || 5;
    }

    const ability: SpecialAbility = {
      ...baseAbility,
      trigger_type: abilityType,
      trigger_value: abilityTriggerVal,
    };

    const cooldownFrames = Math.max(60, Math.round(ability.cooldown_seconds * 30));
    // If trigger_type is cooldown, start full cooldown timer so count starts from 0% and counts full duration
    const initialCooldown = ability.trigger_type === 'cooldown' ? cooldownFrames : 0;

    return {
      id: c.id || `fighter_${idx + 1}`,
      name: c.name || `Fighter ${idx + 1}`,
      color: c.color || '#3b82f6',
      image_url: c.image_url || null,
      x,
      y,
      vx,
      vy,
      size: individualSize,
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
      rageModeActivated: false,
      crystalTrapCount: 0,
      goopTrapCount: 0,
      goopTrappedTimer: 0,
      goopDamageTicksRemaining: 0,
      goopDamageIntervalTimer: 0,
      bleedTimer: 0,
      bleedTicksRemaining: 0,
      bleedIntervalTimer: 0,
      burnTimer: 0,
      burnTicksRemaining: 0,
      burnIntervalTimer: 0,
      hasUsedFirstAbility: false,
    };
  });

  const frames: SimFrameState[] = [];
  const soundEvents: SoundEvent[] = [];
  let items: SimItem[] = [];
  const bullets: SimBullet[] = [];
  const floatingTexts: SimFloatingText[] = [];
  const particles: SimParticle[] = [];
  let activeHazardZones: SimHazardZone[] = [];
  let currentFrameScreenShake = 0;

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

  // Ben 10 Omnitrix Selection Dial intro animation (95 frames = ~3.1 seconds)
  const SELECTION_INTRO_FRAMES = 95;

interface ActiveCinematicState {
  reason: 'first_ability' | 'elimination';
  focusX: number;
  focusY: number;
  targetFighterId: string;
  fighterName: string;
  fighterColor: string;
  title: string;
  subTitle: string;
  startFrame: number;
  duration: number;
}

interface LethalFinisherState {
  phase: 'attacker_zoom' | 'projectile_travel' | 'victim_zoom' | 'clash_zoom' | 'impact_finish';
  killerId: string;
  victimId: string;
  killerName: string;
  victimName: string;
  killerColor: string;
  victimColor: string;
  phaseFrame: number;
  phaseDuration: number;
  isSeparated: boolean;
}

let activeCinematic: ActiveCinematicState | null = null;
let lethalFinisher: LethalFinisherState | null = null;

function triggerEliminationCinematic(currentFrame: number, victim: SimFighter, killer?: SimFighter) {
  if (lethalFinisher) return;
  if (activeCinematic && activeCinematic.reason === 'elimination' && (currentFrame - activeCinematic.startFrame) < 24) {
    return;
  }
  activeCinematic = {
    reason: 'elimination',
    focusX: victim.x,
    focusY: victim.y,
    targetFighterId: victim.id,
    fighterName: victim.name,
    fighterColor: victim.color || '#ef4444',
    title: 'FATAL KNOCKOUT',
    subTitle: `K.O. - ${victim.name.toUpperCase()} ELIMINATED!`,
    startFrame: currentFrame,
    duration: 54, // Extended dramatic cutscene duration for ultra slow-motion appreciation
  };
}

for (let frame = 0; frame < maxFrames; frame++) {
  currentFrameScreenShake = 0;
  const aliveFighters = fighters.filter((f) => !f.isDead);
  const isSelectionIntro = frame < SELECTION_INTRO_FRAMES;
  let selectionDialScale = 1.0;
  let selectedAlienName = '';
  let selectedAlienColor = '#00ff66';
  const isOvertime = !isSelectionIntro && frame >= 5400 && aliveFighters.length > 1;

  let timeScale = 1.0;
  let currentCinematicZoom: SimCinematicZoom | undefined = undefined;

  // 1. Advance anticipation check: Detect lethal attack before impact in 1v1 final showdown
  if (aliveFighters.length === 2 && !lethalFinisher && !winner && !isSelectionIntro) {
    const fA = aliveFighters[0];
    const fB = aliveFighters[1];

    // Check if an incoming lethal projectile is in flight towards opponent
    for (const b of bullets) {
      if (b.ownerId === fA.id || b.ownerId === fB.id) {
        const shooter = b.ownerId === fA.id ? fA : fB;
        const target = b.ownerId === fA.id ? fB : fA;

        // Calculate total incoming projectile damage directed at target
        let totalIncomingDmg = 0;
        for (const bCheck of bullets) {
          if (bCheck.ownerId === shooter.id) {
            const dx = target.x - bCheck.x;
            const dy = target.y - bCheck.y;
            const bSpd = Math.hypot(bCheck.vx, bCheck.vy);
            if (bSpd > 1) {
              const dot = (dx * bCheck.vx + dy * bCheck.vy) / bSpd;
              const perp = Math.abs(dx * (-bCheck.vy) + dy * bCheck.vx) / bSpd;
              const hitR = (bCheck.size ? bCheck.size / 2 : 10) + target.size / 2 + 35;
              if (dot > 0 && perp <= hitR) {
                totalIncomingDmg += bCheck.damage;
              }
            }
          }
        }

        if (target.health <= totalIncomingDmg) {
          const distBetweenFighters = Math.hypot(shooter.x - target.x, shooter.y - target.y);
          const isSeparated = distBetweenFighters > 220;

          lethalFinisher = {
            phase: isSeparated ? 'attacker_zoom' : 'clash_zoom',
            killerId: shooter.id,
            victimId: target.id,
            killerName: shooter.name,
            victimName: target.name,
            killerColor: shooter.color || '#00ff66',
            victimColor: target.color || '#ef4444',
            phaseFrame: 0,
            phaseDuration: isSeparated ? 24 : 28,
            isSeparated,
          };
          break;
        }
      }
    }

    // Check approaching physical clash or high-speed dash that will be fatal
    if (!lethalFinisher) {
      const clashDist = Math.hypot(fA.x - fB.x, fA.y - fB.y);
      const collDist = (fA.size + fB.size) / 2;
      const rvx = fA.vx - fB.vx;
      const rvy = fA.vy - fB.vy;
      const relApproach = -((fB.x - fA.x) * rvx + (fB.y - fA.y) * rvy) / (clashDist || 1);

      const estDmgA = getEstimatedClashDamage(fA, fB, isOvertime);
      const estDmgB = getEstimatedClashDamage(fB, fA, isOvertime);

      if (relApproach > 1.2 && (clashDist <= collDist + 65 || (relApproach > 10 && clashDist <= 350))) {
        if (fB.health <= estDmgA || fA.health <= estDmgB) {
          const killer = fB.health <= estDmgA ? fA : fB;
          const victim = fB.health <= estDmgA ? fB : fA;

          // If aliens are already close together, zoom once on the clash without double zoom
          const isSeparated = clashDist > 220;
          lethalFinisher = {
            phase: isSeparated ? 'attacker_zoom' : 'clash_zoom',
            killerId: killer.id,
            victimId: victim.id,
            killerName: killer.name,
            victimName: victim.name,
            killerColor: killer.color || '#00ff66',
            victimColor: victim.color || '#ef4444',
            phaseFrame: 0,
            phaseDuration: isSeparated ? 24 : 28,
            isSeparated,
          };
        }
      }
    }
  }

  // 2. Process Lethal Finisher Multi-Stage Cinematic
  const curLethal: LethalFinisherState | null = lethalFinisher as (LethalFinisherState | null);
  if (Boolean(curLethal)) {
    const lf = curLethal as LethalFinisherState;
    lf.phaseFrame++;

    const killer = fighters.find((f) => f.id === lf.killerId);
    const victim = fighters.find((f) => f.id === lf.victimId);

    if (lf.phase === 'attacker_zoom') {
      const p = Math.min(1.0, lf.phaseFrame / lf.phaseDuration);
      const zoomAmount = Math.sin(p * Math.PI);
      const scale = 1.0 + zoomAmount * 1.35; // Smooth 2.35x zoom on Attacker
      timeScale = 0.0; // Time FREEZES!

      const focusX = killer ? killer.x : ARENA_CENTER.x;
      const focusY = killer ? killer.y : ARENA_CENTER.y;

      currentCinematicZoom = {
        active: true,
        scale,
        focusX: Math.max(ARENA_BOX.left + 140, Math.min(ARENA_BOX.right - 140, focusX)),
        focusY: Math.max(ARENA_BOX.top + 140, Math.min(ARENA_BOX.bottom - 140, focusY)),
        reason: 'elimination',
        title: 'LETHAL ATTACK',
        subTitle: `${lf.killerName.toUpperCase()} - FINAL STRIKE!`,
        fighterName: lf.killerName,
        fighterColor: lf.killerColor,
        progress: p,
        impactFlash: zoomAmount > 0.85 ? (zoomAmount - 0.85) / 0.15 : 0,
        timeScale: 0.0,
      };

      if (lf.phaseFrame >= lf.phaseDuration) {
        lf.phase = 'projectile_travel';
        lf.phaseFrame = 0;
        lf.phaseDuration = 70;
      }
    } else if (lf.phase === 'projectile_travel') {
      // Camera zooms out to normal view and time plays again as projectile/dash travels!
      timeScale = 0.85;
      currentCinematicZoom = undefined;

      let closeToVictim = false;
      if (victim) {
        const lethalBullet = bullets.find((b) => b.ownerId === lf.killerId);
        if (lethalBullet) {
          const d = Math.hypot(lethalBullet.x - victim.x, lethalBullet.y - victim.y);
          if (d <= ((lethalBullet.size || 20) / 2 + victim.size / 2 + 55)) {
            closeToVictim = true;
          }
        } else {
          const d = Math.hypot((killer ? killer.x : 0) - victim.x, (killer ? killer.y : 0) - victim.y);
          if (d <= (((killer?.size || 60) + victim.size) / 2 + 55)) {
            closeToVictim = true;
          }
        }
      } else {
        closeToVictim = true;
      }

      if (closeToVictim || lf.phaseFrame >= lf.phaseDuration) {
        lf.phase = 'victim_zoom';
        lf.phaseFrame = 0;
        lf.phaseDuration = 24;
      }
    } else if (lf.phase === 'victim_zoom') {
      const p = Math.min(1.0, lf.phaseFrame / lf.phaseDuration);
      const zoomAmount = Math.sin(p * Math.PI);
      const scale = 1.0 + zoomAmount * 1.45; // 2.45x zoom on Victim right before hit
      timeScale = 0.0; // Time FREEZES!

      const focusX = victim ? victim.x : ARENA_CENTER.x;
      const focusY = victim ? victim.y : ARENA_CENTER.y;

      currentCinematicZoom = {
        active: true,
        scale,
        focusX: Math.max(ARENA_BOX.left + 140, Math.min(ARENA_BOX.right - 140, focusX)),
        focusY: Math.max(ARENA_BOX.top + 140, Math.min(ARENA_BOX.bottom - 140, focusY)),
        reason: 'elimination',
        title: 'CRITICAL IMPACT',
        subTitle: `${lf.victimName.toUpperCase()} - FATAL DANGER!`,
        fighterName: lf.victimName,
        fighterColor: lf.victimColor,
        progress: p,
        impactFlash: zoomAmount > 0.85 ? (zoomAmount - 0.85) / 0.15 : 0,
        timeScale: 0.0,
      };

      if (lf.phaseFrame >= lf.phaseDuration) {
        lf.phase = 'impact_finish';
        lf.phaseFrame = 0;
        lf.phaseDuration = 38;
      }
    } else if (lf.phase === 'clash_zoom') {
      const p = Math.min(1.0, lf.phaseFrame / lf.phaseDuration);
      const zoomAmount = Math.sin(p * Math.PI);
      const scale = 1.0 + zoomAmount * 1.35; // 2.35x zoom on Clash
      timeScale = 0.0; // Time FREEZES on the clash!

      const midX = (killer && victim) ? (killer.x + victim.x) / 2 : (killer?.x || ARENA_CENTER.x);
      const midY = (killer && victim) ? (killer.y + victim.y) / 2 : (killer?.y || ARENA_CENTER.y);

      currentCinematicZoom = {
        active: true,
        scale,
        focusX: Math.max(ARENA_BOX.left + 140, Math.min(ARENA_BOX.right - 140, midX)),
        focusY: Math.max(ARENA_BOX.top + 140, Math.min(ARENA_BOX.bottom - 140, midY)),
        reason: 'elimination',
        title: 'FATAL CLASH',
        subTitle: `${lf.killerName.toUpperCase()} VS ${lf.victimName.toUpperCase()}`,
        fighterName: lf.killerName,
        fighterColor: lf.killerColor,
        progress: p,
        impactFlash: zoomAmount > 0.85 ? (zoomAmount - 0.85) / 0.15 : 0,
        timeScale: 0.0,
      };

      if (lf.phaseFrame >= lf.phaseDuration) {
        lf.phase = 'impact_finish';
        lf.phaseFrame = 0;
        lf.phaseDuration = 38;
      }
    } else if (lf.phase === 'impact_finish') {
      const p = Math.min(1.0, lf.phaseFrame / lf.phaseDuration);
      const scale = 1.0 + (1.0 - p) * 0.45;
      timeScale = 0.12; // Slow motion impact finish!

      const focusX = victim ? victim.x : ARENA_CENTER.x;
      const focusY = victim ? victim.y : ARENA_CENTER.y;

      currentCinematicZoom = {
        active: true,
        scale,
        focusX: Math.max(ARENA_BOX.left + 140, Math.min(ARENA_BOX.right - 140, focusX)),
        focusY: Math.max(ARENA_BOX.top + 140, Math.min(ARENA_BOX.bottom - 140, focusY)),
        reason: 'elimination',
        title: 'FATAL KNOCKOUT',
        subTitle: `K.O. - ${lf.victimName.toUpperCase()} ELIMINATED!`,
        fighterName: lf.victimName,
        fighterColor: '#ef4444',
        progress: p,
        impactFlash: (1.0 - p) > 0.75 ? (1.0 - p - 0.75) / 0.25 : 0,
        timeScale: 0.12,
      };

      if (lf.phaseFrame >= lf.phaseDuration) {
        lethalFinisher = null;
      }
    }
  } else {
    // 3. Single ability / regular elimination fallback
    const currentCinematic: ActiveCinematicState | null = activeCinematic as (ActiveCinematicState | null);
    if (Boolean(currentCinematic)) {
      const cin = currentCinematic as ActiveCinematicState;
      const elapsed = frame - cin.startFrame;
      if (elapsed < cin.duration) {
        const p = elapsed / cin.duration; // 0 to 1
        const peakZoom = cin.reason === 'elimination' ? 2.35 : 2.15;
        const zoomAmount = Math.sin(p * Math.PI);
        const scale = 1.0 + zoomAmount * (peakZoom - 1.0);

        const peakSlowMo = cin.reason === 'elimination' ? 0.08 : 0.10;
        timeScale = Math.max(peakSlowMo, 1.0 - zoomAmount * (1.0 - peakSlowMo));

        const impactFlash = zoomAmount > 0.82 ? (zoomAmount - 0.82) / 0.18 : 0;

        const targetFighter = fighters.find((f) => f.id === cin.targetFighterId);
        if (targetFighter) {
          cin.focusX = targetFighter.x;
          cin.focusY = targetFighter.y;
        }

        currentCinematicZoom = {
          active: true,
          scale,
          focusX: Math.max(ARENA_BOX.left + 140, Math.min(ARENA_BOX.right - 140, cin.focusX)),
          focusY: Math.max(ARENA_BOX.top + 140, Math.min(ARENA_BOX.bottom - 140, cin.focusY)),
          reason: cin.reason,
          title: cin.title,
          subTitle: cin.subTitle,
          fighterName: cin.fighterName,
          fighterColor: cin.fighterColor,
          progress: p,
          impactFlash,
          timeScale,
        };
      } else {
        activeCinematic = null;
      }
    }
  }

    if (isSelectionIntro) {
      if (frame === 0) {
        soundEvents.push({ frame: 0, sound: 'omnitrix_open', volume: 0.9 });
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
      if (frame >= 18 && frame < 72) {
        const cycleIdx = Math.floor((frame - 18) / 14) % fighters.length;
        const currentCycling = fighters[cycleIdx];
        selectedAlienName = currentCycling ? currentCycling.name : '';
        selectedAlienColor = currentCycling ? (currentCycling.color || '#00ff66') : '#00ff66';
        if ((frame - 18) % 14 === 0) {
          soundEvents.push({ frame, sound: 'omnitrix_turn', volume: 0.7 });
        }
      } else if (frame >= 85) {
        selectedAlienName = "It's Hero Time!";
        selectedAlienColor = '#00ff66';
      } else {
        selectedAlienName = '';
      }

      // Slam down impact at frame 85: Shockwave particle burst + slam sound + It's Hero Time voice!
      if (frame === 85) {
        soundEvents.push({ frame: 85, sound: 'omnitrix_slam', volume: 1.0 });
        soundEvents.push({ frame: 85, sound: 'hero_time', volume: 1.0 });
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
      // Sudden death / overtime after 3 minutes (frame 5400) if match is still ongoing
      if (isOvertime && !announcedOvertime) {
        announcedOvertime = true;
        floatingTexts.push({
          id: `overtime_${frame}`,
          x: ARENA_CENTER.x,
          y: ARENA_CENTER.y - 120,
          text: '3-MIN FRENZY: 2X DAMAGE & SPEED!',
          color: '#ef4444',
          alpha: 1,
          vy: -1,
          scale: 1.6,
        });
        soundEvents.push({ frame, sound: 'fireblast', abilityType: 'damage', volume: 1.0 });
      }

      // Check winner: Battle runs until last fighter standing!
      // IMPORTANT: Wait until any active elimination cutscene completely finishes!
      // This ensures the dramatic slow-motion final knockout is fully enjoyed before the victory overlay appears.
      const hasPendingCinematic = Boolean(activeCinematic || lethalFinisher);
      if (aliveFighters.length === 1 && !winner && fighters.length > 1 && !hasPendingCinematic) {
        winner = { ...aliveFighters[0] };
        winnerAnnouncedFrame = frame;
        soundEvents.push({ frame, sound: 'winner', volume: 1.0 });
      } else if (aliveFighters.length === 0 && !winner && fighters.length > 1 && !hasPendingCinematic) {
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
    if (!winner && timeScale > 0 && !isSelectionIntro) {
      aliveFighters.forEach((f) => {
        if (f.frozenTimer > 0) {
          f.frozenTimer--;
          return; // Frozen fighters cannot execute abilities
        }

        if (f.abilityAuraTimer > 0) f.abilityAuraTimer--;
        if (f.abilityCooldownTimer > 0) f.abilityCooldownTimer--;

        const ab = f.specialAbility;
        const triggerType = ab.trigger_type || 'charge';
        let triggerVal = ab.trigger_value;
        if (triggerType === 'hit_combo') {
          triggerVal = (triggerVal !== undefined && triggerVal > 0 && triggerVal <= 20) ? triggerVal : 4;
        } else if (triggerType === 'hp_threshold') {
          triggerVal = (triggerVal !== undefined && triggerVal > 0 && triggerVal < 100) ? triggerVal : 50;
        } else if (triggerType === 'charge') {
          triggerVal = 100;
        } else {
          triggerVal = triggerVal || 5;
        }

        // Omnitrix charge is now strictly driven by wall bounces (+20% per bounce, 5 bounces = 100%)

        // Low HP Rage instant activation on first drop below threshold
        const thresholdHp = (f.maxHealth * triggerVal) / 100;
        if (triggerType === 'hp_threshold' && f.health <= thresholdHp && !f.rageModeActivated) {
          f.rageModeActivated = true;
          f.abilityCooldownTimer = 0; // Trigger immediately upon entering Rage!
        }

        // Check if criteria is satisfied
        let isTriggerReady = false;
        if (triggerType === 'charge') {
          isTriggerReady = f.energyCharge >= 100;
        } else if (triggerType === 'hp_threshold') {
          isTriggerReady = f.health <= thresholdHp && f.abilityCooldownTimer <= 0;
        } else if (triggerType === 'hit_combo') {
          isTriggerReady = (f.hitCombo || 0) >= triggerVal;
        } else if (triggerType === 'cooldown') {
          isTriggerReady = f.abilityCooldownTimer <= 0;
        }

        f.specialMoveReady = isTriggerReady;

        if (isTriggerReady) {
          const otherFighters = aliveFighters.filter((opp) => opp.id !== f.id);
          if (otherFighters.length === 0) return;

          // Check if this alien is using their special ability for the FIRST time in this match
          if (!f.hasUsedFirstAbility) {
            f.hasUsedFirstAbility = true;
            activeCinematic = {
              reason: 'first_ability',
              focusX: f.x,
              focusY: f.y,
              targetFighterId: f.id,
              fighterName: f.name,
              fighterColor: f.color || '#00ff66',
              title: 'SIGNATURE MOVE',
              subTitle: `${f.name.toUpperCase()} // ${ab.name.toUpperCase()}`,
              startFrame: frame,
              duration: 46,
            };
          }

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
          const bannerText = triggerType === 'hp_threshold'
            ? `${f.name.toUpperCase()}: RAGE ${ab.name.toUpperCase()}!`
            : triggerType === 'hit_combo'
            ? `${f.name.toUpperCase()}: 4X COMBO ${ab.name.toUpperCase()}!`
            : `${f.name.toUpperCase()}: ${ab.name.toUpperCase()}!`;

          floatingTexts.push({
            id: `ab_banner_${frame}_${f.id}`,
            x: f.x,
            y: f.y - (f.size / 2 + 35),
            text: bannerText,
            color: triggerType === 'hp_threshold' ? '#ef4444' : '#00ff66',
            alpha: 1,
            vy: -2.8,
            scale: 1.4,
          });

          f.abilityAuraTimer = 60;
          f.abilityAuraIcon = ab.icon;
          f.abilityAuraColor = triggerType === 'hp_threshold' ? '#ef4444' : '#00ff66';

          // Reset trigger gauges
          f.energyCharge = 0;
          f.hitCombo = 0;
          f.specialMoveReady = false;
          f.abilityCooldownTimer = triggerType === 'hp_threshold'
            ? Math.round(f.abilityCooldownMax * 0.5)
            : isOvertime
            ? Math.round(f.abilityCooldownMax * 0.6)
            : f.abilityCooldownMax;

          // Execute Alien-Specific Signature Move (PHYSICAL ONLY - NO REMOTE INVISIBLE DAMAGE)
          const aType = getAlienType(f);
          const targetAngle = Math.atan2(nearestOpp.y - f.y, nearestOpp.x - f.x);
          const abilityPower = f.specialAbility?.power_value || Math.round(f.damage * 1.1) || 30;

          if (aType === 'four_arms') {
            // FOUR ARMS: SONIC SHOCKWAVE CLAP!
            // Thunderous sonic clap sound + entire arena shakes violently
            soundEvents.push({ frame, sound: 'sonic_clap', alienType: 'four_arms', volume: 1.0 });
            currentFrameScreenShake = 32;
            f.abilityAuraTimer = 65;
            f.abilityAuraColor = '#dc2626';

            // Giant sonic shockwave projectile flying toward the opponent
            bullets.push({
              x: f.x + Math.cos(targetAngle) * (f.size / 2 + 20),
              y: f.y + Math.sin(targetAngle) * (f.size / 2 + 20),
              vx: Math.cos(targetAngle) * 20,
              vy: Math.sin(targetAngle) * 20,
              ownerId: f.id,
              color: '#dc2626',
              damage: Math.round(abilityPower),
              life: 55,
              bulletType: 'shockwave',
              size: 46,
            });

            // Expanding sonic shockwave dust & distortion particles
            for (let k = 0; k < 30; k++) {
              const ang = (k / 30) * Math.PI * 2;
              particles.push({
                x: f.x + Math.cos(ang) * (f.size / 2 + 10),
                y: f.y + Math.sin(ang) * (f.size / 2 + 10),
                vx: Math.cos(ang) * 16,
                vy: Math.sin(ang) * 16,
                color: k % 2 === 0 ? '#dc2626' : '#ffffff',
                radius: rng() * 5 + 3,
                alpha: 1,
              });
            }
          } else if (aType === 'heatblast') {
            // HEATBLAST: BLAZING PYRONITE STRAIGHT FIRE BLAST & 3-SECOND ARENA FIRE!
            soundEvents.push({ frame, sound: 'fireblast', alienType: 'heatblast', volume: 1.0 });
            f.abilityAuraTimer = 65;
            f.abilityAuraColor = '#ea580c';

            // Straight fire wave dash directly toward opponent:
            f.vx = Math.cos(targetAngle) * 16;
            f.vy = Math.sin(targetAngle) * 16;

            // Spawn 3-second burning fire ground hazard where Heatblast attacks (target area)
            activeHazardZones.push({
              id: `fire_ground_${frame}_${f.id}`,
              type: 'fire',
              x: nearestOpp.x,
              y: nearestOpp.y,
              radius: 110,
              remainingFrames: 90, // Exactly 3 seconds (90 frames at 30 fps)
              maxFrames: 90,
              color: '#ea580c',
              ownerId: f.id,
              damagePerFrame: 0.35,
            });

            // Straight concentrated fire blast projectiles shooting straight forward in a stream:
            for (let i = 0; i < 3; i++) {
              const offsetDist = i * 22;
              bullets.push({
                x: f.x + Math.cos(targetAngle) * (f.size / 2 + 18 + offsetDist),
                y: f.y + Math.sin(targetAngle) * (f.size / 2 + 18 + offsetDist),
                vx: Math.cos(targetAngle) * 22,
                vy: Math.sin(targetAngle) * 22,
                ownerId: f.id,
                color: '#ea580c',
                damage: Math.max(5, Math.round(abilityPower / 3)),
                life: 55,
                bulletType: 'fireball',
                size: 32,
              });
            }

            // Straight blazing fire blast cone particles shooting forward
            for (let k = 0; k < 22; k++) {
              const pSpd = rng() * 12 + 6;
              const pAng = targetAngle + (rng() - 0.5) * 0.25;
              particles.push({
                x: f.x + Math.cos(targetAngle) * (f.size / 2),
                y: f.y + Math.sin(targetAngle) * (f.size / 2),
                vx: Math.cos(pAng) * pSpd,
                vy: Math.sin(pAng) * pSpd,
                color: rng() > 0.4 ? '#ea580c' : '#facc15',
                radius: rng() * 5 + 3,
                alpha: 1,
              });
            }
          } else if (aType === 'xlr8') {
            // XLR8: HYPERSPEED CYCLONE TORNADO!
            f.speedBoostTimer = 110;
            f.abilityAuraTimer = 110;
            f.abilityAuraColor = '#0284c7';
            f.vx = Math.cos(targetAngle) * 22;
            f.vy = Math.sin(targetAngle) * 22;
            soundEvents.push({ frame, sound: 'wind_tornado', alienType: 'xlr8', volume: 1.0 });
            floatingTexts.push({
              id: `wf_${frame}_${f.id}`,
              x: f.x,
              y: f.y - 45,
              text: 'WIND FUNNEL!',
              color: '#38bdf8',
              alpha: 1,
              vy: -2,
              scale: 1.3,
            });

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
            // DIAMONDHEAD: CRYSTAL WALL ERUPTION (Persistent crystal wall in arena)
            f.bonusShield = Math.round(abilityPower * 1.5) || 50;
            f.abilityAuraTimer = 85;
            f.abilityAuraColor = '#10b981';
            soundEvents.push({ frame, sound: 'crystal_shatter', alienType: 'diamondhead', volume: 1.0 });
            floatingTexts.push({ id: `shd_${frame}_${f.id}`, x: f.x, y: f.y - 40, text: `CRYSTAL WALL +${f.bonusShield}`, color: '#10b981', alpha: 1, vy: -2.2, scale: 1.25 });

            // Spawn Crystal Wall in arena that PERSISTS until touched by an enemy!
            const spawnDist = Math.min(160, Math.hypot(nearestOpp.x - f.x, nearestOpp.y - f.y) * 0.45);
            const crystalX = Math.max(ARENA_BOX.left + 90, Math.min(ARENA_BOX.right - 90, f.x + Math.cos(targetAngle) * spawnDist));
            const crystalY = Math.max(ARENA_BOX.top + 90, Math.min(ARENA_BOX.bottom - 90, f.y + Math.sin(targetAngle) * spawnDist));

            activeHazardZones.push({
              id: `crystal_wall_${frame}_${f.id}`,
              type: 'crystals',
              x: crystalX,
              y: crystalY,
              radius: 95,
              remainingFrames: 999999, // PERSISTENT until touched by enemy!
              maxFrames: 999999,
              color: '#10b981',
              ownerId: f.id,
            });
          } else if (aType === 'cannonbolt') {
            // CANNONBOLT: HYPER ARMORED KINETIC WRECKING BALL (Takes 40% damage, deals 1.3x damage)
            f.abilityAuraTimer = 90;
            f.abilityAuraColor = '#f59e0b';
            f.vx = Math.cos(targetAngle) * 24;
            f.vy = Math.sin(targetAngle) * 24;
            currentFrameScreenShake = 18;
            soundEvents.push({ frame, sound: 'cannon_roll', alienType: 'cannonbolt', volume: 1.0 });
            floatingTexts.push({
              id: `cb_roll_${frame}_${f.id}`,
              x: f.x,
              y: f.y - 45,
              text: 'ARMORED ROLL!',
              color: '#f59e0b',
              alpha: 1,
              vy: -2,
              scale: 1.3,
            });
          } else if (aType === 'wildmutt') {
            // WILDMUTT: PREDATOR SENSE POUNCE
            f.vx = Math.cos(targetAngle) * 21;
            f.vy = Math.sin(targetAngle) * 21;
            f.abilityAuraTimer = 70;
            f.abilityAuraColor = '#f97316';
            soundEvents.push({ frame, sound: 'predator_roar', alienType: 'wildmutt', volume: 1.0 });
            floatingTexts.push({
              id: `wm_pounce_${frame}_${f.id}`,
              x: f.x,
              y: f.y - 45,
              text: 'PREDATOR POUNCE!',
              color: '#f97316',
              alpha: 1,
              vy: -2,
              scale: 1.25,
            });
          } else if (aType === 'ripjaws') {
            // RIPJAWS: STEEL JAW BITE CHARGE
            f.vx = Math.cos(targetAngle) * 19;
            f.vy = Math.sin(targetAngle) * 19;
            f.abilityAuraTimer = 75;
            f.abilityAuraColor = '#06b6d4';
            soundEvents.push({ frame, sound: 'steel_bite', alienType: 'ripjaws', volume: 1.0 });
            floatingTexts.push({
              id: `rj_bite_${frame}_${f.id}`,
              x: f.x,
              y: f.y - 45,
              text: 'STEEL JAW BITE!',
              color: '#06b6d4',
              alpha: 1,
              vy: -2,
              scale: 1.25,
            });
          } else if (aType === 'upgrade') {
            // UPGRADE: OPTIC PLASMA LASER (Burst of 3 high-speed laser bolts)
            soundEvents.push({ frame, sound: 'laser_beam', alienType: 'upgrade', volume: 1.0 });
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
            soundEvents.push({ frame, sound: 'laser_beam', alienType: 'grey_matter', volume: 1.0 });
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
            // STINKFLY: TOXIC ACID GOOP SPRAY
            soundEvents.push({ frame, sound: 'acid_splatter', alienType: 'stinkfly', volume: 1.0 });
            f.abilityAuraTimer = 70;
            f.abilityAuraColor = '#84cc16';
            activeHazardZones.push({
              id: `acid_ground_${frame}_${f.id}`,
              type: 'acid',
              x: nearestOpp.x,
              y: nearestOpp.y,
              radius: 95,
              remainingFrames: 180,
              maxFrames: 180,
              color: '#84cc16',
              ownerId: f.id,
              damagePerFrame: 0.25,
            });
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
            soundEvents.push({ frame, sound: 'ghost_wail', alienType: 'ghostfreak', volume: 1.0 });
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
            // Generic Fallback for custom or non-preset fighters
            f.abilityAuraTimer = 60;
            f.abilityAuraColor = f.color;

            if (ab.type === 'shield') {
              f.bonusShield = Math.round(abilityPower * 1.5) || 50;
              soundEvents.push({ frame, sound: 'crystal_shatter', alienType: 'diamondhead', volume: 1.0 });
              floatingTexts.push({
                id: `shd_${frame}_${f.id}`,
                x: f.x,
                y: f.y - 40,
                text: `SHIELD +${f.bonusShield}`,
                color: '#10b981',
                alpha: 1,
                vy: -2.2,
                scale: 1.25,
              });
            } else if (ab.type === 'heal') {
              const healAmt = Math.round(abilityPower) || 35;
              f.health = Math.min(f.maxHealth, f.health + healAmt);
              soundEvents.push({ frame, sound: 'crystal_shatter', volume: 0.9 });
              floatingTexts.push({
                id: `heal_${frame}_${f.id}`,
                x: f.x,
                y: f.y - 40,
                text: `+${healAmt} HP`,
                color: '#22c55e',
                alpha: 1,
                vy: -2.2,
                scale: 1.25,
              });
            } else if (ab.type === 'speed') {
              f.speedBoostTimer = 100;
              f.vx = Math.cos(targetAngle) * 22;
              f.vy = Math.sin(targetAngle) * 22;
              soundEvents.push({ frame, sound: 'wind_tornado', alienType: 'xlr8', volume: 1.0 });
              floatingTexts.push({
                id: `wf_${frame}_${f.id}`,
                x: f.x,
                y: f.y - 45,
                text: 'WIND FUNNEL!',
                color: '#38bdf8',
                alpha: 1,
                vy: -2,
                scale: 1.3,
              });
            } else if (ab.type === 'freeze') {
              nearestOpp.frozenTimer = 65;
              soundEvents.push({ frame, sound: 'ghost_wail', alienType: 'ghostfreak', volume: 1.0 });
              floatingTexts.push({
                id: `frz_${frame}_${nearestOpp.id}`,
                x: nearestOpp.x,
                y: nearestOpp.y - 40,
                text: 'FROZEN!',
                color: '#38bdf8',
                alpha: 1,
                vy: -2.0,
                scale: 1.25,
              });
            } else {
              // Default: Damage Blast Projectile
              soundEvents.push({ frame, sound: 'fireblast', alienType: 'heatblast', volume: 1.0 });
              bullets.push({
                x: f.x + Math.cos(targetAngle) * (f.size / 2 + 18),
                y: f.y + Math.sin(targetAngle) * (f.size / 2 + 18),
                vx: Math.cos(targetAngle) * 20,
                vy: Math.sin(targetAngle) * 20,
                ownerId: f.id,
                color: f.color || '#00ff66',
                damage: Math.round(abilityPower),
                life: 55,
                bulletType: 'shockwave',
                size: 38,
              });
            }
          }
        }
      });
    }

    // Move Spherical Balls & 4-Wall Bounces inside ARENA_BOX
    if (!isSelectionIntro) {
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

      // Bleed Damage-Over-Time (DoT) and blood loss effect (Ripjaws: 3s @ 1 HP/s = 3 HP; Wildmutt: 4s @ 1 HP/s = 4 HP)
      if (f.bleedTimer && f.bleedTimer > 0 && !f.isDead) {
        f.bleedTimer--;

        // Trailing crimson blood droplets dripping downward from the wounded fighter
        if (frame % 3 === 0) {
          particles.push({
            x: f.x + (rng() - 0.5) * (f.size * 0.5),
            y: f.y + (rng() - 0.5) * (f.size * 0.5),
            vx: (rng() - 0.5) * 1.5,
            vy: rng() * 2 + 1.2,
            color: rng() > 0.4 ? '#dc2626' : '#991b1b',
            radius: rng() * 3 + 2,
            alpha: 0.9,
          });
        }

        if (f.bleedIntervalTimer !== undefined) {
          f.bleedIntervalTimer--;
          if (f.bleedIntervalTimer <= 0 && f.bleedTicksRemaining && f.bleedTicksRemaining > 0) {
            f.health = Math.max(0, f.health - 1);
            f.hitFlash = 6;
            f.bleedTicksRemaining--;
            f.bleedIntervalTimer = 30; // 30 frames = 1 second

            // Blood droplet burst on tick
            for (let b = 0; b < 6; b++) {
              particles.push({
                x: f.x + (rng() - 0.5) * 24,
                y: f.y + (rng() - 0.5) * 24,
                vx: (rng() - 0.5) * 4,
                vy: (rng() - 0.5) * 4 + 1.5,
                color: '#ef4444',
                radius: rng() * 2.5 + 2,
                alpha: 1.0,
              });
            }

            floatingTexts.push({
              id: `bleed_${frame}_${f.id}_${f.bleedTicksRemaining}`,
              x: f.x + (rng() - 0.5) * 20,
              y: f.y - 35,
              text: '-1 BLEED',
              color: '#ef4444',
              alpha: 1,
              vy: -1.8,
              scale: 1.1,
            });

            if (f.health <= 0 && !f.isDead) {
              f.isDead = true;
              triggerEliminationCinematic(frame, f);
              floatingTexts.push({
                id: `rip_bleed_${frame}_${f.id}`,
                x: f.x,
                y: f.y - 50,
                text: 'BLED OUT!',
                color: '#dc2626',
                alpha: 1,
                vy: -2.5,
                scale: 1.3,
              });
              soundEvents.push({ frame, sound: 'explosion', volume: 0.9 });
            }
          }
        }
      }

      // Stinkfly Goop Trapped & Damage-Over-Time (DoT: 2s trap with 1 dmg per second = 2 dmg total)
      if (f.goopTrappedTimer && f.goopTrappedTimer > 0) {
        f.goopTrappedTimer--;
        // Dripping acidic lime slime droplets
        if (frame % 3 === 0) {
          particles.push({
            x: f.x + (rng() - 0.5) * (f.size * 0.5),
            y: f.y + (rng() - 0.5) * (f.size * 0.5),
            vx: (rng() - 0.5) * 1.5,
            vy: rng() * 2 + 1,
            color: rng() > 0.4 ? '#84cc16' : '#a3e635',
            radius: rng() * 3 + 2,
            alpha: 0.9,
          });
        }
      }

      if (f.goopDamageTicksRemaining && f.goopDamageTicksRemaining > 0 && !f.isDead) {
        if (f.goopDamageIntervalTimer !== undefined) {
          f.goopDamageIntervalTimer--;
          if (f.goopDamageIntervalTimer <= 0) {
            f.health = Math.max(0, f.health - 1);
            f.hitFlash = 6;
            f.goopDamageTicksRemaining--;
            f.goopDamageIntervalTimer = 30; // 30 frames = 1 second

            floatingTexts.push({
              id: `goop_dot_${frame}_${f.id}`,
              x: f.x,
              y: f.y - 30,
              text: '-1 GOOP',
              color: '#84cc16',
              alpha: 1,
              vy: -2,
              scale: 1.1,
            });

            for (let k = 0; k < 6; k++) {
              particles.push({
                x: f.x + (rng() - 0.5) * 15,
                y: f.y + (rng() - 0.5) * 15,
                vx: (rng() - 0.5) * 3,
                vy: (rng() - 0.5) * 3,
                color: '#84cc16',
                radius: rng() * 3 + 1.5,
                alpha: 0.85,
              });
            }

            if (f.health <= 0 && !f.isDead) {
              f.isDead = true;
              triggerEliminationCinematic(frame, f);
              soundEvents.push({ frame, sound: 'explosion', volume: 1.0 });
            }
          }
        }
      }

      // Heatblast Passive Contact Burn (DoT: 2s burn with 1 dmg per second = 2 dmg total)
      if (f.burnTimer && f.burnTimer > 0 && !f.isDead) {
        f.burnTimer--;
        // Trailing burning flame sparks and smoke from the burning victim
        if (frame % 3 === 0) {
          particles.push({
            x: f.x + (rng() - 0.5) * (f.size * 0.6),
            y: f.y + (rng() - 0.5) * (f.size * 0.6),
            vx: (rng() - 0.5) * 2,
            vy: -2 - rng() * 3,
            color: rng() > 0.4 ? '#ea580c' : '#facc15',
            radius: rng() * 4 + 2,
            alpha: 0.9,
          });
        }

        if (f.burnIntervalTimer !== undefined) {
          f.burnIntervalTimer--;
          if (f.burnIntervalTimer <= 0 && f.burnTicksRemaining && f.burnTicksRemaining > 0) {
            f.health = Math.max(0, f.health - 1);
            f.hitFlash = 6;
            f.burnTicksRemaining--;
            f.burnIntervalTimer = 30; // 30 frames = 1 second

            floatingTexts.push({
              id: `burn_dot_${frame}_${f.id}_${f.burnTicksRemaining}`,
              x: f.x + (rng() - 0.5) * 20,
              y: f.y - 35,
              text: '-1 BURN',
              color: '#ea580c',
              alpha: 1,
              vy: -1.8,
              scale: 1.1,
            });

            if (f.health <= 0 && !f.isDead) {
              f.isDead = true;
              triggerEliminationCinematic(frame, f);
              floatingTexts.push({
                id: `burn_rip_${frame}_${f.id}`,
                x: f.x,
                y: f.y - 50,
                text: 'INCINERATED!',
                color: '#ea580c',
                alpha: 1,
                vy: -2.5,
                scale: 1.3,
              });
              soundEvents.push({ frame, sound: 'explosion', volume: 0.9 });
            }
          }
        }
      }

      const aType = getAlienType(f);
      if (aType === 'xlr8') {
        const curSpd = Math.hypot(f.vx, f.vy);
        const targetSpd = 14.0;
        if (curSpd < targetSpd && curSpd > 0.05) {
          f.vx = (f.vx / curSpd) * targetSpd;
          f.vy = (f.vy / curSpd) * targetSpd;
        }
      }

      const overtimeSpeed = isOvertime ? 1.5 : 1.0;
      const spdMult = (f.speedBoostTimer > 0 ? 1.6 : 1.0) * overtimeSpeed * timeScale;
      f.x += f.vx * spdMult;
      f.y += f.vy * spdMult;

      // Ball rolling rotation angle
      const rollSpeed = Math.hypot(f.vx, f.vy) / (f.size / 2);
      f.angle = (f.angle || 0) + (f.vx >= 0 ? rollSpeed : -rollSpeed) * 0.4 * timeScale;

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
        // Wall bounce charges Omnitrix energy gauge (+20% per bounce, exactly 5 bounces = 100%)
        f.energyCharge = Math.min(100, (f.energyCharge || 0) + 20);
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
            if (f.health > (f.maxHealth * (f.specialAbility?.trigger_value || 50)) / 100) {
              f.rageModeActivated = false;
            }
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
    if (timeScale > 0) {
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * timeScale;
        b.y += b.vy * timeScale;
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
            const shooter = aliveFighters.find((sf) => sf.id === b.ownerId);
            let bulletDmg = b.damage;

            // XLR8 Wind Funnel damage modifiers on projectiles
            if (shooter && getAlienType(shooter) === 'xlr8' && (shooter.abilityAuraTimer > 0 || shooter.speedBoostTimer > 0)) {
              bulletDmg = Math.round(bulletDmg * 1.5);
            }
            if (getAlienType(t) === 'xlr8' && (t.abilityAuraTimer > 0 || t.speedBoostTimer > 0)) {
              bulletDmg = Math.round(bulletDmg * 0.5);
            }

            // Cannonbolt: takes 40% damage, deals 1.3x damage while ability is active
            if (shooter && getAlienType(shooter) === 'cannonbolt' && shooter.abilityAuraTimer > 0) {
              bulletDmg = Math.round(bulletDmg * 1.3);
            }
            if (getAlienType(t) === 'cannonbolt' && t.abilityAuraTimer > 0) {
              bulletDmg = Math.round(bulletDmg * 0.4);
            }

            // Diamondhead Passive: 10% chance to completely nullify damage
            if (getAlienType(t) === 'diamondhead' && rng() < 0.10) {
              bulletDmg = 0;
              floatingTexts.push({ id: `dh_null_b_${frame}_${i}`, x: t.x, y: t.y - 35, text: 'NULLIFIED! (0 DMG)', color: '#10b981', alpha: 1, vy: -2, scale: 1.15 });
            }

            t.health = Math.max(0, t.health - bulletDmg);
            t.hitFlash = 14;

            // Credit shooter with hit combo
            if (shooter) {
              shooter.hitCombo = (shooter.hitCombo || 0) + 1;
            }

            // Kinetic knockback in bullet's flight direction
            const bDist = Math.hypot(b.vx, b.vy) || 1;
            t.vx += (b.vx / bDist) * 8;
            t.vy += (b.vy / bDist) * 8;

            const isFireBullet = shooter && getAlienType(shooter) === 'heatblast';
            const isAcidBullet = b.bulletType === 'acid' || (shooter && getAlienType(shooter) === 'stinkfly');
            soundEvents.push({
              frame,
              sound: isAcidBullet ? 'acid_splatter' : isFireBullet ? 'fireblast' : 'hit',
              alienType: isAcidBullet ? 'stinkfly' : isFireBullet ? 'heatblast' : undefined,
              volume: 0.85,
            });
            floatingTexts.push({
              id: `b_${frame}_${i}`,
              x: t.x,
              y: t.y - 35,
              text: `-${bulletDmg}`,
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
              triggerEliminationCinematic(frame, t, shooter);
              soundEvents.push({ frame, sound: 'explosion', volume: 1.0 });
            }
            bullets.splice(i, 1);
            break;
          }
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

            // Increment hit combo on impact
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
                soundEvents.push({ frame, sound: 'fireblast', alienType: 'heatblast', volume: 0.85 });
              } else if (aAlien === 'cannonbolt') {
                dmgA += Math.round(A.damage * 0.75) || 25; // Armored kinetic impact
                B.vx += nx * 14; B.vy += ny * 14;
                floatingTexts.push({ id: `slam_${frame}_${B.id}`, x: B.x, y: B.y - 45, text: 'KINETIC SLAM!', color: '#f59e0b', alpha: 1, vy: -2, scale: 1.1 });
                soundEvents.push({ frame, sound: 'cannon_roll', alienType: 'cannonbolt', volume: 0.95 });
              } else if (aAlien === 'wildmutt') {
                dmgA += Math.round(A.damage * 0.6) || 20; // Predator pounce bite
                B.speedBoostTimer = -45; // Slow down
                // Apply 4-second bleed (1 HP lost per sec, 4 HP total)
                B.bleedTimer = 120;
                B.bleedTicksRemaining = 4;
                B.bleedIntervalTimer = 30;
                B.bleedSource = 'wildmutt';
                floatingTexts.push({ id: `bite_${frame}_${B.id}`, x: B.x, y: B.y - 45, text: 'PREDATOR MAUL! BLEED (-4 HP)', color: '#f97316', alpha: 1, vy: -2, scale: 1.25 });
                // Blood splatter particles burst on enemy
                for (let k = 0; k < 16; k++) {
                  particles.push({
                    x: B.x + (rng() - 0.5) * 20,
                    y: B.y + (rng() - 0.5) * 20,
                    vx: (rng() - 0.5) * 8,
                    vy: (rng() - 0.5) * 8 + 2,
                    color: rng() > 0.3 ? '#dc2626' : '#991b1b',
                    radius: rng() * 4 + 2,
                    alpha: 1.0,
                  });
                }
              } else if (aAlien === 'ripjaws') {
                dmgA += Math.round(A.damage * 0.9) || 30; // Steel jaws
                B.bonusShield = 0; B.hasShield = false; // shred shield
                // Apply 3-second bleed (1 HP lost per sec, 3 HP total)
                B.bleedTimer = 90;
                B.bleedTicksRemaining = 3;
                B.bleedIntervalTimer = 30;
                B.bleedSource = 'ripjaws';
                floatingTexts.push({ id: `jaw_${frame}_${B.id}`, x: B.x, y: B.y - 45, text: 'STEEL BITE! BLEED (-3 HP)', color: '#06b6d4', alpha: 1, vy: -2, scale: 1.25 });
                // Blood splatter particles burst on enemy
                for (let k = 0; k < 16; k++) {
                  particles.push({
                    x: B.x + (rng() - 0.5) * 20,
                    y: B.y + (rng() - 0.5) * 20,
                    vx: (rng() - 0.5) * 8,
                    vy: (rng() - 0.5) * 8 + 2,
                    color: rng() > 0.3 ? '#dc2626' : '#7f1d1d',
                    radius: rng() * 4 + 2,
                    alpha: 1.0,
                  });
                }
              }
            }

            if (B.abilityAuraTimer > 0) {
              if (bAlien === 'heatblast') {
                dmgB += Math.round(B.damage * 0.6) || 20;
                floatingTexts.push({ id: `fire_${frame}_${A.id}`, x: A.x, y: A.y - 45, text: 'FIRE BLAST!', color: '#ea580c', alpha: 1, vy: -2, scale: 1.1 });
                soundEvents.push({ frame, sound: 'fireblast', alienType: 'heatblast', volume: 0.85 });
              } else if (bAlien === 'cannonbolt') {
                dmgB += Math.round(B.damage * 0.75) || 25;
                A.vx -= nx * 14; A.vy -= ny * 14;
                floatingTexts.push({ id: `slam_${frame}_${A.id}`, x: A.x, y: A.y - 45, text: 'KINETIC SLAM!', color: '#f59e0b', alpha: 1, vy: -2, scale: 1.1 });
                soundEvents.push({ frame, sound: 'cannon_roll', alienType: 'cannonbolt', volume: 0.95 });
              } else if (bAlien === 'wildmutt') {
                dmgB += Math.round(B.damage * 0.6) || 20;
                A.speedBoostTimer = -45;
                A.bleedTimer = 120;
                A.bleedTicksRemaining = 4;
                A.bleedIntervalTimer = 30;
                A.bleedSource = 'wildmutt';
                floatingTexts.push({ id: `bite_${frame}_${A.id}`, x: A.x, y: A.y - 45, text: 'PREDATOR MAUL! BLEED (-4 HP)', color: '#f97316', alpha: 1, vy: -2, scale: 1.25 });
                for (let k = 0; k < 16; k++) {
                  particles.push({
                    x: A.x + (rng() - 0.5) * 20,
                    y: A.y + (rng() - 0.5) * 20,
                    vx: (rng() - 0.5) * 8,
                    vy: (rng() - 0.5) * 8 + 2,
                    color: rng() > 0.3 ? '#dc2626' : '#991b1b',
                    radius: rng() * 4 + 2,
                    alpha: 1.0,
                  });
                }
              } else if (bAlien === 'ripjaws') {
                dmgB += Math.round(B.damage * 0.9) || 30;
                A.bonusShield = 0; A.hasShield = false;
                A.bleedTimer = 90;
                A.bleedTicksRemaining = 3;
                A.bleedIntervalTimer = 30;
                A.bleedSource = 'ripjaws';
                floatingTexts.push({ id: `jaw_${frame}_${A.id}`, x: A.x, y: A.y - 45, text: 'STEEL BITE! BLEED (-3 HP)', color: '#06b6d4', alpha: 1, vy: -2, scale: 1.25 });
                for (let k = 0; k < 16; k++) {
                  particles.push({
                    x: A.x + (rng() - 0.5) * 20,
                    y: A.y + (rng() - 0.5) * 20,
                    vx: (rng() - 0.5) * 8,
                    vy: (rng() - 0.5) * 8 + 2,
                    color: rng() > 0.3 ? '#dc2626' : '#7f1d1d',
                    radius: rng() * 4 + 2,
                    alpha: 1.0,
                  });
                }
              }
            }

            // Heatblast Passive: Contact Burn on opponents (2s burn @ 1 HP/s = 2 HP total)
            if (aAlien === 'heatblast' && !B.isDead && (!B.burnTimer || B.burnTimer <= 0)) {
              B.burnTimer = 60; // 2 seconds (60 frames at 30 fps)
              B.burnTicksRemaining = 2; // 1 dmg per sec
              B.burnIntervalTimer = 30; // 1st tick at 30 frames
              floatingTexts.push({
                id: `hb_burn_${frame}_${B.id}`,
                x: B.x,
                y: B.y - 45,
                text: 'BURNING! (2s)',
                color: '#ea580c',
                alpha: 1,
                vy: -2,
                scale: 1.15,
              });
              for (let k = 0; k < 12; k++) {
                particles.push({
                  x: B.x + (rng() - 0.5) * 20,
                  y: B.y + (rng() - 0.5) * 20,
                  vx: (rng() - 0.5) * 6,
                  vy: -2 - rng() * 4,
                  color: rng() > 0.4 ? '#ea580c' : '#facc15',
                  radius: rng() * 4 + 2,
                  alpha: 1,
                });
              }
            }
            if (bAlien === 'heatblast' && !A.isDead && (!A.burnTimer || A.burnTimer <= 0)) {
              A.burnTimer = 60; // 2 seconds (60 frames at 30 fps)
              A.burnTicksRemaining = 2; // 1 dmg per sec
              A.burnIntervalTimer = 30; // 1st tick at 30 frames
              floatingTexts.push({
                id: `hb_burn_${frame}_${A.id}`,
                x: A.x,
                y: A.y - 45,
                text: 'BURNING! (2s)',
                color: '#ea580c',
                alpha: 1,
                vy: -2,
                scale: 1.15,
              });
              for (let k = 0; k < 12; k++) {
                particles.push({
                  x: A.x + (rng() - 0.5) * 20,
                  y: A.y + (rng() - 0.5) * 20,
                  vx: (rng() - 0.5) * 6,
                  vy: -2 - rng() * 4,
                  color: rng() > 0.4 ? '#ea580c' : '#facc15',
                  radius: rng() * 4 + 2,
                  alpha: 1,
                });
              }
            }

            // XLR8 Wind Funnel: deals 1.5x damage, and takes 50% less damage (incoming dmg reduced by 50%)
            const aInWindFunnel = aAlien === 'xlr8' && (A.abilityAuraTimer > 0 || A.speedBoostTimer > 0);
            const bInWindFunnel = bAlien === 'xlr8' && (B.abilityAuraTimer > 0 || B.speedBoostTimer > 0);

            if (aInWindFunnel) {
              dmgA = Math.round(dmgA * 1.5);
              dmgB = Math.round(dmgB * 0.5);
              floatingTexts.push({ id: `wf_atk_${frame}_${B.id}`, x: B.x, y: B.y - 45, text: 'WIND FUNNEL 1.5X!', color: '#38bdf8', alpha: 1, vy: -2, scale: 1.15 });
              floatingTexts.push({ id: `wf_def_${frame}_${A.id}`, x: A.x, y: A.y - 30, text: 'FUNNEL GUARD -50%', color: '#0284c7', alpha: 1, vy: -2, scale: 1 });
            }
            if (bInWindFunnel) {
              dmgB = Math.round(dmgB * 1.5);
              dmgA = Math.round(dmgA * 0.5);
              floatingTexts.push({ id: `wf_atk_${frame}_${A.id}`, x: A.x, y: A.y - 45, text: 'WIND FUNNEL 1.5X!', color: '#38bdf8', alpha: 1, vy: -2, scale: 1.15 });
              floatingTexts.push({ id: `wf_def_${frame}_${B.id}`, x: B.x, y: B.y - 30, text: 'FUNNEL GUARD -50%', color: '#0284c7', alpha: 1, vy: -2, scale: 1 });
            }

            // Cannonbolt Special Ability: deals 1.3x damage, takes 40% damage (incoming dmg reduced to 40%)
            const aCannonboltActive = aAlien === 'cannonbolt' && A.abilityAuraTimer > 0;
            const bCannonboltActive = bAlien === 'cannonbolt' && B.abilityAuraTimer > 0;

            if (aCannonboltActive) {
              dmgA = Math.round(dmgA * 1.3);
              dmgB = Math.round(dmgB * 0.4);
              floatingTexts.push({ id: `cb_atk_${frame}_${B.id}`, x: B.x, y: B.y - 45, text: 'CANNON SLAM 1.3X!', color: '#f59e0b', alpha: 1, vy: -2, scale: 1.15 });
              floatingTexts.push({ id: `cb_def_${frame}_${A.id}`, x: A.x, y: A.y - 30, text: 'ARMOR GUARD (40%)', color: '#fbbf24', alpha: 1, vy: -2, scale: 1 });
            }
            if (bCannonboltActive) {
              dmgB = Math.round(dmgB * 1.3);
              dmgA = Math.round(dmgA * 0.4);
              floatingTexts.push({ id: `cb_atk_${frame}_${A.id}`, x: A.x, y: A.y - 45, text: 'CANNON SLAM 1.3X!', color: '#f59e0b', alpha: 1, vy: -2, scale: 1.15 });
              floatingTexts.push({ id: `cb_def_${frame}_${B.id}`, x: B.x, y: B.y - 30, text: 'ARMOR GUARD (40%)', color: '#fbbf24', alpha: 1, vy: -2, scale: 1 });
            }

            // Diamondhead Passive: 10% chance to completely nullify incoming damage (takes 0 damage)
            if (bAlien === 'diamondhead' && dmgA > 0 && rng() < 0.10) {
              dmgA = 0;
              floatingTexts.push({ id: `dh_null_B_${frame}`, x: B.x, y: B.y - 35, text: 'NULLIFIED! (0 DMG)', color: '#10b981', alpha: 1, vy: -2, scale: 1.15 });
            }
            if (aAlien === 'diamondhead' && dmgB > 0 && rng() < 0.10) {
              dmgB = 0;
              floatingTexts.push({ id: `dh_null_A_${frame}`, x: A.x, y: A.y - 35, text: 'NULLIFIED! (0 DMG)', color: '#10b981', alpha: 1, vy: -2, scale: 1.15 });
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

            if (isOvertime) { dmgA *= 2; dmgB *= 2; }
            if (A.hasDagger) { dmgA *= 2; A.daggerActivated = true; }
            if (A.specialPower === 'berserker' && A.health / A.maxHealth <= 0.2) dmgA *= 2;

            // Low HP Rage damage boost (+35%)
            if (A.specialAbility?.trigger_type === 'hp_threshold' && A.health <= (A.maxHealth * (A.specialAbility.trigger_value || 50)) / 100) {
              dmgA = Math.round(dmgA * 1.35);
            }
            if (B.specialAbility?.trigger_type === 'hp_threshold' && B.health <= (B.maxHealth * (B.specialAbility.trigger_value || 50)) / 100) {
              dmgB = Math.round(dmgB * 1.35);
            }

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
              triggerEliminationCinematic(frame, A, B);
              soundEvents.push({ frame, sound: 'explosion', volume: 1.0 });
            }
            if (B.health <= 0 && !B.isDead) {
              B.isDead = true;
              triggerEliminationCinematic(frame, B, A);
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
  }

    // Decay Particles & Floating Texts
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].x += particles[i].vx * timeScale;
      particles[i].y += particles[i].vy * timeScale;
      particles[i].alpha -= 0.04 * timeScale;
      if (particles[i].alpha <= 0) particles.splice(i, 1);
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      floatingTexts[i].y += floatingTexts[i].vy * timeScale;
      floatingTexts[i].alpha -= 0.03 * timeScale;
      if (floatingTexts[i].alpha <= 0) floatingTexts.splice(i, 1);
    }

    // Update active ground hazard zones
    if (timeScale > 0 && !isSelectionIntro) {
      activeHazardZones.forEach((hz) => {
        if (hz.maxFrames < 99999) {
        hz.remainingFrames--;
      }
      if (hz.type === 'fire') {
        // Continuous burning damage to opponents in the fire zone
        for (const opp of aliveFighters) {
          if (opp.id !== hz.ownerId) {
            const d = Math.hypot(opp.x - hz.x, opp.y - hz.y);
            if (d <= hz.radius) {
              let hzDmg = hz.damagePerFrame || 0.35;
              if (getAlienType(opp) === 'xlr8' && (opp.abilityAuraTimer > 0 || opp.speedBoostTimer > 0)) {
                hzDmg *= 0.5; // XLR8 in wind funnel takes 50% less hazard damage
              }
              if (getAlienType(opp) === 'cannonbolt' && opp.abilityAuraTimer > 0) {
                hzDmg *= 0.4; // Cannonbolt takes 40% damage during special ability
              }
              if (getAlienType(opp) === 'diamondhead' && rng() < 0.10) {
                hzDmg = 0; // Diamondhead 10% damage nullification
              }
              opp.health = Math.max(0, opp.health - hzDmg);
              opp.hitFlash = Math.max(opp.hitFlash, 4);
            }
          }
        }
        // Emit fiery flame particles
        if (frame % 4 === 0) {
          particles.push({
            x: hz.x + (rng() - 0.5) * hz.radius * 1.4,
            y: hz.y + (rng() - 0.5) * hz.radius * 1.2,
            vx: (rng() - 0.5) * 2,
            vy: -2.5 - rng() * 3.5,
            color: rng() > 0.4 ? '#f97316' : '#facc15',
            radius: 3.5 + rng() * 4,
            alpha: 0.95,
          });
        }
      } else if (hz.type === 'acid') {
        for (const opp of aliveFighters) {
          if (opp.id !== hz.ownerId && opp.health > 0) {
            const d = Math.hypot(opp.x - hz.x, opp.y - hz.y);
            if (d <= hz.radius + opp.size / 2) {
              // Enemy touches the goop spray in the arena!
              hz.remainingFrames = 0; // Splatters and traps enemy
              soundEvents.push({ frame, sound: 'acid_splatter', alienType: 'stinkfly', volume: 1.0 });

              // Sticky lime slime splatter particles
              for (let k = 0; k < 24; k++) {
                const ang = rng() * Math.PI * 2;
                const spd = rng() * 10 + 3;
                particles.push({
                  x: opp.x,
                  y: opp.y,
                  vx: Math.cos(ang) * spd,
                  vy: Math.sin(ang) * spd,
                  color: rng() > 0.4 ? '#84cc16' : '#a3e635',
                  radius: rng() * 5 + 3,
                  alpha: 1,
                });
              }

              // Trap / immobilize enemy for 2 seconds (60 frames at 30 fps)
              opp.frozenTimer = 60;
              opp.goopTrappedTimer = 60;

              // Over these 2 seconds, 1 damage per second (total 2 damage)
              opp.goopDamageTicksRemaining = 2;
              opp.goopDamageIntervalTimer = 30; // 1st tick at 30f (1s), 2nd tick at 60f (2s)

              floatingTexts.push({
                id: `goop_trp_${frame}_${opp.id}`,
                x: opp.x,
                y: opp.y - 45,
                text: 'GOOP TRAPPED! (2s)',
                color: '#84cc16',
                alpha: 1,
                vy: -2,
                scale: 1.3,
              });

              // Track goop traps for Stinkfly (3rd touch execution barrage, identical to Diamondhead)
              const owner = aliveFighters.find((f) => f.id === hz.ownerId);
              if (owner) {
                owner.goopTrapCount = (owner.goopTrapCount || 0) + 1;
                // On the 3rd time (or multiples of 3), Stinkfly shoots goop at the trapped enemy!
                if (owner.goopTrapCount % 3 === 0) {
                  const aimAng = Math.atan2(opp.y - owner.y, opp.x - owner.x);
                  floatingTexts.push({
                    id: `goop_exec_${frame}_${owner.id}`,
                    x: owner.x,
                    y: owner.y - 45,
                    text: 'GOOP BARRAGE!',
                    color: '#84cc16',
                    alpha: 1,
                    vy: -2.5,
                    scale: 1.4,
                  });
                  soundEvents.push({ frame, sound: 'acid_splatter', alienType: 'stinkfly', volume: 1.0 });

                  // Fire 5 concentrated acidic goop projectiles directly at the trapped enemy
                  for (let s = -2; s <= 2; s++) {
                    const spread = s * 0.08;
                    bullets.push({
                      x: owner.x + Math.cos(aimAng + spread) * (owner.size / 2 + 15),
                      y: owner.y + Math.sin(aimAng + spread) * (owner.size / 2 + 15),
                      vx: Math.cos(aimAng + spread) * 24,
                      vy: Math.sin(aimAng + spread) * 24,
                      ownerId: owner.id,
                      color: '#84cc16',
                      damage: Math.max(14, Math.round((owner.damage || 25) * 0.75)),
                      life: 45,
                      bulletType: 'acid',
                      size: 28,
                    });
                  }
                }
              }
              break;
            }
          }
        }
      } else if (hz.type === 'crystals') {
        // Persistent Crystal Wall: stays until an enemy touches it
        for (const opp of aliveFighters) {
          if (opp.id !== hz.ownerId && opp.health > 0) {
            const d = Math.hypot(opp.x - hz.x, opp.y - hz.y);
            if (d <= hz.radius + opp.size / 2) {
              // Enemy touches the crystal wall!
              hz.remainingFrames = 0; // Shatter & remove
              soundEvents.push({ frame, sound: 'crystal_shatter', alienType: 'diamondhead', volume: 1.0 });

              // Green emerald crystal shatter particles
              for (let k = 0; k < 24; k++) {
                const ang = rng() * Math.PI * 2;
                const spd = rng() * 12 + 4;
                particles.push({
                  x: opp.x,
                  y: opp.y,
                  vx: Math.cos(ang) * spd,
                  vy: Math.sin(ang) * spd,
                  color: rng() > 0.3 ? '#10b981' : '#34d399',
                  radius: rng() * 5 + 3,
                  alpha: 1,
                });
              }

              // Freeze enemy for 2 seconds (60 frames at 30 fps)
              opp.frozenTimer = 60;
              floatingTexts.push({
                id: `crz_frz_${frame}_${opp.id}`,
                x: opp.x,
                y: opp.y - 45,
                text: 'FROZEN! (2s)',
                color: '#10b981',
                alpha: 1,
                vy: -2,
                scale: 1.3,
              });

              // Track crystal traps for Diamondhead (3rd touch crystal execution)
              const owner = aliveFighters.find((f) => f.id === hz.ownerId);
              if (owner) {
                owner.crystalTrapCount = (owner.crystalTrapCount || 0) + 1;
                // On the 3rd time (or multiples of 3), Diamondhead throws crystals at trapped enemy!
                if (owner.crystalTrapCount % 3 === 0) {
                  const aimAng = Math.atan2(opp.y - owner.y, opp.x - owner.x);
                  floatingTexts.push({
                    id: `crz_exec_${frame}_${owner.id}`,
                    x: owner.x,
                    y: owner.y - 45,
                    text: 'CRYSTAL EXECUTION!',
                    color: '#10b981',
                    alpha: 1,
                    vy: -2.5,
                    scale: 1.4,
                  });
                  soundEvents.push({ frame, sound: 'crystal_shatter', alienType: 'diamondhead', volume: 1.0 });

                  // Fire 5 sharp Taydenite crystal shards directly at the frozen enemy
                  for (let s = -2; s <= 2; s++) {
                    const spread = s * 0.08;
                    bullets.push({
                      x: owner.x + Math.cos(aimAng + spread) * (owner.size / 2 + 15),
                      y: owner.y + Math.sin(aimAng + spread) * (owner.size / 2 + 15),
                      vx: Math.cos(aimAng + spread) * 24,
                      vy: Math.sin(aimAng + spread) * 24,
                      ownerId: owner.id,
                      color: '#10b981',
                      damage: Math.max(14, Math.round((owner.damage || 25) * 0.75)),
                      life: 45,
                      bulletType: 'shard',
                      size: 26,
                    });
                  }
                }
              }
              break;
            }
          }
        }
      }
    });
    activeHazardZones = activeHazardZones.filter((hz) => hz.remainingFrames > 0);
  }

    // Snapshot frame
    frames.push({
      fighters: fighters.map((f) => ({ ...f })),
      items: items.map((it) => ({ ...it })),
      bullets: bullets.map((b) => ({ ...b })),
      floatingTexts: floatingTexts.map((ft) => ({ ...ft })),
      particles: particles.map((p) => ({ ...p })),
      hazardZones: activeHazardZones.map((hz) => ({ ...hz })),
      screenShake: currentFrameScreenShake,
      winner: winner ? { ...winner } : null,
      aliveCount: aliveFighters.length,
      isOvertime,
      isSelectionIntro,
      selectionDialScale,
      selectedAlienName,
      selectedAlienColor,
      cinematicZoom: currentCinematicZoom ? { ...currentCinematicZoom } : undefined,
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
