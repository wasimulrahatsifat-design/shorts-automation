import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Sequence, Img, Audio, interpolate, staticFile } from 'remotion';

export interface AestheticScene {
  camera_angle?: string;
  camera_motion?: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'tilt-up' | 'tilt-down' | string;
  image_keyword: string;
  image_url?: string;
  duration: number;
}

export interface AestheticVideoJson {
  format?: string;
  topic?: string;
  duration_seconds?: number;
  location_description?: string;
  bg_music_url?: string;
  bg_music_volume?: number;
  bg_music_enabled?: boolean;
  scenes?: AestheticScene[];
}

const resolveAudioUrl = (url?: string) => {
  if (!url) return staticFile('audio/lofi_chill.mp3');
  if (url.includes('krtdupjglmlhumcbsxke.supabase.co')) {
    return staticFile('audio/lofi_chill.mp3');
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const clean = url.startsWith('/') ? url.slice(1) : url;
  return staticFile(clean);
};

export const CROSSFADE_OVERLAP_FRAMES = 15;

const CinematicScene: React.FC<{ 
  sceneData: AestheticScene; 
  isFirst: boolean;
  isLast: boolean;
  sceneIndex: number;
}> = ({ sceneData, isFirst, isLast }) => {
  const frame = useCurrentFrame();
  const { image_url, duration, camera_motion = 'zoom-in' } = sceneData;

  // Compute camera motion transform
  let scale = 1.0;
  let translateX = 0;
  let translateY = 0;

  switch (camera_motion) {
    case 'zoom-out':
      scale = interpolate(frame, [0, duration], [1.14, 1.0], { extrapolateRight: 'clamp' });
      break;
    case 'pan-left':
      scale = 1.14;
      translateX = interpolate(frame, [0, duration], [30, -30], { extrapolateRight: 'clamp' });
      break;
    case 'pan-right':
      scale = 1.14;
      translateX = interpolate(frame, [0, duration], [-30, 30], { extrapolateRight: 'clamp' });
      break;
    case 'tilt-up':
      scale = 1.14;
      translateY = interpolate(frame, [0, duration], [30, -20], { extrapolateRight: 'clamp' });
      break;
    case 'tilt-down':
      scale = 1.14;
      translateY = interpolate(frame, [0, duration], [-20, 30], { extrapolateRight: 'clamp' });
      break;
    case 'zoom-in':
    default:
      scale = interpolate(frame, [0, duration], [1.0, 1.14], { extrapolateRight: 'clamp' });
      break;
  }

  // Fade-in at start: first scene fades in gently, subsequent scenes dissolve in over the overlap
  const fadeInFrames = isFirst ? 10 : CROSSFADE_OVERLAP_FRAMES;
  const fadeInOpacity = interpolate(frame, [0, fadeInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade-out at the very end of the video only
  const fadeOutOpacity = isLast
    ? interpolate(frame, [duration - 12, duration], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  const opacity = Math.min(fadeInOpacity, fadeOutOpacity);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {image_url ? (
        <Img
          src={image_url}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translate3d(${translateX}px, ${translateY}px, 0)`,
            transformOrigin: 'center center',
            opacity,
          }}
        />
      ) : (
        <div
          style={{
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            backgroundColor: '#111',
            fontFamily: 'sans-serif',
          }}
        >
          No Image
        </div>
      )}
    </AbsoluteFill>
  );
};

export const AestheticVideo: React.FC<{ data_json: AestheticVideoJson; topic: string }> = ({
  data_json,
}) => {
  const { scenes = [] } = data_json;

  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }}>
        <h1 style={{ color: 'white' }}>Invalid Aesthetic Data</h1>
      </AbsoluteFill>
    );
  }

  // Calculate each scene's start frame with crossfade overlap
  let currentStart = 0;
  const sceneTimeline = scenes.map((scene, idx) => {
    const start = currentStart;
    const duration = scene.duration || 125;
    const isFirst = idx === 0;
    const isLast = idx === scenes.length - 1;
    // Advance next scene start point by duration minus overlap
    currentStart += duration - (isLast ? 0 : CROSSFADE_OVERLAP_FRAMES);
    return {
      scene,
      start,
      duration,
      isFirst,
      isLast,
    };
  });

  const isBgMusicEnabled = data_json.bg_music_enabled !== false;
  const audioSrc = isBgMusicEnabled
    ? resolveAudioUrl(data_json.bg_music_url || 'audio/lofi_chill.mp3')
    : null;
  const audioVolume = data_json.bg_music_volume ?? 0.35;

  return (
    <AbsoluteFill style={{ backgroundColor: '#050505' }}>
      {/* Background Audio */}
      {audioSrc && (
        <Audio
          src={audioSrc}
          volume={(f) => {
            // Smooth audio fade-in over 20 frames, fade-out over last 25 frames
            const total = currentStart;
            if (f < 20) return interpolate(f, [0, 20], [0, audioVolume]);
            if (f > total - 25) return interpolate(f, [total - 25, total], [audioVolume, 0]);
            return audioVolume;
          }}
        />
      )}

      {/* Render Scenes with Crossfade Overlap */}
      {sceneTimeline.map(({ scene, start, duration, isFirst, isLast }, index) => {
        return (
          <Sequence key={index} from={start} durationInFrames={duration}>
            <CinematicScene
              sceneData={scene}
              isFirst={isFirst}
              isLast={isLast}
              sceneIndex={index}
            />
          </Sequence>
        );
      })}

      {/* Subtle Dreamcore Vignette Overlay */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.3) 100%)',
          mixBlendMode: 'multiply',
        }}
      />
    </AbsoluteFill>
  );
};

