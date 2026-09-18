export interface VoiceOption {
  id: string;
  name: string;
  gender: 'Male' | 'Female' | 'Neutral';
  accent?: string;
  description: string;
  previewUrl: string;
}

export const POPULAR_VOICES: VoiceOption[] = [
  {
    id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    gender: 'Male',
    accent: 'American',
    description: 'Deep, narrative & firm (YouTube Shorts standard)',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/d6905d7a-dd26-4187-bfff-1bd3a5ea7cac.mp3'
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah',
    gender: 'Female',
    accent: 'American',
    description: 'Mature, reassuring, confident & clear',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3'
  },
  {
    id: 'TX3LPaxmHKxFdv7VOQHJ',
    name: 'Liam',
    gender: 'Male',
    accent: 'American',
    description: 'Energetic, fast-paced social media creator',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/63148076-6363-42db-aea8-31424308b92c.mp3'
  },
  {
    id: 'hpp4J3VqNfWAUOO0d1Us',
    name: 'Bella',
    gender: 'Female',
    accent: 'American',
    description: 'Bright, professional, warm & engaging',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/hpp4J3VqNfWAUOO0d1Us/dab0f5ba-3aa4-48a8-9fad-f138fea1126d.mp3'
  },
  {
    id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    gender: 'Male',
    accent: 'British',
    description: 'Warm, captivating storytelling tone',
    previewUrl: 'https://api.us.elevenlabs.io/v1/voices/JBFqnCBsd6RMkjVDRZzb/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJwcmVtYWRlIiwiZmlsZW5hbWUiOiJlNjIwNmQxYS0wNzIxLTQ3ODctYWFmYi0wNmE2ZTcwNWNhYzUubXAzIiwidGltZXN0YW1wIjoxNzg5NjkzMjAwMDAwMDAwfQ%3D%3D'
  },
  {
    id: 'IKne3meq5aSn9XLyUdCD',
    name: 'Charlie',
    gender: 'Male',
    accent: 'Australian',
    description: 'Deep, hyped & energetic',
    previewUrl: 'https://api.us.elevenlabs.io/v1/voices/IKne3meq5aSn9XLyUdCD/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJwcmVtYWRlIiwiZmlsZW5hbWUiOiIxMDJkZTZmMi0yMmVkLTQzZTAtYTFmMS0xMTFmYTc1YzU0ODEubXAzIiwidGltZXN0YW1wIjoxNzg5NjkzMjAwMDAwMDAwfQ%3D%3D'
  },
  {
    id: 'Xb7hH8MSUJpSbSDYk0k2',
    name: 'Alice',
    gender: 'Female',
    accent: 'British',
    description: 'Clear, crisp educator & documentary',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3'
  },
  {
    id: 'pFZP5JQG7iQjIQuC4Bku',
    name: 'Lily',
    gender: 'Female',
    accent: 'American',
    description: 'Velvety, expressive & confident',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pFZP5JQG7iQjIQuC4Bku/89b68b35-b3dd-4348-a84a-a3c13a3c2b30.mp3'
  },
  {
    id: 'nPczCjzI2devNBz1zQrb',
    name: 'Brian',
    gender: 'Male',
    accent: 'American',
    description: 'Deep, resonant & comforting tone',
    previewUrl: 'https://api.us.elevenlabs.io/v1/voices/nPczCjzI2devNBz1zQrb/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJwcmVtYWRlIiwiZmlsZW5hbWUiOiIyZGQzZTcyYy00ZmQzLTQyZjEtOTNlYS1hYmM1ZDRlNWFhMWQubXAzIiwidGltZXN0YW1wIjoxNzg5NjkzMjAwMDAwMDAwfQ%3D%3D'
  },
  {
    id: 'FGY2WhTYpPnrIDTdsKH5',
    name: 'Laura',
    gender: 'Female',
    accent: 'American',
    description: 'Enthusiastic, sassy & quirky attitude',
    previewUrl: 'https://api.us.elevenlabs.io/v1/voices/FGY2WhTYpPnrIDTdsKH5/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJwcmVtYWRlIiwiZmlsZW5hbWUiOiI2NzM0MTc1OS1hZDA4LTQxYTUtYmU2ZS1kZTEyZmU0NDg2MTgubXAzIiwidGltZXN0YW1wIjoxNzg5NjkzMjAwMDAwMDAwfQ%3D%3D'
  },
  {
    id: 'bIHbv24MWmeRgasZH58o',
    name: 'Will',
    gender: 'Male',
    accent: 'American',
    description: 'Chill, relaxed & optimistic',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/bIHbv24MWmeRgasZH58o/8caf8f3d-ad29-4980-af41-53f20c72d7a4.mp3'
  }
];
