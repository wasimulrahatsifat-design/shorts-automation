export interface MusicTrack {
  id: string;
  name: string;
  url: string;
  isCustom?: boolean;
}

export const DEFAULT_MUSIC_TRACKS: MusicTrack[] = [
  { 
    id: 'battle_bgm', 
    name: '⚡ Battle Action (Fast & Energetic)', 
    url: '/audio/battle_bgm.wav' 
  },
  { 
    id: 'lofi_chill', 
    name: '☕ Lo-Fi Chill (Smooth & Relaxing)', 
    url: '/audio/lofi_chill.mp3' 
  },
  { 
    id: 'arcade_chill', 
    name: '👾 Retro Arcade (Playful Chiptune)', 
    url: '/audio/arcade_chill.mp3' 
  },
];
