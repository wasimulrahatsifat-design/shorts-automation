'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
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
  getAbilityStatus,
  ALIEN_SIZE_SCALES,
  getFighterSize,
} from '../../lib/arena-physics';
import { idbGet, idbSet, idbDelete } from '../../lib/storage-idb';

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
  {
    id: 'grey_matter',
    name: 'Grey Matter',
    color: '#94a3b8',
    image_url: null,
    starting_health: 80,
    damage: 20,
    speed: 7.5,
    special_power: 'none',
    special_ability: BEN10_DEFAULT_ABILITIES['grey_matter'],
  },
  {
    id: 'stinkfly',
    name: 'Stinkfly',
    color: '#84cc16',
    image_url: null,
    starting_health: 90,
    damage: 24,
    speed: 7.8,
    special_power: 'none',
    special_ability: BEN10_DEFAULT_ABILITIES['stinkfly'],
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
  BEN10_DEFAULT_ABILITIES['grey_matter'],
  BEN10_DEFAULT_ABILITIES['stinkfly'],
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
  const isStorageInitializedRef = useRef<boolean>(false);

  // Interactive Ben 10 Omnitrix Selection State (Supports N Players based on Fighter Count)
  type SelectionPhase = 'idle' | 'selecting' | 'hero_time' | 'battling';
  const [selectionPhase, setSelectionPhase] = useState<SelectionPhase>('idle');
  const selectionPhaseRef = useRef<SelectionPhase>('idle');
  useEffect(() => {
    selectionPhaseRef.current = selectionPhase;
  }, [selectionPhase]);

  const [currentSelectingIndex, setCurrentSelectingIndex] = useState<number>(0);
  const currentSelectingIndexRef = useRef<number>(0);
  useEffect(() => {
    currentSelectingIndexRef.current = currentSelectingIndex;
  }, [currentSelectingIndex]);

  const [selectedAliens, setSelectedAliens] = useState<ContestantConfig[]>([]);
  const selectedAliensRef = useRef<ContestantConfig[]>([]);
  useEffect(() => {
    selectedAliensRef.current = selectedAliens;
  }, [selectedAliens]);

  const [dialAlienIndex, setDialAlienIndex] = useState<number>(0);
  const [dialRotationAngle, setDialRotationAngle] = useState<number>(0);
  const [greenFlash, setGreenFlash] = useState<boolean>(false);
  const [heroTimeBanner, setHeroTimeBanner] = useState<boolean>(false);

  // Alien Selection 1.5s Splash Screen State (Per Alien and Global)
  const [alienSplashMap, setAlienSplashMap] = useState<Record<string, string>>({});
  const [selectedSplashAlienId, setSelectedSplashAlienId] = useState<string>('four_arms');
  const [selectionSplashUrl, setSelectionSplashUrl] = useState<string | null>(null);
  const [selectionSplashName, setSelectionSplashName] = useState<string | null>(null);
  const [alienSplashActive, setAlienSplashActive] = useState<boolean>(false);
  const [alienSplashTargetAlien, setAlienSplashTargetAlien] = useState<ContestantConfig | null>(null);

  // Battle Background Music (BGM) State
  const [bgMusicUrl, setBgMusicUrl] = useState<string>('/audio/battle_bgm.mp3');
  const [bgMusicName, setBgMusicName] = useState<string>('Default: Epic Battle');
  const [bgMusicEnabled, setBgMusicEnabled] = useState<boolean>(true);
  const [bgMusicVolume, setBgMusicVolume] = useState<number>(0.35);
  const [isPlayingMusicPreview, setIsPlayingMusicPreview] = useState<boolean>(false);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);

  const stripDataUrls = (list: ContestantConfig[]): ContestantConfig[] => {
    return list.map((c) => ({
      ...c,
      image_url: c.image_url && c.image_url.startsWith('data:') ? null : c.image_url,
      splash_image_url: c.splash_image_url && c.splash_image_url.startsWith('data:') ? null : c.splash_image_url,
    }));
  };

  const safeSaveLocalStorage = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`localStorage quota warning for ${key}`);
    }
  };

  // Restore saved splash image, BGM settings, custom alien stats & ball images
  useEffect(() => {
    const initStorageAndState = async () => {
      // 1. Purge legacy heavy base64 items out of localStorage into IndexedDB to free up localStorage immediately!
      try {
        const heavyKeys = [
          'arena_alien_ball_images',
          'arena_alien_splash_map',
          'arena_selection_splash_url',
          'arena_bg_music_url',
          'arena_active_contestants',
        ];
        for (const k of heavyKeys) {
          const val = localStorage.getItem(k);
          if (val && val.includes('data:')) {
            try {
              if (k === 'arena_active_contestants') {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) {
                  localStorage.setItem(k, JSON.stringify(stripDataUrls(parsed)));
                }
              } else if (k === 'arena_alien_ball_images' || k === 'arena_alien_splash_map') {
                const parsed = JSON.parse(val);
                await idbSet(k, parsed);
                localStorage.removeItem(k);
              } else {
                await idbSet(k, val);
                localStorage.removeItem(k);
              }
            } catch {}
          }
        }
      } catch {}

      // 2. Load splash map
      try {
        const idbSplashMap = await idbGet<Record<string, string>>('arena_alien_splash_map');
        const lsSplashMap = localStorage.getItem('arena_alien_splash_map');
        const map = idbSplashMap || (lsSplashMap ? JSON.parse(lsSplashMap) : null);
        if (map) setAlienSplashMap(map);
      } catch {}

      // 3. Load global selection splash
      try {
        const idbSplash = await idbGet<string>('arena_selection_splash_url');
        const lsSplash = localStorage.getItem('arena_selection_splash_url');
        const splash = idbSplash || lsSplash;
        const splashName = localStorage.getItem('arena_selection_splash_name');
        if (splash) {
          setSelectionSplashUrl(splash);
          setSelectionSplashName(splashName || 'Custom Splash Image');
        }
      } catch {}

      // 4. Load BGM
      try {
        const idbBgm = await idbGet<string>('arena_bg_music_url');
        const lsBgm = localStorage.getItem('arena_bg_music_url');
        const bgm = idbBgm || lsBgm;
        const bgmName = localStorage.getItem('arena_bg_music_name');
        if (bgm) {
          setBgMusicUrl(bgm);
          setBgMusicName(bgmName || 'Custom Battle BGM');
        }
      } catch {}

      const savedBgmEnabled = localStorage.getItem('arena_bg_music_enabled');
      if (savedBgmEnabled !== null) setBgMusicEnabled(savedBgmEnabled === 'true');
      const savedBgmVolume = localStorage.getItem('arena_bg_music_volume');
      if (savedBgmVolume !== null) setBgMusicVolume(Number(savedBgmVolume));

      // 5. Load Ball Images from IndexedDB (with fallback to localStorage)
      let imgMap: Record<string, string> = {};
      try {
        const idbImages = await idbGet<Record<string, string>>('arena_alien_ball_images');
        if (idbImages && typeof idbImages === 'object') {
          imgMap = idbImages;
        } else {
          const lsImages = localStorage.getItem('arena_alien_ball_images');
          if (lsImages) imgMap = JSON.parse(lsImages);
        }
      } catch {}

      // 6. Load Stat Customizations from both IndexedDB and localStorage
      let customsMap: Record<string, Partial<ContestantConfig>> = {};
      try {
        const idbCustoms = await idbGet<Record<string, Partial<ContestantConfig>>>('arena_alien_customizations');
        const lsCustoms = localStorage.getItem('arena_alien_customizations');
        const parsedLs = lsCustoms ? JSON.parse(lsCustoms) : null;
        customsMap = { ...(parsedLs || {}), ...(idbCustoms || {}) };
      } catch {}

      // Update in-memory BEN10_ALIEN_PRESETS
      BEN10_ALIEN_PRESETS.forEach((preset) => {
        const keyByName = preset.name.toLowerCase().replace(/\s+/g, '_');
        const customImg = imgMap[preset.id] || imgMap[keyByName];
        if (customImg) preset.image_url = customImg;
        const saved = customsMap[preset.id] || customsMap[keyByName];
        if (saved) {
          if (saved.starting_health !== undefined) preset.starting_health = saved.starting_health;
          if (saved.damage !== undefined) preset.damage = saved.damage;
          if (saved.speed !== undefined) preset.speed = saved.speed;
          if (saved.special_power !== undefined) preset.special_power = saved.special_power;
          if (saved.special_ability) {
            preset.special_ability = { ...preset.special_ability, ...saved.special_ability };
          }
        }
      });

      // Pre-cache into loadedImagesRef
      Object.values(imgMap).forEach((url) => {
        if (url) {
          const im = new Image();
          im.onload = () => drawFrame();
          im.src = url;
          loadedImagesRef.current.set(url, im);
        }
      });

      // 7. Restore active contestants (from IndexedDB first, then localStorage)
      let baseList: ContestantConfig[] = [];
      try {
        const idbActive = await idbGet<ContestantConfig[]>('arena_active_contestants');
        if (Array.isArray(idbActive) && idbActive.length > 0) {
          baseList = idbActive;
        } else {
          const savedActive = localStorage.getItem('arena_active_contestants');
          if (savedActive) {
            const parsed = JSON.parse(savedActive);
            if (Array.isArray(parsed) && parsed.length > 0) baseList = parsed;
          }
        }
      } catch {}

      if (baseList.length === 0) {
        baseList = BEN10_ALIEN_PRESETS.slice(0, 4).map((a) => ({ ...a }));
      }

      const restoredContestants = baseList.map((c, cIdx) => {
        const keyByName = c.name ? c.name.toLowerCase().replace(/\s+/g, '_') : '';
        const preset = BEN10_ALIEN_PRESETS.find(
          (p) => p.name?.toLowerCase() === c.name?.toLowerCase() || p.id === c.id
        );
        const canonicalId = preset?.id || '';
        const saved =
          (canonicalId && customsMap[canonicalId]) ||
          (keyByName && customsMap[keyByName]) ||
          (!c.id?.startsWith('fighter_') && customsMap[c.id]) ||
          null;

        const customImg =
          (canonicalId && imgMap[canonicalId]) ||
          (keyByName && imgMap[keyByName]) ||
          (!c.id?.startsWith('fighter_') && imgMap[c.id]) ||
          c.image_url;

        const mergedSpecial = saved?.special_ability
          ? { ...(preset?.special_ability || c.special_ability || {}), ...saved.special_ability }
          : (c.special_ability || preset?.special_ability);

        return {
          ...c,
          ...(saved || {}),
          image_url: customImg || c.image_url,
          starting_health: saved?.starting_health ?? c.starting_health ?? preset?.starting_health ?? 100,
          damage: saved?.damage ?? c.damage ?? preset?.damage ?? 25,
          speed: saved?.speed ?? c.speed ?? preset?.speed ?? 6.0,
          special_power: saved?.special_power ?? c.special_power ?? preset?.special_power ?? 'none',
          special_ability: mergedSpecial,
        };
      });

      setContestantCount(restoredContestants.length);
      setContestants(restoredContestants);
      isStorageInitializedRef.current = true;

      restoredContestants.forEach((c) => {
        if (c.image_url) {
          const im = new Image();
          im.onload = () => drawFrame();
          im.src = c.image_url;
          loadedImagesRef.current.set(c.image_url, im);
        }
      });
    };

    initStorageAndState();
  }, []);

  // Background Music Playback Functions
  const startBattleMusic = () => {
    if (!bgMusicEnabled || !soundEnabled) return;
    const targetUrl = bgMusicUrl || '/audio/battle_bgm.mp3';
    try {
      if (!bgmAudioRef.current || bgmAudioRef.current.src !== targetUrl) {
        if (bgmAudioRef.current) {
          bgmAudioRef.current.pause();
        }
        const audio = new Audio(targetUrl);
        audio.loop = true;
        audio.volume = Math.min(1, Math.max(0, bgMusicVolume));
        bgmAudioRef.current = audio;
      } else {
        bgmAudioRef.current.volume = Math.min(1, Math.max(0, bgMusicVolume));
      }
      bgmAudioRef.current.play().catch(() => {});
    } catch (err) {}
  };

  const pauseBattleMusic = () => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
    }
    setIsPlayingMusicPreview(false);
  };

  const stopBattleMusic = () => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
      bgmAudioRef.current.currentTime = 0;
    }
    setIsPlayingMusicPreview(false);
  };

  const toggleMusicPreview = () => {
    const targetUrl = bgMusicUrl || '/audio/battle_bgm.mp3';
    if (isPlayingMusicPreview) {
      if (bgmAudioRef.current) {
        bgmAudioRef.current.pause();
      }
      setIsPlayingMusicPreview(false);
    } else {
      if (bgmAudioRef.current) {
        bgmAudioRef.current.pause();
      }
      const audio = new Audio(targetUrl);
      audio.volume = Math.min(1, Math.max(0, bgMusicVolume));
      audio.onended = () => setIsPlayingMusicPreview(false);
      bgmAudioRef.current = audio;
      audio.play()
        .then(() => setIsPlayingMusicPreview(true))
        .catch(() => setIsPlayingMusicPreview(false));
    }
  };

  const handleBgMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cleanName = file.name.replace(/\.[^/.]+$/, '').trim();
    const blobUrl = URL.createObjectURL(file);

    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
    }
    setIsPlayingMusicPreview(false);

    setBgMusicUrl(blobUrl);
    setBgMusicName(`Custom: ${cleanName}`);
    setBgMusicEnabled(true);
    safeSaveLocalStorage('arena_bg_music_name', `Custom: ${cleanName}`);
    safeSaveLocalStorage('arena_bg_music_enabled', 'true');

    if (file.size < 15 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        await idbSet('arena_bg_music_url', dataUrl);
        setBgMusicUrl(dataUrl);
      };
      reader.readAsDataURL(file);
    }

    try {
      const fileExt = file.name.split('.').pop() || 'mp3';
      const fileName = `arena_bgm_${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('shorts').upload(fileName, file, {
        contentType: file.type || 'audio/mpeg',
        upsert: true,
      });
      if (!error && data) {
        const { data: publicData } = supabase.storage.from('shorts').getPublicUrl(fileName);
        if (publicData?.publicUrl) {
          setBgMusicUrl(publicData.publicUrl);
          safeSaveLocalStorage('arena_bg_music_url', publicData.publicUrl);
        }
      }
    } catch {}

    e.target.value = '';
  };

  const handleRemoveCustomMusic = async () => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
      bgmAudioRef.current = null;
    }
    setIsPlayingMusicPreview(false);
    setBgMusicUrl('/audio/battle_bgm.mp3');
    setBgMusicName('Default: Epic Battle');
    await idbDelete('arena_bg_music_url');
    localStorage.removeItem('arena_bg_music_url');
    localStorage.removeItem('arena_bg_music_name');
  };

  const handleSelectionSplashUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result as string;
      setSelectionSplashUrl(dataUrl);
      setSelectionSplashName(file.name);
      await idbSet('arena_selection_splash_url', dataUrl);
      safeSaveLocalStorage('arena_selection_splash_name', file.name);
    };
    reader.readAsDataURL(file);

    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `arena_splash_${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('shorts').upload(fileName, file, {
        contentType: file.type || 'image/png',
        upsert: true,
      });
      if (!error && data) {
        const { data: publicData } = supabase.storage.from('shorts').getPublicUrl(fileName);
        if (publicData?.publicUrl) {
          setSelectionSplashUrl(publicData.publicUrl);
          safeSaveLocalStorage('arena_selection_splash_url', publicData.publicUrl);
        }
      }
    } catch {}

    e.target.value = '';
  };

  const handleRemoveSplashImage = async () => {
    setSelectionSplashUrl(null);
    setSelectionSplashName(null);
    await idbDelete('arena_selection_splash_url');
    localStorage.removeItem('arena_selection_splash_url');
    localStorage.removeItem('arena_selection_splash_name');
  };

  const handleAlienSplashUpload = async (alienId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result as string;
      setAlienSplashMap((prev) => {
        const updated = { ...prev, [alienId]: dataUrl };
        idbSet('arena_alien_splash_map', updated);
        return updated;
      });

      setContestants((prev) =>
        prev.map((c) => (c.id === alienId || c.name.toLowerCase() === alienId.toLowerCase() ? { ...c, splash_image_url: dataUrl } : c))
      );
    };
    reader.readAsDataURL(file);

    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `arena_splash_${alienId}_${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('shorts').upload(fileName, file, {
        contentType: file.type || 'image/png',
        upsert: true,
      });
      if (!error && data) {
        const { data: publicData } = supabase.storage.from('shorts').getPublicUrl(fileName);
        if (publicData?.publicUrl) {
          setAlienSplashMap((prev) => {
            const updated = { ...prev, [alienId]: publicData.publicUrl };
            idbSet('arena_alien_splash_map', updated);
            return updated;
          });
        }
      }
    } catch {}

    e.target.value = '';
  };

  const handleRemoveAlienSplash = async (alienId: string) => {
    setAlienSplashMap((prev) => {
      const updated = { ...prev };
      delete updated[alienId];
      idbSet('arena_alien_splash_map', updated);
      return updated;
    });
    setContestants((prev) =>
      prev.map((c) => (c.id === alienId || c.name.toLowerCase() === alienId.toLowerCase() ? { ...c, splash_image_url: null } : c))
    );
  };

  const triggerAlienSplashPreview = (alienId: string) => {
    const target =
      BEN10_ALIEN_PRESETS.find((a) => a.id === alienId) ||
      contestants.find((c) => c.id === alienId) ||
      contestants[0] ||
      BEN10_ALIEN_PRESETS[0];

    const splash = alienSplashMap[target.id] || target.splash_image_url || target.image_url;
    setAlienSplashTargetAlien({ ...target, splash_image_url: splash });
    setAlienSplashActive(true);
    setTimeout(() => {
      setAlienSplashActive(false);
    }, 1000);
  };

  const triggerSplashPreview = () => {
    const target = selectedAliens[0] || contestants[0] || BEN10_ALIEN_PRESETS[0];
    const splash = alienSplashMap[target.id] || target.splash_image_url || selectionSplashUrl || target.image_url;
    setAlienSplashTargetAlien({ ...target, splash_image_url: splash });
    setAlienSplashActive(true);
    setTimeout(() => {
      setAlienSplashActive(false);
    }, 1000);
  };

  // Sync BGM with battle play state (Pauses immediately on victory)
  useEffect(() => {
    if (isPlaying && selectionPhase === 'battling' && !winner) {
      startBattleMusic();
    } else {
      pauseBattleMusic();
    }
  }, [isPlaying, selectionPhase, bgMusicEnabled, soundEnabled, winner]);

  useEffect(() => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.volume = Math.min(1, Math.max(0, bgMusicVolume));
    }
    safeSaveLocalStorage('arena_bg_music_volume', String(bgMusicVolume));
  }, [bgMusicVolume]);

  useEffect(() => {
    safeSaveLocalStorage('arena_bg_music_enabled', String(bgMusicEnabled));
    if (!bgMusicEnabled && bgmAudioRef.current) {
      bgmAudioRef.current.pause();
    } else if (bgMusicEnabled && isPlaying && selectionPhase === 'battling') {
      startBattleMusic();
    }
  }, [bgMusicEnabled]);

  useEffect(() => {
    return () => {
      if (bgmAudioRef.current) {
        bgmAudioRef.current.pause();
        bgmAudioRef.current = null;
      }
    };
  }, []);

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
    if (!isStorageInitializedRef.current) return;
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
      try {
        if (updated.length > 0) {
          const stripped = stripDataUrls(updated);
          safeSaveLocalStorage('arena_active_contestants', JSON.stringify(stripped));
          idbSet('arena_active_contestants', stripped).catch(() => {});
        }
      } catch {}
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

  const playSound = (
    type:
      | 'bounce'
      | 'hit'
      | 'heal'
      | 'item'
      | 'gun'
      | 'explosion'
      | 'victory'
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
      | 'acid_splatter',
    abilityType?: string,
    alienType?: string
  ) => {
    if (!soundEnabled) return;

    // User requested: Ben's voice removed for Hero Time (text banner only)
    if (type === 'hero_time') {
      return;
    }

    // Remap any generic ability event to authentic sound
    if (type === 'ability') {
      if (abilityType === 'speed' || alienType === 'xlr8') {
        type = 'wind_tornado';
      } else if (abilityType === 'shield' || alienType === 'diamondhead') {
        type = 'crystal_shatter';
      } else if (abilityType === 'freeze' || alienType === 'ghostfreak') {
        type = 'ghost_wail';
      } else if (alienType === 'ripjaws') {
        type = 'steel_bite';
      } else if (alienType === 'wildmutt') {
        type = 'predator_roar';
      } else if (alienType === 'stinkfly') {
        type = 'acid_splatter';
      } else {
        type = 'fireblast';
      }
    }

    if (
      type === 'omnitrix_open' ||
      type === 'omnitrix_turn' ||
      type === 'omnitrix_slam' ||
      type === 'fireblast' ||
      type === 'steel_bite' ||
      type === 'predator_roar' ||
      type === 'acid_splatter'
    ) {
      try {
        const audio = new Audio(`/audio/${type}.wav?v=${Date.now()}`);
        audio.volume = Math.min(1, soundVolume * 1.0);
        audio.play().catch(() => {});
      } catch (e) {}
      if (type !== 'fireblast') return;
    }

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
      } else if (type === 'sonic_clap') {
        // FOUR ARMS: SONIC CLAP & VIOLENT ARENA SHAKE
        screenShakeRef.current = 32;

        const oscCrack = ctx.createOscillator();
        const gainCrack = ctx.createGain();
        oscCrack.type = 'sawtooth';
        oscCrack.frequency.setValueAtTime(1400, ctx.currentTime);
        oscCrack.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.05);
        gainCrack.gain.setValueAtTime(0.85 * soundVolume, ctx.currentTime);
        gainCrack.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        oscCrack.connect(gainCrack);
        gainCrack.connect(ctx.destination);
        oscCrack.start();
        oscCrack.stop(ctx.currentTime + 0.05);

        const oscBoom = ctx.createOscillator();
        const gainBoom = ctx.createGain();
        oscBoom.type = 'triangle';
        oscBoom.frequency.setValueAtTime(130, ctx.currentTime);
        oscBoom.frequency.exponentialRampToValueAtTime(26, ctx.currentTime + 0.55);
        gainBoom.gain.setValueAtTime(1.0 * soundVolume, ctx.currentTime);
        gainBoom.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
        oscBoom.connect(gainBoom);
        gainBoom.connect(ctx.destination);
        oscBoom.start();
        oscBoom.stop(ctx.currentTime + 0.55);
      } else if (type === 'fireblast') {
        // HEATBLAST: ROARING BLAZING WHOOSH & FIRE CRACKLE SYNTHESIS FALLBACK
        const bufferSize = Math.round(ctx.sampleRate * 0.85);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          const t = i / ctx.sampleRate;
          const env = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) / 0.35);
          const noise = (Math.random() * 2 - 1);
          const pop = Math.random() < 0.015 ? (Math.random() * 2 - 1) * 0.8 : 0;
          data[i] = (noise * 0.7 + pop) * env;
        }
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(650, ctx.currentTime);
        filter.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 0.12);
        filter.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.85);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(1.0 * soundVolume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);

        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noiseSource.start();
        noiseSource.stop(ctx.currentTime + 0.85);

        // Low sub-bass flame roar
        const oscSub = ctx.createOscillator();
        const gainSub = ctx.createGain();
        oscSub.type = 'sawtooth';
        oscSub.frequency.setValueAtTime(110, ctx.currentTime);
        oscSub.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.6);
        gainSub.gain.setValueAtTime(0.4 * soundVolume, ctx.currentTime);
        gainSub.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        oscSub.connect(gainSub);
        gainSub.connect(ctx.destination);
        oscSub.start();
        oscSub.stop(ctx.currentTime + 0.6);
      } else if (type === 'wind_tornado') {
        // XLR8: HYPERSPEED CYCLONE TORNADO WIND ROAR (REALISTIC AIR TURBULENCE - NO TONAL BEEP)
        const bufferSize = Math.round(ctx.sampleRate * 0.85);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99765 * b0 + white * 0.0990460;
          b1 = 0.96300 * b1 + white * 0.2965164;
          b2 = 0.57000 * b2 + white * 1.0526913;
          const pink = b0 + b1 + b2 + white * 0.1848;
          data[i] = pink * 0.35 * Math.sin((i / bufferSize) * Math.PI);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const bpFilter = ctx.createBiquadFilter();
        bpFilter.type = 'bandpass';
        bpFilter.frequency.setValueAtTime(260, ctx.currentTime);
        bpFilter.frequency.linearRampToValueAtTime(920, ctx.currentTime + 0.3);
        bpFilter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.85);
        bpFilter.Q.setValueAtTime(4.2, ctx.currentTime);

        const windGain = ctx.createGain();
        windGain.gain.setValueAtTime(0.01, ctx.currentTime);
        windGain.gain.linearRampToValueAtTime(1.0 * soundVolume, ctx.currentTime + 0.15);
        windGain.gain.linearRampToValueAtTime(0.85 * soundVolume, ctx.currentTime + 0.45);
        windGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);

        noise.connect(bpFilter);
        bpFilter.connect(windGain);
        windGain.connect(ctx.destination);
        noise.start();
        noise.stop(ctx.currentTime + 0.85);

        // Low-frequency atmospheric vortex rumble
        const rumbleOsc = ctx.createOscillator();
        const rumbleGain = ctx.createGain();
        rumbleOsc.type = 'triangle';
        rumbleOsc.frequency.setValueAtTime(45, ctx.currentTime);
        rumbleOsc.frequency.linearRampToValueAtTime(75, ctx.currentTime + 0.3);
        rumbleOsc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.8);
        rumbleGain.gain.setValueAtTime(0.5 * soundVolume, ctx.currentTime);
        rumbleGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        rumbleOsc.connect(rumbleGain);
        rumbleGain.connect(ctx.destination);
        rumbleOsc.start();
        rumbleOsc.stop(ctx.currentTime + 0.8);
      } else if (type === 'crystal_shatter') {
        // DIAMONDHEAD: CRYSTAL SHATTER & BELL HARMONICS
        [1760, 2640, 3520].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.02);
          gain.gain.setValueAtTime(0.5 * soundVolume, ctx.currentTime + idx * 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.02 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.02);
          osc.stop(ctx.currentTime + idx * 0.02 + 0.35);
        });
      } else if (type === 'laser_beam') {
        // UPGRADE / GREY MATTER: HIGH-TECH OPTIC LASER ZAP
        const oscLaser = ctx.createOscillator();
        const gainLaser = ctx.createGain();
        oscLaser.type = 'sawtooth';
        oscLaser.frequency.setValueAtTime(2600, ctx.currentTime);
        oscLaser.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.16);
        gainLaser.gain.setValueAtTime(0.6 * soundVolume, ctx.currentTime);
        gainLaser.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
        oscLaser.connect(gainLaser);
        gainLaser.connect(ctx.destination);
        oscLaser.start();
        oscLaser.stop(ctx.currentTime + 0.16);
      } else if (type === 'cannon_roll') {
        // CANNONBOLT: HEAVY ARMORED RUMBLE & CRASH
        const oscRoll = ctx.createOscillator();
        const gainRoll = ctx.createGain();
        oscRoll.type = 'triangle';
        oscRoll.frequency.setValueAtTime(90, ctx.currentTime);
        oscRoll.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.45);
        gainRoll.gain.setValueAtTime(0.8 * soundVolume, ctx.currentTime);
        gainRoll.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        oscRoll.connect(gainRoll);
        gainRoll.connect(ctx.destination);
        oscRoll.start();
        oscRoll.stop(ctx.currentTime + 0.45);
      } else if (type === 'ghost_wail') {
        // GHOSTFREAK: SPECTRAL PHANTOM WAIL
        const oscGhost = ctx.createOscillator();
        const gainGhost = ctx.createGain();
        oscGhost.type = 'sine';
        oscGhost.frequency.setValueAtTime(840, ctx.currentTime);
        oscGhost.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.5);
        gainGhost.gain.setValueAtTime(0.55 * soundVolume, ctx.currentTime);
        gainGhost.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        oscGhost.connect(gainGhost);
        gainGhost.connect(ctx.destination);
        oscGhost.start();
        oscGhost.stop(ctx.currentTime + 0.5);
      } else if (type === 'acid_splatter') {
        // STINKFLY: ACID GOOP SPLATTER
        const oscAcid = ctx.createOscillator();
        const gainAcid = ctx.createGain();
        oscAcid.type = 'square';
        oscAcid.frequency.setValueAtTime(950, ctx.currentTime);
        oscAcid.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.15);
        gainAcid.gain.setValueAtTime(0.45 * soundVolume, ctx.currentTime);
        gainAcid.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        oscAcid.connect(gainAcid);
        gainAcid.connect(ctx.destination);
        oscAcid.start();
        oscAcid.stop(ctx.currentTime + 0.15);
      } else if (type === 'ability') {
        const oscPwr = ctx.createOscillator();
        const gainPwr = ctx.createGain();
        oscPwr.type = 'triangle';
        oscPwr.frequency.setValueAtTime(220, ctx.currentTime);
        oscPwr.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.3);
        gainPwr.gain.setValueAtTime(0.6 * soundVolume, ctx.currentTime);
        gainPwr.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        oscPwr.connect(gainPwr);
        gainPwr.connect(ctx.destination);
        oscPwr.start();
        oscPwr.stop(ctx.currentTime + 0.3);
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
      7200,
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

  // Helper: Live Health Bars below arena
  const drawLiveHealthBars = (ctx: CanvasRenderingContext2D, fighters: SimFighter[], width: number) => {
    const startY = ARENA_BOX.bottom + 25; // 1305
    const count = fighters.length;
    const isDual = count === 2;
    const colWidth = isDual ? width - 80 : 475;
    const leftX = isDual ? 40 : 35;
    const rightX = isDual ? 40 : width - colWidth - 35;
    const rows = Math.ceil(count / 2);
    const cardHeight = isDual ? 160 : Math.min(145, 570 / Math.max(rows, 2));

    fighters.forEach((f, idx) => {
      let x = leftX;
      let y = startY;

      if (isDual) {
        x = leftX;
        y = startY + 15 + idx * (cardHeight + 20);
      } else if (count === 3) {
        if (idx === 0) {
          x = leftX;
          y = startY;
        } else if (idx === 1) {
          x = rightX;
          y = startY;
        } else {
          x = (width - colWidth) / 2;
          y = startY + cardHeight + 20;
        }
      } else {
        const isRight = idx % 2 === 1;
        const row = Math.floor(idx / 2);
        x = isRight ? rightX : leftX;
        y = startY + row * (cardHeight + 16);
      }

      ctx.save();
      ctx.translate(x, y);

      const abilityStatus = getAbilityStatus(f);
      const isReady = abilityStatus.isReady;

      // Card Background (Dark Ben 10 Omnitrix Theme)
      ctx.beginPath();
      ctx.roundRect(0, 0, colWidth, cardHeight, 18);
      ctx.fillStyle = f.isDead ? 'rgba(5, 12, 8, 0.45)' : 'rgba(4, 18, 10, 0.94)';
      ctx.fill();
      ctx.lineWidth = f.isDead ? 1 : isReady ? 3.5 : 2;
      ctx.strokeStyle = f.isDead ? '#1e293b' : isReady ? '#00ff66' : f.color;
      if (isReady && !f.isDead) {
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 16;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Spherical Ball Avatar thumbnail
      const thumbSize = isDual ? cardHeight - 24 : cardHeight - 20;
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
        ctx.font = `900 ${isDual ? 36 : 26}px "Montserrat", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.name.charAt(0).toUpperCase(), thumbSize / 2, thumbSize / 2);
      }
      ctx.restore();

      // Thumbnail Border
      ctx.beginPath();
      ctx.arc(12 + thumbSize / 2, 12 + thumbSize / 2, thumbSize / 2, 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = f.isDead ? '#475569' : isReady ? '#00ff66' : f.color;
      ctx.stroke();

      const textX = thumbSize + (isDual ? 28 : 22);

      // Top Row: Alien Name & Live HP
      ctx.font = `900 ${isDual ? 28 : 20}px "Montserrat", sans-serif`;
      ctx.fillStyle = f.isDead ? '#64748b' : '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      let itemTag = '';
      if (f.bonusShield > 0 || f.hasShield) itemTag += ' [SHIELD]';
      if (f.hasDagger) itemTag += ' [2X DMG]';
      if (f.gunBullets > 0) itemTag += ` [BLASTER x${f.gunBullets}]`;
      if (f.speedBoostTimer > 0) itemTag += ' [SPEED]';
      if (f.frozenTimer > 0) itemTag += ' [FROZEN]';

      ctx.fillText(`${f.name}${itemTag}`, textX, isDual ? 14 : 10);

      // HP text
      ctx.font = `900 ${isDual ? 28 : 19}px "Montserrat", sans-serif`;
      ctx.fillStyle = f.isDead ? '#ef4444' : '#00ff66';
      ctx.textAlign = 'right';
      ctx.fillText(f.isDead ? 'ELIMINATED' : `${Math.round(f.health)} HP`, colWidth - 16, isDual ? 14 : 10);

      const barX = textX;
      const barW = colWidth - textX - 16;

      // 1. Health Bar Track
      const hpBarY = isDual ? 52 : 36;
      const hpBarH = isDual ? 16 : 12;
      ctx.beginPath();
      ctx.roundRect(barX, hpBarY, barW, hpBarH, hpBarH / 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.stroke();

      if (!f.isDead && f.health > 0) {
        const hpPct = Math.max(0, f.health / f.maxHealth);
        let hpColor = '#10b981';
        if (hpPct < 0.25) hpColor = '#ef4444';
        else if (hpPct < 0.5) hpColor = '#f59e0b';

        ctx.beginPath();
        ctx.roundRect(barX, hpBarY, barW * hpPct, hpBarH, hpBarH / 2);
        ctx.fillStyle = hpColor;
        ctx.shadowColor = hpColor;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 2. Middle Row: Damage Badge & Special Move Name
      const currentDmg = f.hasDagger ? Math.round((f.damage || 20) * 2) : Math.round(f.damage || 20);
      const dmgText = `DMG: ${currentDmg}${f.hasDagger ? ' [2X]' : ''}`;

      ctx.font = `900 ${isDual ? 20 : 13}px "Montserrat", sans-serif`;
      const dmgBadgeW = ctx.measureText(dmgText).width + (isDual ? 24 : 16);
      const midRowY = isDual ? 82 : 56;
      const badgeH = isDual ? 28 : 20;

      ctx.beginPath();
      ctx.roundRect(barX, midRowY, dmgBadgeW, badgeH, 6);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dmgText, barX + dmgBadgeW / 2, midRowY + badgeH / 2);

      // Special Ability Move Name Tag
      if (f.specialAbility) {
        ctx.font = `800 ${isDual ? 18 : 12}px "Montserrat", sans-serif`;
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`MOVE: ${f.specialAbility.name.toUpperCase()}`, colWidth - 16, midRowY + badgeH / 2);
      }

      // 3. Bottom Row: Special Ability Trigger Gauge & Readiness
      const energyRowY = isDual ? 122 : 84;
      const energyBarH = isDual ? 12 : 8;
      const gaugeLabel = abilityStatus.label;
      const gaugePct = abilityStatus.progress;

      // Label on left
      ctx.font = `900 ${isDual ? 16 : 11}px "Montserrat", sans-serif`;
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(gaugeLabel, barX, energyRowY + energyBarH / 2);

      // Bar in center
      const labelW = isDual ? Math.max(90, ctx.measureText(gaugeLabel).width + 16) : Math.max(65, ctx.measureText(gaugeLabel).width + 10);
      const valW = isDual ? 90 : 66;
      const chargeBarX = barX + labelW;
      const chargeBarW = colWidth - chargeBarX - valW;

      ctx.beginPath();
      ctx.roundRect(chargeBarX, energyRowY, chargeBarW, energyBarH, energyBarH / 2);
      ctx.fillStyle = 'rgba(0, 20, 10, 0.9)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0, 255, 102, 0.3)';
      ctx.stroke();

      if (!f.isDead && gaugePct > 0) {
        ctx.beginPath();
        ctx.roundRect(chargeBarX, energyRowY, chargeBarW * (Math.min(100, gaugePct) / 100), energyBarH, energyBarH / 2);
        ctx.fillStyle = isReady ? '#00ff66' : '#10b981';
        if (isReady) {
          ctx.shadowColor = '#00ff66';
          ctx.shadowBlur = 10;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Gauge text on right
      ctx.font = `900 ${isDual ? 20 : 13}px "Montserrat", sans-serif`;
      ctx.fillStyle = isReady ? '#00ff66' : '#a7f3d0';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      if (isReady) {
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 10;
      }
      ctx.fillText(isReady ? 'READY!' : `${gaugePct}%`, colWidth - 16, energyRowY + energyBarH / 2);
      ctx.shadowBlur = 0;

      ctx.restore();
    });
  };

  // 4. Draw Frame on Canvas (Uses SimFrameState)
  const drawFrame = (frameState?: SimFrameState | null) => {
    const canvases = [canvasRef.current, fullscreenCanvasRef.current].filter(Boolean) as HTMLCanvasElement[];
    if (canvases.length === 0) return;

    const sim = simResultRef.current;
    const current = frameState || (sim ? sim.frames[Math.min(sim.frames.length - 1, Math.floor(currentFrameRef.current))] : null);
    if (!current) return;
    const curFrame = currentFrameRef.current || 0;

    const { fighters, items, bullets, particles, floatingTexts, winner: frameWinner } = current;

    // Decay screen shake once per frame update (outside canvas loop so not double-decayed)
    if (current.screenShake) {
      screenShakeRef.current = Math.max(screenShakeRef.current, current.screenShake);
    }
    const currentShake = screenShakeRef.current;
    if (screenShakeRef.current > 0) {
      screenShakeRef.current = Math.max(0, screenShakeRef.current - 1.2);
    }

    canvases.forEach((canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = 1080;
      const height = 1920;
      const { x: cx, y: cy } = ARENA_CENTER;

      // Solid, clean 1080x1920 background
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

      // Top Headline: Cleanly positioned at y = 275 (below notch/badges and above arena)
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '900 64px "Montserrat", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 20;
      ctx.fillText(topic.toUpperCase() || 'ARENA CLASH', width / 2, 275);
      ctx.restore();

      // Dual Sided Healthbars below arena - ONLY shown after selection is completed!
      const activePhase = selectionPhaseRef.current;
      if (activePhase === 'hero_time' || activePhase === 'battling') {
        drawLiveHealthBars(ctx, fighters, width);
      }

      // Arena Shake Section: ONLY shake the battle arena
      ctx.save();
      if (currentShake > 0) {
        const ox = (Math.random() - 0.5) * currentShake;
        const oy = (Math.random() - 0.5) * currentShake;
        ctx.translate(ox, oy);
      }

      // Ben 10 Square Arena Floor (ARENA_BOX: 900x900)
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

      // Render Active Arena Ground Hazards (Heatblast 3s Arena Fire, etc.)
      if (current.hazardZones && current.hazardZones.length > 0) {
        current.hazardZones.forEach((hz) => {
          const isPersistent = hz.maxFrames >= 99999;
          const lifePct = isPersistent ? 1.0 : (hz.remainingFrames / hz.maxFrames);
          const alpha = isPersistent ? 1.0 : Math.min(1, lifePct * 1.3);

          if (hz.type === 'fire') {
            ctx.save();
            // 1. Fiery scorched ground glow aura
            const fireGrad = ctx.createRadialGradient(hz.x, hz.y, 0, hz.x, hz.y, hz.radius);
            fireGrad.addColorStop(0, `rgba(254, 240, 138, ${0.95 * alpha})`);
            fireGrad.addColorStop(0.35, `rgba(249, 115, 22, ${0.8 * alpha})`);
            fireGrad.addColorStop(0.7, `rgba(220, 38, 38, ${0.5 * alpha})`);
            fireGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = fireGrad;
            ctx.beginPath();
            ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
            ctx.fill();

            // 2. Animated dancing flame tongues licking upward
            const flameCount = 14;
            for (let i = 0; i < flameCount; i++) {
              const fAng = (i / flameCount) * Math.PI * 2 + Math.sin(curFrame * 0.15 + i) * 0.2;
              const fDist = (hz.radius * 0.6) + Math.cos(curFrame * 0.25 + i * 2) * (hz.radius * 0.3);
              const fx = hz.x + Math.cos(fAng) * fDist;
              const fy = hz.y + Math.sin(fAng) * fDist;
              const fSize = 12 + Math.sin(curFrame * 0.3 + i) * 6;

              ctx.beginPath();
              ctx.arc(fx, fy - (fSize * 0.8), fSize, 0, Math.PI * 2);
              ctx.fillStyle = i % 2 === 0 ? `rgba(250, 204, 21, ${0.85 * alpha})` : `rgba(239, 68, 68, ${0.85 * alpha})`;
              ctx.shadowColor = '#ea580c';
              ctx.shadowBlur = 18;
              ctx.fill();
            }

            // 3. Fiery perimeter boundary ring
            ctx.beginPath();
            ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(249, 115, 22, ${0.7 * alpha})`;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.restore();
          } else if (hz.type === 'crystals') {
            ctx.save();
            // Glowing emerald ground aura
            const grad = ctx.createRadialGradient(hz.x, hz.y, 0, hz.x, hz.y, hz.radius);
            grad.addColorStop(0, `rgba(52, 211, 153, ${0.5 * alpha})`);
            grad.addColorStop(0.7, `rgba(16, 185, 129, ${0.3 * alpha})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
            ctx.fill();

            // Center large crystal spire
            ctx.beginPath();
            ctx.moveTo(hz.x, hz.y - 36);
            ctx.lineTo(hz.x + 14, hz.y + 14);
            ctx.lineTo(hz.x, hz.y + 8);
            ctx.lineTo(hz.x - 14, hz.y + 14);
            ctx.closePath();
            ctx.fillStyle = `rgba(52, 211, 153, ${0.95 * alpha})`;
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 22;
            ctx.fill();

            // Surrounding sharp crystal spikes (rotating slowly)
            for (let i = 0; i < 7; i++) {
              const cAng = (i / 7) * Math.PI * 2 + (curFrame * 0.015);
              const cx = hz.x + Math.cos(cAng) * (hz.radius * 0.55);
              const cy = hz.y + Math.sin(cAng) * (hz.radius * 0.55);
              ctx.beginPath();
              ctx.moveTo(cx, cy - 26);
              ctx.lineTo(cx + 10, cy + 12);
              ctx.lineTo(cx - 10, cy + 12);
              ctx.closePath();
              ctx.fillStyle = `rgba(16, 185, 129, ${0.9 * alpha})`;
              ctx.shadowColor = '#10b981';
              ctx.shadowBlur = 16;
              ctx.fill();
            }
            ctx.restore();
          } else if (hz.type === 'vortex') {
            ctx.save();
            ctx.translate(hz.x, hz.y);
            ctx.rotate(curFrame * 0.2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.7 * alpha})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (let a = 0; a < Math.PI * 4; a += 0.2) {
              const r = (a / (Math.PI * 4)) * hz.radius;
              ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.stroke();
            ctx.restore();
          } else if (hz.type === 'acid') {
            ctx.save();
            ctx.fillStyle = `rgba(132, 204, 22, ${0.6 * alpha})`;
            ctx.shadowColor = '#84cc16';
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });
      }

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

      // Bullets (Custom Visual Projectiles for Ben 10 Attacks - Highly Visible & Vibrant)
      bullets.forEach((b) => {
        ctx.save();
        const bType = (b as any).bulletType || 'normal';
        const bAngle = Math.atan2(b.vy, b.vx);
        ctx.translate(b.x, b.y);
        ctx.rotate(bAngle);

        if (bType === 'fireball') {
          // Heatblast Blazing Fireball
          ctx.beginPath();
          ctx.moveTo(-35, 0);
          ctx.quadraticCurveTo(-15, -12, 10, -8);
          ctx.lineTo(16, 0);
          ctx.lineTo(10, 8);
          ctx.quadraticCurveTo(-15, 12, -35, 0);
          const fGrad = ctx.createLinearGradient(-35, 0, 16, 0);
          fGrad.addColorStop(0, 'rgba(234, 88, 12, 0)');
          fGrad.addColorStop(0.5, '#ea580c');
          fGrad.addColorStop(0.85, '#facc15');
          fGrad.addColorStop(1, '#ffffff');
          ctx.fillStyle = fGrad;
          ctx.shadowColor = '#ea580c';
          ctx.shadowBlur = 25;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(6, 0, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        } else if (bType === 'shockwave') {
          // Four Arms / Ghostfreak Sonic Shockwave Blast
          ctx.beginPath();
          ctx.arc(0, 0, 24, -Math.PI * 0.45, Math.PI * 0.45);
          ctx.strokeStyle = b.color;
          ctx.lineWidth = 8;
          ctx.shadowColor = b.color;
          ctx.shadowBlur = 24;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(-6, 0, 16, -Math.PI * 0.4, Math.PI * 0.4);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4;
          ctx.stroke();
        } else if (bType === 'laser') {
          // Upgrade Optic Plasma Laser Bolt
          ctx.beginPath();
          ctx.roundRect(-24, -7, 48, 14, 7);
          ctx.fillStyle = '#22c55e';
          ctx.shadowColor = '#22c55e';
          ctx.shadowBlur = 22;
          ctx.fill();

          ctx.beginPath();
          ctx.roundRect(-18, -3, 36, 6, 3);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        } else if (bType === 'beam') {
          // Grey Matter Solar Focus Ray
          ctx.beginPath();
          ctx.roundRect(-28, -8, 56, 16, 8);
          ctx.fillStyle = '#facc15';
          ctx.shadowColor = '#eab308';
          ctx.shadowBlur = 28;
          ctx.fill();

          ctx.beginPath();
          ctx.roundRect(-20, -3.5, 40, 7, 3.5);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        } else if (bType === 'shard') {
          // Diamondhead Crystal Taydenite Shard
          ctx.beginPath();
          ctx.moveTo(18, 0);
          ctx.lineTo(0, -9);
          ctx.lineTo(-18, 0);
          ctx.lineTo(0, 9);
          ctx.closePath();
          ctx.fillStyle = '#10b981';
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 20;
          ctx.fill();
          ctx.strokeStyle = '#a7f3d0';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(-12, 0);
          ctx.lineTo(12, 0);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (bType === 'acid') {
          // Stinkfly Toxic Acid Slime Glob
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.fillStyle = '#84cc16';
          ctx.shadowColor = '#84cc16';
          ctx.shadowBlur = 20;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(-4, -4, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#bef264';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(4, 3, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#4d7c0f';
          ctx.fill();
        } else {
          // Standard projectile
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fillStyle = b.color;
          ctx.shadowColor = b.color;
          ctx.shadowBlur = 18;
          ctx.fill();
        }

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
      } else if (currentPhase === 'selecting') {
        visibleFighters = fighters.slice(0, selectedAliensRef.current.length);
      } else {
        visibleFighters = [];
      }

      visibleFighters.forEach((f) => {
        if (f.isDead) return;

        const half = f.size / 2;
        const abilityStatus = getAbilityStatus(f);
        const isCharged = abilityStatus.isReady;
        const aType = getAlienType(f);
        const curFrame = currentFrameRef.current;

        ctx.save();
        ctx.translate(f.x, f.y);

        // ==========================================
        // 1. CHARACTER-SPECIFIC VISUAL EFFECTS (BEHIND / AROUND BALL)
        // ==========================================

        // --- HEATBLAST: ROARING PYRONITE FIRE & SOLAR EMBERS ---
        if (aType === 'heatblast') {
          ctx.save();
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

          // Forward Roaring Flamethrower Jet Cone when active!
          if (f.abilityAuraTimer > 0) {
            const moveAng = Math.atan2(f.vy, f.vx) || 0;
            ctx.save();
            ctx.rotate(moveAng);
            const flameLen = 220;
            ctx.beginPath();
            ctx.moveTo(half, -15);
            ctx.quadraticCurveTo(half + flameLen * 0.5, -50, half + flameLen, 0);
            ctx.quadraticCurveTo(half + flameLen * 0.5, 50, half, 15);
            ctx.closePath();
            const jetGrad = ctx.createLinearGradient(half, 0, half + flameLen, 0);
            jetGrad.addColorStop(0, 'rgba(255, 255, 220, 0.95)');
            jetGrad.addColorStop(0.35, 'rgba(250, 204, 21, 0.9)');
            jetGrad.addColorStop(0.7, 'rgba(234, 88, 12, 0.7)');
            jetGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');
            ctx.fillStyle = jetGrad;
            ctx.shadowColor = '#ea580c';
            ctx.shadowBlur = 35;
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
        }

        // --- FOUR ARMS: 4 RED MUSCULAR TETRAMAND ARMS WITH BLACK WRISTBANDS & FISTS ---
        else if (aType === 'four_arms') {
          ctx.save();
          const isAttacking = f.abilityAuraTimer > 0;
          // Clap animation: when active, arms slam inward towards center; otherwise subtle breathing flex
          const clapOffset = isAttacking ? Math.sin(curFrame * 0.5) * 16 : 0;
          const flexWave = Math.sin(curFrame * 0.14) * 3;

          const renderMuscularArm = (
            rootX: number,
            rootY: number,
            elbowX: number,
            elbowY: number,
            wristX: number,
            wristY: number,
            fistDirAngle: number
          ) => {
            ctx.save();

            // Broad shoulder deltoid pad connecting arm to ball
            ctx.beginPath();
            ctx.arc(rootX, rootY, 14, 0, Math.PI * 2);
            ctx.fillStyle = '#b91c1c';
            ctx.shadowColor = 'rgba(0,0,0,0.7)';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.strokeStyle = '#7f1d1d';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Thick muscular Bicep & Forearm path
            ctx.beginPath();
            ctx.moveTo(rootX, rootY - 10);
            ctx.quadraticCurveTo(
              (rootX + elbowX) / 2,
              elbowY - 14,
              elbowX,
              elbowY - 8
            );
            ctx.lineTo(wristX, wristY - 6);
            ctx.lineTo(wristX, wristY + 6);
            ctx.lineTo(elbowX, elbowY + 8);
            ctx.quadraticCurveTo(
              (rootX + elbowX) / 2,
              elbowY + 14,
              rootX,
              rootY + 10
            );
            ctx.closePath();

            const armGrad = ctx.createLinearGradient(rootX, rootY, wristX, wristY);
            armGrad.addColorStop(0, '#dc2626');
            armGrad.addColorStop(0.6, '#b91c1c');
            armGrad.addColorStop(1, '#991b1b');
            ctx.fillStyle = armGrad;
            ctx.fill();
            ctx.strokeStyle = '#7f1d1d';
            ctx.lineWidth = 3.5;
            ctx.stroke();

            // Muscle definition crease line
            ctx.beginPath();
            ctx.moveTo(rootX + (elbowX - rootX) * 0.3, rootY + (elbowY - rootY) * 0.3);
            ctx.lineTo(elbowX, elbowY);
            ctx.strokeStyle = '#7f1d1d';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Black Tetramand Wristband
            ctx.save();
            ctx.translate(wristX, wristY);
            ctx.rotate(fistDirAngle);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-5, -9, 10, 18);
            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-5, -9, 10, 18);

            // Crimson Clenched Fist
            ctx.beginPath();
            ctx.arc(8, 0, 12, 0, Math.PI * 2);
            ctx.fillStyle = '#dc2626';
            ctx.fill();
            ctx.strokeStyle = '#7f1d1d';
            ctx.lineWidth = 3;
            ctx.stroke();

            // 4 Distinct Knuckles
            ctx.fillStyle = '#ef4444';
            for (let kn = -6; kn <= 6; kn += 4) {
              ctx.beginPath();
              ctx.arc(15, kn, 3, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();

            ctx.restore();
          };

          // 1. Upper Left Arm (Shoulder top-left, curves UP and OUTWARD)
          renderMuscularArm(
            -half * 0.65,
            -half * 0.45,
            -half * 1.35 - flexWave + (isAttacking ? 20 : 0),
            -half * 0.85 + clapOffset,
            -half * 1.15 + (isAttacking ? 25 : 0),
            -half * 0.45 + clapOffset,
            Math.PI * 0.2
          );

          // 2. Lower Left Arm (Shoulder mid/lower-left, curves DOWN and OUTWARD)
          renderMuscularArm(
            -half * 0.8,
            half * 0.25,
            -half * 1.4 - flexWave + (isAttacking ? 20 : 0),
            half * 0.65 - clapOffset,
            -half * 1.15 + (isAttacking ? 25 : 0),
            half * 0.85 - clapOffset,
            -Math.PI * 0.2
          );

          // 3. Upper Right Arm (Shoulder top-right, curves UP and OUTWARD)
          renderMuscularArm(
            half * 0.65,
            -half * 0.45,
            half * 1.35 + flexWave - (isAttacking ? 20 : 0),
            -half * 0.85 + clapOffset,
            half * 1.15 - (isAttacking ? 25 : 0),
            -half * 0.45 + clapOffset,
            Math.PI * 0.8
          );

          // 4. Lower Right Arm (Shoulder mid/lower-right, curves DOWN and OUTWARD)
          renderMuscularArm(
            half * 0.8,
            half * 0.25,
            half * 1.4 + flexWave - (isAttacking ? 20 : 0),
            half * 0.65 - clapOffset,
            half * 1.15 - (isAttacking ? 25 : 0),
            half * 0.85 - clapOffset,
            -Math.PI * 0.8
          );

          // Sonic Shockwave effect rings when Four Arms is clapping
          if (isAttacking) {
            const shockProgress = (60 - f.abilityAuraTimer) / 60;
            const shockR = half + Math.max(10, shockProgress * 240);
            ctx.beginPath();
            ctx.arc(0, 0, shockR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(220, 38, 38, ${Math.max(0, 1 - shockProgress)})`;
            ctx.lineWidth = 10;
            ctx.shadowColor = '#dc2626';
            ctx.shadowBlur = 35;
            ctx.stroke();

            // Inner bright white sonic shockwave
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(0, shockR - 16), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, 0.9 * (1 - shockProgress))})`;
            ctx.lineWidth = 5;
            ctx.stroke();
          }

          ctx.restore();
        }

        // --- XLR8: HIGH-SPEED CYAN DASH TRAILS & WIND FUNNEL ---
        else if (aType === 'xlr8') {
          const spd = Math.hypot(f.vx, f.vy);
          const moveAng = Math.atan2(f.vy, f.vx);
          const trailLen = Math.min(110, spd * 7 + 35);
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

          // Wind Funnel Tornado cyclone vortex when active!
          if (f.abilityAuraTimer > 0 || f.speedBoostTimer > 0) {
            ctx.save();
            const spin = curFrame * 0.45;
            for (let w = 0; w < 4; w++) {
              const wAngle = spin + (w * Math.PI * 2) / 4;
              ctx.beginPath();
              ctx.arc(0, 0, half + 18 + w * 14, wAngle, wAngle + Math.PI * 0.75);
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 6;
              ctx.shadowColor = '#00f0ff';
              ctx.shadowBlur = 24;
              ctx.stroke();
            }
            ctx.restore();
          }
          ctx.restore();
        }

        // --- DIAMONDHEAD: SHARP TAYDENITE CRYSTAL SPIRES & FACETS ---
        else if (aType === 'diamondhead') {
          ctx.save();
          const crystalShards = [
            { angle: -Math.PI / 2, length: half * 0.7, width: 22 },
            { angle: -Math.PI / 2 - 0.45, length: half * 0.58, width: 18 },
            { angle: -Math.PI / 2 + 0.45, length: half * 0.58, width: 18 },
            { angle: -Math.PI + 0.35, length: half * 0.48, width: 16 },
            { angle: -0.35, length: half * 0.48, width: 16 },
            { angle: -Math.PI + 0.85, length: half * 0.38, width: 14 },
            { angle: -0.85, length: half * 0.38, width: 14 },
            { angle: Math.PI / 2, length: half * 0.45, width: 16 },
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

          // Rotating Hexagonal Taydenite Crystal Prism Shield when active!
          if (f.abilityAuraTimer > 0 || f.bonusShield > 0) {
            ctx.save();
            const shieldSpin = curFrame * 0.04;
            const shieldR = half + 26;
            ctx.beginPath();
            for (let i = 0; i <= 6; i++) {
              const ang = shieldSpin + (i / 6) * Math.PI * 2;
              const px = Math.cos(ang) * shieldR;
              const py = Math.sin(ang) * shieldR;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.strokeStyle = '#6ee7b7';
            ctx.lineWidth = 5;
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 25;
            ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();
        }

        // --- CANNONBOLT: JAGGED SHARP SILVER & YELLOW ARMOR SHELL ---
        else if (aType === 'cannonbolt') {
          ctx.save();
          // Cannonbolt: when special ability is active, the armor spikes rotate/spin!
          const isSpecialActive = f.abilityAuraTimer > 0;
          const spinOffset = isSpecialActive ? (curFrame * 0.38) : 0;
          const numPlates = 14;
          ctx.beginPath();
          for (let i = 0; i <= numPlates; i++) {
            const baseAngle = spinOffset + (i / numPlates) * Math.PI * 2;
            const midAngle = baseAngle + Math.PI / numPlates;
            const outerR = half + (isSpecialActive ? 26 : 18);
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
          silverGrad.addColorStop(0.35, isSpecialActive ? '#fef08a' : '#cbd5e1');
          silverGrad.addColorStop(0.7, isSpecialActive ? '#f59e0b' : '#64748b');
          silverGrad.addColorStop(1, isSpecialActive ? '#b45309' : '#334155');
          ctx.fillStyle = silverGrad;
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = isSpecialActive ? 30 : 18;
          ctx.fill();
          ctx.lineWidth = isSpecialActive ? 4 : 3;
          ctx.strokeStyle = isSpecialActive ? '#fbbf24' : '#fef08a';
          ctx.stroke();

          // Shell rivet studs (spinning in sync with the armor shell)
          for (let i = 0; i < numPlates; i++) {
            const rAng = spinOffset + (i / numPlates) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(Math.cos(rAng) * (half + (isSpecialActive ? 10 : 6)), Math.sin(rAng) * (half + (isSpecialActive ? 10 : 6)), isSpecialActive ? 4 : 3, 0, Math.PI * 2);
            ctx.fillStyle = '#f59e0b';
            ctx.fill();
          }

          // Heavy Kinetic Impact Forcefield with spinning outer blades when active!
          if (isSpecialActive) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, half + 30, 0, Math.PI * 2);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 6;
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 32;
            ctx.setLineDash([16, 10]);
            ctx.lineDashOffset = -curFrame * 8;
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();
        }

        // --- WILDMUTT: VULPIMANCER GILLS, SALIVA DROOL & SONAR PULSE ---
        else if (aType === 'wildmutt') {
          ctx.save();
          // Neck Sensory Gills (3 on left, 3 on right)
          for (let side of [-1, 1]) {
            for (let g = 0; g < 3; g++) {
              const gy = (g - 1) * 10;
              ctx.beginPath();
              ctx.ellipse(side * (half - 8), gy, 4, 8, side * 0.2, 0, Math.PI * 2);
              ctx.fillStyle = f.abilityAuraTimer > 0 ? '#ef4444' : '#c2410c';
              ctx.shadowColor = '#ea580c';
              ctx.shadowBlur = f.abilityAuraTimer > 0 ? 14 : 4;
              ctx.fill();
            }
          }

          // Saliva drool droplets trailing from lower jaw
          const droolY = half + 4 + Math.sin(curFrame * 0.2) * 6;
          ctx.beginPath();
          ctx.arc(0, droolY, 3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(254, 215, 170, 0.8)';
          ctx.fill();

          // Expanding Sonar Radar Detection Pulses & Razor Claw arcs when hunting
          if (f.abilityAuraTimer > 0) {
            ctx.save();
            for (let p = 0; p < 2; p++) {
              const pulseR = half + ((curFrame + p * 12) % 24) * 5;
              ctx.beginPath();
              ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(249, 115, 22, ${1 - (((curFrame + p * 12) % 24) / 24)})`;
              ctx.lineWidth = 5;
              ctx.shadowColor = '#ea580c';
              ctx.shadowBlur = 20;
              ctx.stroke();
            }
            ctx.restore();
          }
          ctx.restore();
        }

        // --- RIPJAWS: LUMINESCENT ANGLER LURE & RAZOR STEEL JAWS ---
        else if (aType === 'ripjaws') {
          ctx.save();
          // Luminescent Angler Antenna & Glowing Orb
          const lureWave = Math.sin(curFrame * 0.15) * 8;
          ctx.beginPath();
          ctx.moveTo(0, -half);
          ctx.quadraticCurveTo(lureWave * 1.5, -half - 24, lureWave, -half - 38);
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 3.5;
          ctx.stroke();

          // Glowing Angler Light Orb
          ctx.beginPath();
          ctx.arc(lureWave, -half - 38, 7, 0, Math.PI * 2);
          ctx.fillStyle = '#67e8f9';
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 20;
          ctx.fill();

          // Lower Razor-Sharp Steel Jaws
          const numTeeth = 7;
          ctx.beginPath();
          for (let i = 0; i <= numTeeth; i++) {
            const tAngle = Math.PI * 0.25 + (i / numTeeth) * (Math.PI * 0.5);
            const tx = Math.cos(tAngle) * (half + 8);
            const ty = Math.sin(tAngle) * (half + 8);
            if (i === 0) ctx.moveTo(tx, ty);
            else ctx.lineTo(tx, ty);
            const innerX = Math.cos(tAngle + 0.05) * half;
            const innerY = Math.sin(tAngle + 0.05) * half;
            ctx.lineTo(innerX, innerY);
          }
          ctx.fillStyle = '#f8fafc';
          ctx.shadowColor = '#0891b2';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.strokeStyle = '#0e7490';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Active Giant Snapping Steel Jaws when attacking!
          if (f.abilityAuraTimer > 0) {
            ctx.save();
            const biteCycle = Math.abs(Math.sin(curFrame * 0.45)) * 24;
            ctx.beginPath();
            ctx.arc(0, -biteCycle, half + 14, Math.PI * 1.1, Math.PI * 1.9);
            ctx.strokeStyle = '#67e8f9';
            ctx.lineWidth = 6;
            ctx.shadowColor = '#06b6d4';
            ctx.shadowBlur = 22;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, biteCycle, half + 14, Math.PI * 0.1, Math.PI * 0.9);
            ctx.strokeStyle = '#67e8f9';
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();
        }

        // --- UPGRADE: GALVANIC MECHAMORPH CIRCUIT LINES & OPTIC EYE ---
        else if (aType === 'upgrade') {
          ctx.save();
          // Neon Green Circuit Traces radiating outward
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#22c55e';
          ctx.shadowBlur = 10;
          for (let i = 0; i < 6; i++) {
            const cAng = (i / 6) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(cAng) * (half * 0.3), Math.sin(cAng) * (half * 0.3));
            ctx.lineTo(Math.cos(cAng) * (half * 0.7), Math.sin(cAng) * (half * 0.7));
            ctx.lineTo(Math.cos(cAng + 0.2) * (half + 6), Math.sin(cAng + 0.2) * (half + 6));
            ctx.stroke();
          }

          // Central Optic Mechamorph Eye
          const eyePulse = Math.sin(curFrame * 0.18) * 3;
          ctx.beginPath();
          ctx.arc(0, 0, 14 + eyePulse, 0, Math.PI * 2);
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#4ade80';
          ctx.shadowColor = '#22c55e';
          ctx.shadowBlur = 16;
          ctx.fill();

          // Optic targeting plasma laser beam when active!
          if (f.abilityAuraTimer > 0) {
            ctx.save();
            const moveAng = Math.atan2(f.vy, f.vx) || 0;
            ctx.rotate(moveAng);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(260, 0);
            ctx.strokeStyle = '#00ff66';
            ctx.lineWidth = 9;
            ctx.shadowColor = '#00ff66';
            ctx.shadowBlur = 28;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(260, 0);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3.5;
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();
        }

        // --- GHOSTFREAK: GHOSTLY WISPY TAIL, AZMUTH CHAINS & INTANGIBILITY ---
        else if (aType === 'ghostfreak') {
          ctx.save();
          const spd = Math.hypot(f.vx, f.vy);
          const tailAngle = spd > 0.5 ? Math.atan2(f.vy, f.vx) + Math.PI : Math.PI / 2;

          ctx.save();
          ctx.rotate(tailAngle);
          const tailLength = half * 1.6;
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

          // Azmuth Containment Chains
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, half - 4, Math.PI * 0.2, Math.PI * 0.8);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, half - 4, Math.PI * 1.2, Math.PI * 1.8);
          ctx.stroke();

          // Spectral Phasing & Intangible Ectoplasm when active!
          if (f.invulnerableTimer > 0 || f.abilityAuraTimer > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, half + 22, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(168, 85, 247, 0.35)';
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 32;
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
        }

        // --- GREY MATTER: GALVAN INTELLECT CIRCLING PULSES & SUN GUN ---
        else if (aType === 'grey_matter') {
          ctx.save();
          // Inner revolving Galvan tech circuit ring (Emerald Green)
          ctx.save();
          ctx.rotate(curFrame * 0.04);
          ctx.beginPath();
          ctx.arc(0, 0, half + 8, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.75)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([10, 8]);
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 14;
          ctx.stroke();

          // 3 orbiting Galvan intellect micro-nodes
          for (let m = 0; m < 3; m++) {
            const ang = (m / 3) * Math.PI * 2;
            const nx = Math.cos(ang) * (half + 8);
            const ny = Math.sin(ang) * (half + 8);
            ctx.beginPath();
            ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = '#6ee7b7';
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 10;
            ctx.fill();
          }
          ctx.restore();

          // Outer counter-revolving Solar Intellect ring (Golden Yellow)
          ctx.save();
          ctx.rotate(-curFrame * 0.03);
          ctx.beginPath();
          ctx.arc(0, 0, half + 16, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.shadowColor = '#eab308';
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.restore();

          // Solar focus death ray halo & concentrated beam when active!
          if (f.abilityAuraTimer > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, half + 26, 0, Math.PI * 2);
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 6;
            ctx.shadowColor = '#eab308';
            ctx.shadowBlur = 32;
            ctx.stroke();

            // Concentrated Galvan Solar Beam ahead
            const moveAng = Math.atan2(f.vy, f.vx) || 0;
            ctx.rotate(moveAng);
            ctx.beginPath();
            ctx.moveTo(half, 0);
            ctx.lineTo(half + 160, 0);
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 8;
            ctx.shadowColor = '#fde047';
            ctx.shadowBlur = 25;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(half, 0);
            ctx.lineTo(half + 160, 0);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
          }
          ctx.restore();
        }

        // --- STINKFLY: BUG WINGS, EYE DUCTS & TAIL BLADE ---
        else if (aType === 'stinkfly') {
          ctx.save();
          const wingFlap = Math.sin(curFrame * 0.6) * 14;

          // 2 Translucent Upper Bug Wings
          ctx.beginPath();
          ctx.ellipse(-half * 0.45, -half * 0.8 - wingFlap * 0.4, 24, 10, -Math.PI * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(217, 249, 157, 0.65)';
          ctx.strokeStyle = '#84cc16';
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.ellipse(half * 0.45, -half * 0.8 - wingFlap * 0.4, 24, 10, Math.PI * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(217, 249, 157, 0.65)';
          ctx.strokeStyle = '#84cc16';
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();

          // Tail Blade Stinger at the bottom
          ctx.beginPath();
          ctx.moveTo(-6, half - 2);
          ctx.lineTo(0, half + 22);
          ctx.lineTo(6, half - 2);
          ctx.closePath();
          ctx.fillStyle = '#65a30d';
          ctx.fill();
          ctx.strokeStyle = '#365314';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Bubbling Toxic Acid slime spray when active!
          if (f.abilityAuraTimer > 0) {
            ctx.save();
            for (let b = 0; b < 6; b++) {
              const bAngle = (b / 6) * Math.PI * 2 + curFrame * 0.18;
              const bDist = half + 14 + (b % 3) * 8;
              ctx.beginPath();
              ctx.arc(Math.cos(bAngle) * bDist, Math.sin(bAngle) * bDist, 6, 0, Math.PI * 2);
              ctx.fillStyle = '#bef264';
              ctx.shadowColor = '#84cc16';
              ctx.shadowBlur = 16;
              ctx.fill();
            }
            ctx.restore();
          }
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
        if (aType === 'ghostfreak' && (f.invulnerableTimer > 0 || f.abilityAuraTimer > 0)) {
          ctx.globalAlpha = 0.38;
        }
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
        // 3. DISTINCT NAME BADGE DIRECTLY BELOW BALL
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
        if (f.goopTrappedTimer && f.goopTrappedTimer > 0) itemBadge += 'GOOP TRAPPED ';
        else if (f.frozenTimer > 0) itemBadge += 'FROZEN ';
        if (f.bleedTimer && f.bleedTimer > 0) itemBadge += 'BLEEDING ';
        if (isCharged) itemBadge += 'READY';

        if (f.bleedTimer && f.bleedTimer > 0) {
          ctx.save();
          const bleedPulse = 0.5 + 0.5 * Math.sin(curFrame * 0.4);
          ctx.beginPath();
          ctx.arc(0, 0, half + 4, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + bleedPulse * 0.5})`;
          ctx.lineWidth = 4;
          ctx.shadowColor = '#dc2626';
          ctx.shadowBlur = 14;
          ctx.stroke();

          // Blood droplet indicator
          ctx.beginPath();
          ctx.arc(half * 0.65, -half * 0.65, 5 + bleedPulse * 2, 0, Math.PI * 2);
          ctx.fillStyle = '#dc2626';
          ctx.shadowColor = '#7f1d1d';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.restore();
        }

        if (f.goopTrappedTimer && f.goopTrappedTimer > 0) {
          ctx.save();
          const goopPulse = 0.5 + 0.5 * Math.sin(curFrame * 0.35);
          ctx.beginPath();
          ctx.arc(0, 0, half + 5, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(132, 204, 22, ${0.6 + goopPulse * 0.4})`;
          ctx.lineWidth = 5;
          ctx.shadowColor = '#84cc16';
          ctx.shadowBlur = 18;
          ctx.stroke();

          // Sticky slime drops on ball perimeter
          for (let s = 0; s < 4; s++) {
            const sAng = (s / 4) * Math.PI * 2 + curFrame * 0.05;
            ctx.beginPath();
            ctx.arc(Math.cos(sAng) * (half + 4), Math.sin(sAng) * (half + 4), 4.5, 0, Math.PI * 2);
            ctx.fillStyle = '#bef264';
            ctx.shadowColor = '#84cc16';
            ctx.shadowBlur = 10;
            ctx.fill();
          }
          ctx.restore();
        }

        if (itemBadge) {
          ctx.font = 'bold 15px "Montserrat", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = (f.bleedTimer && f.bleedTimer > 0) ? '#ef4444' : '#00ff66';
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

      // End Arena Shake Section
      ctx.restore();

      // Victory Overlay: ONLY SHOWN WHEN frameWinner IS PRESENT! (NO EMOJIS)
      if (frameWinner) {
        pauseBattleMusic();
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
              playSound(ev.sound === 'winner' ? 'victory' : ev.sound, ev.abilityType, ev.alienType);
            }
          }
          lastSoundFrameRef.current = nextFrame;
        }

        const curFrameState = sim.frames[nextFrame];
        if (curFrameState) {
          setAliveCount(curFrameState.aliveCount);
          if (curFrameState.winner && !winner) {
            setWinner(curFrameState.winner as any);
            pauseBattleMusic();
          }
        }

        if (nextFrame >= sim.frames.length - 1) {
          setIsPlaying(false);
          pauseBattleMusic();
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
      playSound('omnitrix_open');
      setSelectionPhase('selecting');
      setCurrentSelectingIndex(0);
      setSelectedAliens([]);
      setDialAlienIndex(0);
      setDialRotationAngle(0);
    }
  };

  const handleRotateAlien = (direction: 'next' | 'prev', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playSound('omnitrix_turn');
    const roster = BEN10_ALIEN_PRESETS;
    const rosterLen = roster.length;
    setDialAlienIndex((prev) => (direction === 'next' ? (prev + 1) % rosterLen : (prev - 1 + rosterLen) % rosterLen));
    setDialRotationAngle((prev) => prev + (direction === 'next' ? 45 : -45));
  };

  const handleCenterSlam = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (selectionPhase !== 'selecting') return;

    playSound('omnitrix_slam');
    setGreenFlash(true);

    const roster = BEN10_ALIEN_PRESETS;
    const chosen = roster[dialAlienIndex % roster.length];
    const newSelected = [...selectedAliens, chosen];
    setSelectedAliens(newSelected);

    if (chosen.image_url) {
      let img = loadedImagesRef.current.get(chosen.image_url);
      if (!img) {
        img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => drawFrame();
        img.src = chosen.image_url;
        loadedImagesRef.current.set(chosen.image_url, img);
      }
    }

    // Sync fighter at currentSelectingIndex in current simulation
    if (simResultRef.current) {
      const aType = getAlienType(chosen);
      const sizeMultiplier = ALIEN_SIZE_SCALES[aType] || 1.0;
      const baseSize = getFighterSize(contestantCount);
      const individualSize = Math.round(baseSize * sizeMultiplier);
      simResultRef.current.frames.forEach((fr) => {
        if (fr.fighters[currentSelectingIndex]) {
          fr.fighters[currentSelectingIndex].name = chosen.name;
          fr.fighters[currentSelectingIndex].color = chosen.color;
          fr.fighters[currentSelectingIndex].image_url = chosen.image_url;
          fr.fighters[currentSelectingIndex].size = individualSize;
          if (chosen.special_ability) {
            fr.fighters[currentSelectingIndex].specialAbility = chosen.special_ability;
          }
        }
      });
    }

    // Show 1-Second Fullscreen Alien Splash Screen (per alien)
    const splash = alienSplashMap[chosen.id] || chosen.splash_image_url || chosen.image_url;
    setAlienSplashTargetAlien({ ...chosen, splash_image_url: splash });
    setAlienSplashActive(true);

    const nextIndex = currentSelectingIndex + 1;

    setTimeout(() => {
      setAlienSplashActive(false);
      setGreenFlash(false);

      if (nextIndex < contestantCount) {
        // More players to select (e.g. Player 2, Player 3, Player 4...)
        setCurrentSelectingIndex(nextIndex);
        setDialAlienIndex((prev) => (prev + 1) % roster.length);
        setDialRotationAngle(0);
        drawFrame();
      } else {
        // ALL contestantCount players have been selected!
        const matchContestants: ContestantConfig[] = newSelected.map((chosenAlien, idx) => {
          const custom =
            BEN10_ALIEN_PRESETS.find(
              (p) => p.name?.toLowerCase() === chosenAlien.name?.toLowerCase() || p.id === chosenAlien.id
            ) ||
            contestants.find(
              (c) => c.name?.toLowerCase() === chosenAlien.name?.toLowerCase() || c.id === chosenAlien.id
            ) ||
            chosenAlien;

          const ability = custom?.special_ability || chosenAlien.special_ability;

          return {
            ...chosenAlien,
            ...custom,
            id: `fighter_${idx + 1}`,
            name: chosenAlien.name,
            color: chosenAlien.color,
            image_url: chosenAlien.image_url || custom.image_url,
            starting_health: custom.starting_health ?? chosenAlien.starting_health,
            damage: custom.damage ?? chosenAlien.damage,
            speed: custom.speed ?? chosenAlien.speed,
            special_power: custom.special_power ?? chosenAlien.special_power,
            special_ability: ability,
          };
        });

        setContestants(matchContestants);
        try {
          const stripped = stripDataUrls(matchContestants);
          safeSaveLocalStorage('arena_active_contestants', JSON.stringify(stripped));
          idbSet('arena_active_contestants', stripped).catch(() => {});
        } catch {}
        setAliveCount(matchContestants.length);

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
          7200,
          battleSeedRef.current
        );
        simResultRef.current = sim;
        currentFrameRef.current = 0;
        lastSoundFrameRef.current = -1;
        setWinner(null);

        // Show "It's Hero Time!" banner without Ben's voice!
        setSelectionPhase('hero_time');
        setHeroTimeBanner(true);
        drawFrame();

        // User requirement: When the "It's Hero Time!" text leaves, start the battle!
        setTimeout(() => {
          setHeroTimeBanner(false);
          setSelectionPhase('battling');
          setIsPlaying(true);
          startBattleMusic();
          drawFrame();
        }, 1500);
      }
    }, 1000);
  };

  const resetSimulation = () => {
    setIsPlaying(false);
    stopBattleMusic();
    setAlienSplashActive(false);
    setSelectionPhase('idle');
    setSelectedAliens([]);
    setCurrentSelectingIndex(0);
    setDialAlienIndex(0);
    setDialRotationAngle(0);
    setHeroTimeBanner(false);
    setGreenFlash(false);
    screenShakeRef.current = 0;
    currentFrameRef.current = 0;
    lastSoundFrameRef.current = -1;
    setWinner(null);
    initSimulation(true);
  };

  const handlePlayToggle = () => {
    const sim = simResultRef.current;
    if (selectionPhase === 'selecting') {
      handleCenterSlam();
      return;
    }
    if (!isPlaying) {
      if (sim && currentFrameRef.current >= sim.frames.length - 1) {
        currentFrameRef.current = 0;
        lastSoundFrameRef.current = -1;
        setWinner(null);
      }
      if (selectionPhase === 'idle') {
        setSelectionPhase('battling');
      }
      setIsPlaying(true);
      startBattleMusic();
    } else {
      setIsPlaying(false);
      pauseBattleMusic();
    }
  };

  const availableRoster = BEN10_ALIEN_PRESETS;
  const currentDialAlien = availableRoster[dialAlienIndex % availableRoster.length];

  const renderOmnitrixOverlay = () => {
    return (
      <>
        {/* Idle Screen Tap Indicator */}
        {selectionPhase === 'idle' && !isPlaying && !winner && (!simResultRef.current?.frames[Math.floor(currentFrameRef.current)]?.winner) && (
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
        {selectionPhase === 'selecting' && (
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
                title={`Click Center to Select Alien for Player ${currentSelectingIndex + 1}`}
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

            {/* Selecting Player Number Badge */}
            <div className="mt-3 px-4 py-1 rounded-full bg-black/95 border-2 border-emerald-400 text-emerald-300 font-black text-xs tracking-widest uppercase shadow-[0_0_15px_rgba(0,255,102,0.5)] flex items-center gap-2">
              <span>PLAYER {currentSelectingIndex + 1} OF {contestantCount}</span>
            </div>

            {/* Clean Alien Name Tag Below */}
            {currentDialAlien && (
              <div
                className="mt-1.5 px-5 py-1.5 rounded-full bg-black/95 border-2 text-white font-black text-sm tracking-wider whitespace-nowrap shadow-2xl flex items-center gap-2"
                style={{
                  borderColor: currentDialAlien.color || '#00ff66',
                  boxShadow: `0 0 20px ${currentDialAlien.color || '#00ff66'}90`,
                }}
              >
                <span>{currentDialAlien.name}</span>
              </div>
            )}

            {/* Player Selection Progress Dots */}
            <div className="flex items-center gap-2 mt-2">
              {Array.from({ length: contestantCount }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i < currentSelectingIndex
                      ? 'bg-emerald-400 shadow-[0_0_8px_#00ff66]'
                      : i === currentSelectingIndex
                      ? 'bg-white border-2 border-emerald-400 scale-125 animate-pulse'
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
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

  const renderAlienSplashOverlay = () => {
    if (!alienSplashActive) return null;

    const alienId = alienSplashTargetAlien?.id || '';
    const displayImage =
      alienSplashTargetAlien?.splash_image_url ||
      alienSplashMap[alienId] ||
      selectionSplashUrl ||
      alienSplashTargetAlien?.image_url;

    const alienName = alienSplashTargetAlien?.name || 'Alien';
    const alienColor = alienSplashTargetAlien?.color || '#00ff66';

    return (
      <div
        className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-150"
        style={{
          boxShadow: `inset 0 0 80px ${alienColor}40`,
        }}
      >
        {/* Background radial energy flare */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            background: `radial-gradient(circle at center, ${alienColor}60 0%, transparent 75%)`,
          }}
        />

        {/* Main Fullscreen Splash Image */}
        {displayImage ? (
          <img
            src={displayImage}
            alt={alienName}
            className="w-full h-full object-cover select-none pointer-events-none filter drop-shadow-[0_0_25px_rgba(0,0,0,0.8)]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-950 via-[#0a1a0f] to-black">
            <div
              className="w-36 h-36 rounded-full border-4 flex items-center justify-center shadow-2xl mb-4"
              style={{
                borderColor: alienColor,
                backgroundColor: `${alienColor}20`,
                boxShadow: `0 0 50px ${alienColor}`,
              }}
            >
              <span className="text-5xl font-black" style={{ color: alienColor }}>
                {alienName.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* Futuristic Ben 10 Glowing Frame Border */}
        <div
          className="absolute inset-0 pointer-events-none border-[5px]"
          style={{
            borderColor: alienColor,
            boxShadow: `inset 0 0 40px ${alienColor}60, 0 0 30px ${alienColor}80`,
          }}
        />

        {/* Top Banner Tag */}
        <div className="absolute top-8 left-0 right-0 flex justify-center z-20 pointer-events-none">
          <div className="px-5 py-1.5 rounded-full bg-black/85 border border-white/20 text-[11px] font-black tracking-widest text-emerald-300 uppercase shadow-lg backdrop-blur-md">
            Alien Selected
          </div>
        </div>

        {/* Bottom Alien Name Banner */}
        <div className="absolute bottom-10 left-4 right-4 z-20 flex flex-col items-center pointer-events-none">
          <div
            className="px-6 py-2.5 rounded-2xl bg-black/90 border-2 font-black text-xl tracking-widest uppercase text-white shadow-2xl backdrop-blur-md text-center"
            style={{
              borderColor: alienColor,
              boxShadow: `0 0 30px ${alienColor}aa`,
              textShadow: `0 0 15px ${alienColor}`,
            }}
          >
            {alienName.toUpperCase()}
          </div>
        </div>
      </div>
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
      const OUTPUT_SIZE = 160; // 160x160 is lightweight (~12KB) & ultra-crisp for ball avatars
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

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.82);

      // Pre-cache in loadedImagesRef immediately so Canvas can draw it with 0 delay
      const cachedImg = new Image();
      cachedImg.onload = () => {
        loadedImagesRef.current.set(croppedDataUrl, cachedImg);
        drawFrame();
      };
      cachedImg.src = croppedDataUrl;
      loadedImagesRef.current.set(croppedDataUrl, cachedImg);

      // Update contestant in state and persist active list (stripped of heavy base64 to keep localStorage under 1KB)
      setContestants((prev) => {
        const copy = [...prev];
        if (copy[cropTargetIndex]) {
          copy[cropTargetIndex] = { ...copy[cropTargetIndex], image_url: croppedDataUrl };
        }
        try {
          safeSaveLocalStorage('arena_active_contestants', JSON.stringify(stripDataUrls(copy)));
        } catch (e) {}
        return copy;
      });

      // Also update BEN10_ALIEN_PRESETS so preset persistence works
      const targetFighter = contestants[cropTargetIndex] || BEN10_ALIEN_PRESETS[cropTargetIndex];
      if (targetFighter) {
        const preset = BEN10_ALIEN_PRESETS.find(
          (p) => p.id === targetFighter.id || p.name === targetFighter.name
        );
        if (preset) {
          preset.image_url = croppedDataUrl;
        }
      }
      if (BEN10_ALIEN_PRESETS[cropTargetIndex]) {
        BEN10_ALIEN_PRESETS[cropTargetIndex].image_url = croppedDataUrl;
      }

      // Persist in IndexedDB (practically unlimited quota - avoids QuotaExceededError completely!)
      (async () => {
        try {
          const currentMap = (await idbGet<Record<string, string>>('arena_alien_ball_images')) || {};
          const targetId = targetFighter?.id || `alien_${cropTargetIndex}`;
          currentMap[targetId] = croppedDataUrl;
          if (targetFighter?.name) {
            currentMap[targetFighter.name.toLowerCase().replace(/\s+/g, '_')] = croppedDataUrl;
          }
          await idbSet('arena_alien_ball_images', currentMap);
        } catch {}
      })();

      setCropModalOpen(false);
      setRawImageSrc(null);
      setCropTargetIndex(null);
    };
    img.src = rawImageSrc;
  };

  const updateContestant = (index: number, updates: Partial<ContestantConfig>) => {
    setContestants((prev) => {
      const copy = [...prev];
      const cur = copy[index] || {};
      const curAbility = cur.special_ability || {
        name: 'Power Strike',
        icon: '',
        type: 'damage',
        cooldown_seconds: 5,
        power_value: 30,
        trigger_type: 'charge',
        trigger_value: 100,
      };
      const updatedAbility = updates.special_ability
        ? { ...curAbility, ...updates.special_ability }
        : cur.special_ability;

      copy[index] = {
        ...cur,
        ...updates,
        special_ability: updatedAbility,
      };
      try {
        const stripped = stripDataUrls(copy);
        safeSaveLocalStorage('arena_active_contestants', JSON.stringify(stripped));
        idbSet('arena_active_contestants', stripped).catch(() => {});
      } catch (e) {}
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

    const targetFighter = contestants[index] || BEN10_ALIEN_PRESETS[index];
    if (targetFighter) {
      const preset = BEN10_ALIEN_PRESETS.find(
        (p) => p.name?.toLowerCase() === targetFighter.name?.toLowerCase() || p.id === targetFighter.id
      );
      if (preset) {
        if (updates.starting_health !== undefined) preset.starting_health = updates.starting_health;
        if (updates.damage !== undefined) preset.damage = updates.damage;
        if (updates.speed !== undefined) preset.speed = updates.speed;
        if (updates.special_power !== undefined) preset.special_power = updates.special_power;
        if (updates.special_ability) {
          preset.special_ability = { ...(preset.special_ability || {}), ...updates.special_ability };
        }
      }

      // Persist all stat edits (Damage, PWR, HP, Speed, CD, Trigger) in both localStorage and IndexedDB!
      (async () => {
        try {
          const idbCustoms = (await idbGet<Record<string, Partial<ContestantConfig>>>('arena_alien_customizations')) || {};
          let lsCustoms: Record<string, Partial<ContestantConfig>> = {};
          try {
            lsCustoms = JSON.parse(localStorage.getItem('arena_alien_customizations') || '{}');
          } catch {}
          const mergedCustoms = { ...lsCustoms, ...idbCustoms };

          const cleanUpdates = { ...updates };
          if (cleanUpdates.image_url && cleanUpdates.image_url.startsWith('data:')) {
            delete cleanUpdates.image_url;
          }

          const keysToUpdate: string[] = [];
          if (preset?.id) keysToUpdate.push(preset.id);
          if (targetFighter.name) {
            keysToUpdate.push(targetFighter.name.toLowerCase().replace(/\s+/g, '_'));
          }
          if (targetFighter.id && !targetFighter.id.startsWith('fighter_')) {
            keysToUpdate.push(targetFighter.id);
          }

          keysToUpdate.forEach((k) => {
            const existing = mergedCustoms[k] || {};
            mergedCustoms[k] = {
              ...existing,
              ...cleanUpdates,
              special_ability: cleanUpdates.special_ability
                ? { ...(existing.special_ability || {}), ...cleanUpdates.special_ability }
                : existing.special_ability,
            };
          });

          safeSaveLocalStorage('arena_alien_customizations', JSON.stringify(mergedCustoms));
          await idbSet('arena_alien_customizations', mergedCustoms);
        } catch (e) {}
      })();
    }

    if (updates.image_url !== undefined) {
      const targetId = targetFighter?.id || `alien_${index}`;
      (async () => {
        try {
          const currentMap = (await idbGet<Record<string, string>>('arena_alien_ball_images')) || {};
          if (updates.image_url) {
            currentMap[targetId] = updates.image_url;
            if (targetFighter?.name) {
              currentMap[targetFighter.name.toLowerCase().replace(/\s+/g, '_')] = updates.image_url;
            }
          } else {
            delete currentMap[targetId];
            if (targetFighter?.name) {
              delete currentMap[targetFighter.name.toLowerCase().replace(/\s+/g, '_')];
            }
          }
          await idbSet('arena_alien_ball_images', currentMap);
        } catch {}
      })();
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
        7200,
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
        bg_music_url: bgMusicUrl || '/audio/battle_bgm.mp3',
        bg_music_volume: bgMusicVolume,
        bg_music_enabled: bgMusicEnabled,
        alien_splash_url: selectionSplashUrl || null,
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
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-black text-xs">
              AC
            </div>
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
              YouTube
            </Link>
            <Link href="/admin?tab=meta" className="px-3 py-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 border border-blue-900/50 transition flex items-center gap-1">
              FB & IG
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
            <button onClick={() => setQueueMessage(null)} className="opacity-60 hover:opacity-100 text-xs font-bold">X</button>
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
                    className="px-2.5 py-0.5 rounded-md bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/60 text-[11px] font-bold text-emerald-300 transition shadow-sm"
                  >
                    Ben 10 Aliens
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
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((num) => (
                    <button
                      key={num}
                      onClick={() => {
                        setContestantCount(num);
                        resetSimulation();
                      }}
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
                        <span className="text-[10px] uppercase font-bold tracking-wider">Photo</span>
                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(idx, e)} className="hidden" />
                      </label>
                    </div>

                    {fighter.image_url && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openCropModal(idx, fighter.image_url!)}
                          title="Crop and position image"
                          className="text-[9px] px-1.5 py-0.5 bg-cyan-950/90 hover:bg-cyan-900 text-cyan-300 rounded border border-cyan-700/60 font-bold transition"
                        >
                          Crop
                        </button>
                        <button
                          type="button"
                          onClick={() => updateContestant(idx, { image_url: null })}
                          title="Remove image"
                          className="text-[9px] px-1.5 py-0.5 bg-rose-950/90 hover:bg-rose-900 text-rose-300 rounded border border-rose-700/60 font-bold transition"
                        >
                          X
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
                          max="999"
                          value={fighter.starting_health === 0 ? '' : fighter.starting_health}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              updateContestant(idx, { starting_health: 0 });
                            } else {
                              const num = parseInt(val, 10);
                              updateContestant(idx, { starting_health: isNaN(num) ? 0 : Math.min(999, Math.max(0, num)) });
                            }
                          }}
                          onBlur={() => {
                            if (!fighter.starting_health || fighter.starting_health < 10) {
                              updateContestant(idx, { starting_health: 100 });
                            }
                          }}
                          className="w-12 bg-transparent text-emerald-400 font-bold text-right focus:outline-none"
                        />
                      </div>

                      {/* Damage */}
                      <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px]">
                        <span className="text-slate-500">DMG:</span>
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={fighter.damage === 0 ? '' : fighter.damage}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              updateContestant(idx, { damage: 0 });
                            } else {
                              const num = parseInt(val, 10);
                              updateContestant(idx, { damage: isNaN(num) ? 0 : Math.min(200, Math.max(0, num)) });
                            }
                          }}
                          onBlur={() => {
                            if (!fighter.damage || fighter.damage < 1) {
                              updateContestant(idx, { damage: 25 });
                            }
                          }}
                          className="w-12 bg-transparent text-rose-400 font-bold text-right focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Special Ability Editor */}
                    <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80 space-y-1.5 mt-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-cyan-400">
                          SPECIAL ABILITY
                        </span>
                        <div className="flex items-center gap-1">
                          {['DMG', 'BURST', 'SHIELD', 'ICE', 'HEAL', 'RAGE', 'METEOR', 'WIND', 'BOMB', 'SLASH'].map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                const cur = fighter.special_ability || { name: 'Power Strike', icon: '', type: 'damage', cooldown_seconds: 5, power_value: 30, trigger_type: 'charge', trigger_value: 100 };
                                updateContestant(idx, { special_ability: { ...cur, icon: tag } });
                              }}
                              className={`text-[9px] px-1.5 py-0.5 rounded font-black transition ${
                                fighter.special_ability?.icon === tag ? 'bg-cyan-500/30 text-cyan-300 ring-1 ring-cyan-400' : 'text-slate-400 hover:text-white bg-slate-900'
                              }`}
                            >
                              {tag}
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
                            const cur = fighter.special_ability || { name: '', icon: '', type: 'damage', cooldown_seconds: 5, power_value: 30, trigger_type: 'charge', trigger_value: 100 };
                            updateContestant(idx, { special_ability: { ...cur, name: e.target.value } });
                          }}
                          className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-white font-bold placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                        />

                        <select
                          value={fighter.special_ability?.type || 'damage'}
                          onChange={(e) => {
                            const cur = fighter.special_ability || { name: 'Power Strike', icon: '', type: 'damage', cooldown_seconds: 5, power_value: 30, trigger_type: 'charge', trigger_value: 100 };
                            updateContestant(idx, { special_ability: { ...cur, type: e.target.value as any } });
                          }}
                          className="px-1.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-cyan-300 font-bold focus:outline-none"
                        >
                          <option value="damage">Damage</option>
                          <option value="shield">Shield</option>
                          <option value="heal">Heal</option>
                          <option value="freeze">Freeze</option>
                          <option value="speed">Speed</option>
                        </select>

                        <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                          <span className="text-slate-500">CD:</span>
                          <input
                            type="number"
                            min="1"
                            max="60"
                            step="1"
                            value={fighter.special_ability?.cooldown_seconds === 0 ? '' : (fighter.special_ability?.cooldown_seconds ?? 5)}
                            onChange={(e) => {
                              const cur = fighter.special_ability || { name: 'Power Strike', icon: '', type: 'damage', cooldown_seconds: 5, power_value: 30, trigger_type: 'charge', trigger_value: 100 };
                              const val = e.target.value;
                              const num = val === '' ? 0 : parseInt(val, 10);
                              updateContestant(idx, { special_ability: { ...cur, cooldown_seconds: isNaN(num) ? 0 : Math.min(60, Math.max(0, num)) } });
                            }}
                            onBlur={() => {
                              const cur = fighter.special_ability || { name: 'Power Strike', icon: '', type: 'damage', cooldown_seconds: 5, power_value: 30, trigger_type: 'charge', trigger_value: 100 };
                              if (!cur.cooldown_seconds || cur.cooldown_seconds < 1) {
                                updateContestant(idx, { special_ability: { ...cur, cooldown_seconds: 5 } });
                              }
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
                            max="200"
                            value={fighter.special_ability?.power_value === 0 ? '' : (fighter.special_ability?.power_value ?? 30)}
                            onChange={(e) => {
                              const cur = fighter.special_ability || { name: 'Power Strike', icon: '', type: 'damage', cooldown_seconds: 5, power_value: 30, trigger_type: 'charge', trigger_value: 100 };
                              const val = e.target.value;
                              const num = val === '' ? 0 : parseInt(val, 10);
                              updateContestant(idx, { special_ability: { ...cur, power_value: isNaN(num) ? 0 : Math.min(200, Math.max(0, num)) } });
                            }}
                            onBlur={() => {
                              const cur = fighter.special_ability || { name: 'Power Strike', icon: '', type: 'damage', cooldown_seconds: 5, power_value: 30, trigger_type: 'charge', trigger_value: 100 };
                              if (!cur.power_value || cur.power_value < 1) {
                                updateContestant(idx, { special_ability: { ...cur, power_value: 30 } });
                              }
                            }}
                            className="w-10 bg-transparent text-pink-400 font-bold text-right focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Trigger Criteria & Weapon Selector */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] pt-1.5 border-t border-slate-900">
                        <div className="flex items-center gap-1.5 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800">
                          <span className="text-slate-400 font-semibold whitespace-nowrap text-[10px]">Trigger:</span>
                          <select
                            value={fighter.special_ability?.trigger_type || 'charge'}
                            onChange={(e) => {
                              const newType = e.target.value as any;
                              const cur = fighter.special_ability || { name: 'Power Strike', icon: '', type: 'damage', cooldown_seconds: 5, power_value: 30, trigger_type: 'charge', trigger_value: 100 };
                              const defaultVal = newType === 'hit_combo' ? 4 : newType === 'hp_threshold' ? 50 : 100;
                              updateContestant(idx, {
                                special_ability: {
                                  ...cur,
                                  trigger_type: newType,
                                  trigger_value: defaultVal,
                                },
                              });
                            }}
                            className="bg-transparent text-emerald-400 font-bold focus:outline-none flex-1 text-[10px]"
                          >
                            <option value="charge" className="bg-slate-900 text-white">100% Omnitrix Charge</option>
                            <option value="hp_threshold" className="bg-slate-900 text-white">Low HP (&lt;50%) Rage</option>
                            <option value="hit_combo" className="bg-slate-900 text-white">4x Hit Combo</option>
                            <option value="cooldown" className="bg-slate-900 text-white">Cooldown Timer</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800">
                          <span className="text-slate-400 font-semibold whitespace-nowrap text-[10px]">Weapon:</span>
                          <select
                            value={fighter.special_ability?.weapon_icon || ''}
                            onChange={(e) => {
                              const cur = fighter.special_ability || { name: 'Power Strike', icon: '', type: 'damage', cooldown_seconds: 5, power_value: 30 };
                              updateContestant(idx, { special_ability: { ...cur, weapon_icon: e.target.value } });
                            }}
                            className="bg-transparent text-amber-300 font-bold focus:outline-none flex-1 text-[10px]"
                          >
                            <option value="fist" className="bg-slate-900 text-white">Fist / Sonic Blow</option>
                            <option value="fire" className="bg-slate-900 text-white">Fireball Orbit</option>
                            <option value="crystal" className="bg-slate-900 text-white">Diamond Crystal</option>
                            <option value="blade" className="bg-slate-900 text-white">Plasma Blade</option>
                            <option value="spark" className="bg-slate-900 text-white">Electric Arc</option>
                            <option value="shield" className="bg-slate-900 text-white">Energy Shield</option>
                            <option value="gear" className="bg-slate-900 text-white">Galvanic Gear</option>
                            <option value="jaws" className="bg-slate-900 text-white">Steel Jaws</option>
                            <option value="" className="bg-slate-900 text-white">None</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 1. Alien Selection Splash Screen Upload Section (Per Alien) */}
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Alien Splash Screens (1s per Alien)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Each alien has their own distinct 1-second fullscreen transformation screen
                  </p>
                </div>
              </div>

              {/* Alien selector pills */}
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar p-1.5 bg-slate-950 rounded-xl border border-slate-800/80">
                {BEN10_ALIEN_PRESETS.map((alien) => {
                  const isSelected = selectedSplashAlienId === alien.id;
                  const hasCustom = Boolean(alienSplashMap[alien.id]);
                  return (
                    <button
                      key={alien.id}
                      type="button"
                      onClick={() => setSelectedSplashAlienId(alien.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 shadow-md'
                          : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: alien.color || '#00ff66' }}
                      />
                      <span>{alien.name}</span>
                      {hasCustom && (
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-black ${
                            isSelected ? 'bg-black/40 text-emerald-950' : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          CUSTOM
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Alien Splash Editor */}
              {(() => {
                const activeAlien = BEN10_ALIEN_PRESETS.find((a) => a.id === selectedSplashAlienId) || BEN10_ALIEN_PRESETS[0];
                const currentSplash = alienSplashMap[activeAlien.id] || activeAlien.splash_image_url;
                return (
                  <div className="flex items-center gap-3 pt-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div
                      className="w-14 h-14 rounded-xl border-2 overflow-hidden flex items-center justify-center shrink-0 relative shadow-inner bg-black"
                      style={{ borderColor: activeAlien.color || '#00ff66' }}
                    >
                      {currentSplash ? (
                        <img src={currentSplash} alt={activeAlien.name} className="w-full h-full object-cover" />
                      ) : activeAlien.image_url ? (
                        <img src={activeAlien.image_url} alt={activeAlien.name} className="w-full h-full object-cover opacity-70" />
                      ) : (
                        <span className="text-xs text-slate-500 font-bold">{activeAlien.name.charAt(0)}</span>
                      )}
                    </div>

                    <div className="flex-1 flex flex-wrap items-center gap-2">
                      <div className="w-full">
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{activeAlien.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {currentSplash ? '(Custom Splash Active)' : '(Default Avatar Fallback)'}
                          </span>
                        </div>
                      </div>

                      <div className="w-full flex flex-wrap items-center gap-2 pt-1">
                        <label className="px-3 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-xs font-bold text-cyan-300 cursor-pointer transition flex items-center gap-1.5">
                          <span>Upload {activeAlien.name} Splash</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleAlienSplashUpload(activeAlien.id, e)}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => triggerAlienSplashPreview(activeAlien.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/50 text-xs font-bold text-emerald-300 transition"
                        >
                          Test 1s Screen
                        </button>

                        {currentSplash && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAlienSplash(activeAlien.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-xs font-semibold text-rose-300 transition"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 2. Battle Background Music Upload Section */}
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Battle Background Music
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Plays automatically when the battle begins
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBgMusicEnabled(!bgMusicEnabled)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
                      bgMusicEnabled
                        ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}
                  >
                    {bgMusicEnabled ? 'BGM ON' : 'BGM OFF'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <label className="px-3 py-1.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-xs font-bold text-amber-300 cursor-pointer transition flex items-center gap-1.5">
                  <span>Upload Music File</span>
                  <input type="file" accept="audio/*" onChange={handleBgMusicUpload} className="hidden" />
                </label>

                <button
                  type="button"
                  onClick={toggleMusicPreview}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                    isPlayingMusicPreview
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  {isPlayingMusicPreview ? 'Pause Preview' : 'Play Preview'}
                </button>

                {bgMusicName.startsWith('Custom:') && (
                  <button
                    type="button"
                    onClick={handleRemoveCustomMusic}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-400 hover:text-rose-400 transition"
                  >
                    Reset to Default
                  </button>
                )}
              </div>

              {/* Active Track Name Pill */}
              <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400 truncate max-w-[240px]">Track: <span className="text-white font-medium">{bgMusicName}</span></span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Vol:</span>
                  <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={bgMusicVolume}
                    onChange={(e) => setBgMusicVolume(Number(e.target.value))}
                    className="accent-amber-500 w-20"
                  />
                  <span className="text-[11px] font-mono text-amber-300 w-8 text-right">{Math.round(bgMusicVolume * 100)}%</span>
                </div>
              </div>
            </div>

            {/* Audio & Sound Minimal Bar */}
            <div className="flex justify-between items-center px-4 py-2.5 bg-slate-900/40 border border-slate-800/60 rounded-xl text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-400">Sound Effects:</span>
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
                {soundEnabled ? 'SFX ON' : 'MUTED'}
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

                {/* FULLSCREEN BUTTON */}
                <button
                  onClick={() => setIsFullscreen(true)}
                  title="Fullscreen Game Screen"
                  className="px-2.5 py-1 rounded-full bg-black/80 hover:bg-slate-800 backdrop-blur border border-slate-700 text-xs font-bold text-cyan-300 hover:text-white transition flex items-center gap-1 shadow-lg"
                >
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

                {/* 1.5-Second Fullscreen Alien Selection Splash Overlay */}
                {renderAlienSplashOverlay()}
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
                  <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
                </button>

                <button
                  onClick={resetSimulation}
                  title="Reset Game"
                  className="px-3.5 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl font-bold text-xs text-slate-300 transition"
                >
                  RESET
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
                  {isPlaying ? 'PAUSE' : 'PLAY'}
                </button>
                <button
                  onClick={resetSimulation}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition"
                >
                  RESET
                </button>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="px-3.5 py-1 bg-rose-600/80 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
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

              {/* 1.5-Second Fullscreen Alien Selection Splash Overlay */}
              {renderAlienSplashOverlay()}
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
                  <h3 className="text-sm font-black text-white">
                    Adjust & Frame Image
                  </h3>
                  <p className="text-[11px] text-slate-400">Drag to reposition subject and adjust zoom slider</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCropModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold transition"
                >
                  X
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
                <span className="text-[10px] text-slate-400 mt-2">Click and drag image to adjust frame</span>
              </div>

              {/* Zoom & Framing Controls */}
              <div className="space-y-2 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                  <span>Zoom</span>
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
                    Fit
                  </button>
                  <button
                    type="button"
                    onClick={handleFillCrop}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-lg transition"
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropPan({ x: 0, y: 0 })}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-lg transition"
                  >
                    Center
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
