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

export interface SpecialAbility {
  name: string;
  icon: string;
  type: 'damage' | 'shield' | 'heal' | 'freeze' | 'speed';
  cooldown_seconds: number;
  power_value: number;
  description?: string;
  trigger_type?: 'charge' | 'hp_threshold' | 'hit_combo' | 'cooldown';
  trigger_value?: number;
  weapon_type?: 'sword' | 'fist' | 'flame' | 'crystal' | 'none';
  weapon_icon?: string;
}

export interface ContestantConfig {
  id: string;
  name: string;
  color: string;
  image_url: string | null;
  starting_health: number;
  damage: number;
  speed: number;
  special_power: string;
  special_ability?: SpecialAbility;
}

export type ArenaItemType = 'health' | 'dagger' | 'gun' | 'shield' | 'speed';

export interface ArenaItem {
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

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  color: string;
  damage: number;
  life: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
  decay: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
  scale: number;
}

export interface LiveFighter {
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
  hasShield: boolean;
  hasDagger: boolean;
  daggerTimer: number;
  daggerActivated: boolean;
  gunBullets: number;
  speedBoostTimer: number;
}

export const ARENA_BOX = {
  left: 90,
  top: 380,
  right: 990,
  bottom: 1280,
  width: 900,
  height: 900,
};
export const ARENA_RADIUS = 430;
export const ARENA_CENTER = { x: 540, y: 830 };
export const BOX_SIZE = 120;
