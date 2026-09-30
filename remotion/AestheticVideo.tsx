import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  Sequence,
  Img,
  OffthreadVideo,
  Audio,
  interpolate,
  Easing,
  staticFile,
} from 'remotion';

export interface AestheticScene {
  camera_angle?: string;
  camera_motion?: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'tilt-up' | 'tilt-down' | string;
  image_keyword: string;
  image_url?: string;
  duration?: number;
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

export const CROSSFADE_OVERLAP_FRAMES = 25; // ~0.83s smooth cinematic crossfade dissolve

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

// Deterministic Pseudo-Random Generator
function createSeededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

interface Particle {
  id: number;
  startX: number;
  startY: number;
  size: number;
  speedX: number;
  speedY: number;
  swayFreq: number;
  swayAmp: number;
  type: 'petal' | 'mote' | 'bokeh';
  baseOpacity: number;
  rotationSpeed: number;
  initialRotation: number;
}

// 45 living dreamcore floating petals and ethereal ambient motes
const FloatingDreamcoreParticles: React.FC = () => {
  const frame = useCurrentFrame();

  const particles: Particle[] = useMemo(() => {
    const rng = createSeededRandom(777);
    const list: Particle[] = [];

    for (let i = 0; i < 45; i++) {
      const randType = rng();
      let type: 'petal' | 'mote' | 'bokeh' = 'petal';
      let size = 14 + rng() * 16;
      let baseOpacity = 0.5 + rng() * 0.4;

      if (randType < 0.25) {
        type = 'bokeh'; // Large soft out-of-focus foreground petal/bokeh
        size = 50 + rng() * 45;
        baseOpacity = 0.25 + rng() * 0.25;
      } else if (randType < 0.55) {
        type = 'mote'; // Glowing golden-white light dust
        size = 5 + rng() * 8;
        baseOpacity = 0.6 + rng() * 0.4;
      }

      list.push({
        id: i,
        startX: rng() * 110 - 5,
        startY: rng() * 110 - 5,
        size,
        speedX: 0.08 + rng() * 0.16,
        speedY: 0.14 + rng() * 0.22,
        swayFreq: 0.025 + rng() * 0.035,
        swayAmp: 15 + rng() * 25,
        type,
        baseOpacity,
        rotationSpeed: (rng() - 0.5) * 1.8,
        initialRotation: rng() * 360,
      });
    }
    return list;
  }, []);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {particles.map((p) => {
        // Continuous organic movement with wind sway
        let x = (p.startX + frame * p.speedX + Math.sin(frame * p.swayFreq + p.id) * p.swayAmp) % 115;
        if (x < -10) x += 125;

        let y = (p.startY + frame * p.speedY + Math.cos(frame * p.swayFreq * 0.7 + p.id) * (p.swayAmp * 0.4)) % 120;
        if (y < -15) y += 135;

        const rotation = p.initialRotation + frame * p.rotationSpeed;

        if (p.type === 'bokeh') {
          return (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                width: p.size,
                height: p.size * 0.85,
                background: 'radial-gradient(circle, rgba(255, 195, 215, 0.8) 0%, rgba(255, 160, 190, 0.3) 50%, rgba(255, 140, 180, 0) 80%)',
                borderRadius: '50%',
                filter: 'blur(10px)',
                opacity: p.baseOpacity,
                transform: `rotate(${rotation}deg)`,
                pointerEvents: 'none',
              }}
            />
          );
        }

        if (p.type === 'mote') {
          const pulse = 0.8 + 0.3 * Math.sin(frame * 0.08 + p.id);
          return (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                width: p.size,
                height: p.size,
                background: 'radial-gradient(circle, rgba(255, 255, 240, 0.95) 0%, rgba(255, 220, 160, 0.7) 45%, rgba(255, 200, 140, 0) 75%)',
                borderRadius: '50%',
                boxShadow: '0 0 8px rgba(255, 235, 180, 0.8)',
                opacity: p.baseOpacity * pulse,
                pointerEvents: 'none',
              }}
            />
          );
        }

        // Falling Sakura/Cherry Blossom Petal
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: p.size,
              height: p.size * 1.45,
              background: 'linear-gradient(135deg, rgba(255, 235, 245, 0.92) 0%, rgba(255, 175, 205, 0.85) 60%, rgba(235, 130, 175, 0.75) 100%)',
              borderRadius: '65% 15% 65% 15%',
              boxShadow: '0 1px 4px rgba(240, 140, 180, 0.35)',
              opacity: p.baseOpacity,
              transform: `rotate(${rotation}deg) scaleY(${0.85 + 0.15 * Math.sin(frame * 0.05 + p.id)})`,
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

interface CinematicSceneProps {
  sceneData: AestheticScene;
  duration: number;
  isFirst: boolean;
  isLast: boolean;
  sceneIndex: number;
}

const CinematicScene: React.FC<CinematicSceneProps> = ({
  sceneData,
  duration,
  isFirst,
  isLast,
}) => {
  const frame = useCurrentFrame();
  const { image_url, camera_motion = 'zoom-in' } = sceneData;

  // Normalized progress [0, 1] with smooth cubic bezier easing
  const progress = interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Dynamic Multi-Axis Camera Motion
  let scale = 1.25;
  let translateX = 0;
  let translateY = 0;

  switch (camera_motion) {
    case 'zoom-out':
      // Cinematic expansive pull-back with upward crane drift
      scale = interpolate(progress, [0, 1], [1.44, 1.15]);
      translateX = interpolate(progress, [0, 1], [35, -40]);
      translateY = interpolate(progress, [0, 1], [-35, 30]);
      break;

    case 'pan-left':
      // Sweeping leftward tracking glide with subtle push
      scale = interpolate(progress, [0, 1], [1.22, 1.34]);
      translateX = interpolate(progress, [0, 1], [130, -130]);
      translateY = interpolate(progress, [0, 1], [25, -20]);
      break;

    case 'pan-right':
      // Sweeping rightward tracking glide with subtle push
      scale = interpolate(progress, [0, 1], [1.22, 1.34]);
      translateX = interpolate(progress, [0, 1], [-130, 130]);
      translateY = interpolate(progress, [0, 1], [-20, 25]);
      break;

    case 'tilt-up':
      // Low-angle ground-to-sky jib crane upward sweep
      scale = interpolate(progress, [0, 1], [1.38, 1.18]);
      translateY = interpolate(progress, [0, 1], [140, -120]);
      translateX = interpolate(progress, [0, 1], [-35, 35]);
      break;

    case 'tilt-down':
      // Overhead bird's eye descent glide
      scale = interpolate(progress, [0, 1], [1.18, 1.38]);
      translateY = interpolate(progress, [0, 1], [-120, 130]);
      translateX = interpolate(progress, [0, 1], [35, -35]);
      break;

    case 'zoom-in':
    default:
      // Cinematic deep push-in with gentle diagonal Steadicam glide
      scale = interpolate(progress, [0, 1], [1.14, 1.42]);
      translateX = interpolate(progress, [0, 1], [-45, 50]);
      translateY = interpolate(progress, [0, 1], [35, -35]);
      break;
  }

  // Crossfade Opacity Calculation
  const fadeInFrames = isFirst ? 12 : CROSSFADE_OVERLAP_FRAMES;
  const fadeInOpacity = interpolate(frame, [0, fadeInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  const fadeOutOpacity = isLast
    ? interpolate(frame, [duration - 14, duration], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : interpolate(frame, [duration - CROSSFADE_OVERLAP_FRAMES, duration], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.in(Easing.quad),
      });

  const opacity = Math.min(fadeInOpacity, fadeOutOpacity);

  // Cinematic Dream Blur Dissolve at entrance & exit
  const enterBlur = isFirst
    ? 0
    : interpolate(frame, [0, 18], [9, 0], { extrapolateRight: 'clamp' });
  const exitBlur = interpolate(frame, [duration - 18, duration], [0, 9], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const blurAmount = Math.max(enterBlur, exitBlur);

  const isVideo = Boolean(
    image_url && (
      image_url.startsWith('data:video/') ||
      image_url.endsWith('.mp4') ||
      image_url.endsWith('.webm') ||
      image_url.includes('.mp4?')
    )
  );

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000' }}>
      {image_url ? (
        isVideo ? (
          <OffthreadVideo
            src={image_url}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `translate3d(${translateX * 0.4}px, ${translateY * 0.4}px, 0) scale(${scale})`,
              transformOrigin: '50% 50%',
              opacity,
              filter: blurAmount > 0.5 ? `blur(${blurAmount}px)` : undefined,
            }}
          />
        ) : (
          <Img
            src={image_url}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
              transformOrigin: '50% 50%',
              opacity,
              filter: blurAmount > 0.5 ? `blur(${blurAmount}px)` : undefined,
            }}
          />
        )
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
          No Image or Video
        </div>
      )}

      {/* Dreamcore Light Bloom Flash on scene transitions */}
      {frame < 22 && !isFirst && (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            backgroundColor: 'rgba(255, 230, 245, 0.22)',
            opacity: interpolate(frame, [0, 8, 22], [0.35, 0.2, 0], { extrapolateRight: 'clamp' }),
            mixBlendMode: 'screen',
          }}
        />
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

  // Calculate each scene's start frame and duration with crossfade overlap
  let currentStart = 0;
  const sceneTimeline = scenes.map((scene, idx) => {
    const start = currentStart;
    const duration = scene.duration || 125;
    const isFirst = idx === 0;
    const isLast = idx === scenes.length - 1;

    // Advance next scene start point so scenes overlap during crossfade
    currentStart += duration - (isLast ? 0 : CROSSFADE_OVERLAP_FRAMES);

    return {
      scene,
      start,
      duration,
      isFirst,
      isLast,
    };
  });

  const totalFrames = currentStart;
  const isBgMusicEnabled = data_json.bg_music_enabled !== false;
  const audioSrc = isBgMusicEnabled
    ? resolveAudioUrl(data_json.bg_music_url || 'audio/lofi_chill.mp3')
    : null;
  const audioVolume = data_json.bg_music_volume ?? 0.35;

  return (
    <AbsoluteFill style={{ backgroundColor: '#050505', overflow: 'hidden' }}>
      {/* Background Audio */}
      {audioSrc && (
        <Audio
          src={audioSrc}
          volume={(f) => {
            if (f < 25) return interpolate(f, [0, 25], [0, audioVolume]);
            if (f > totalFrames - 30) return interpolate(f, [totalFrames - 30, totalFrames], [audioVolume, 0]);
            return audioVolume;
          }}
        />
      )}

      {/* Render Scenes with Overlap */}
      {sceneTimeline.map(({ scene, start, duration, isFirst, isLast }, index) => {
        return (
          <Sequence key={index} from={start} durationInFrames={duration}>
            <CinematicScene
              sceneData={scene}
              duration={duration}
              isFirst={isFirst}
              isLast={isLast}
              sceneIndex={index}
            />
          </Sequence>
        );
      })}

      {/* Living Atmospheric Dreamcore Floating Petals & Ambient Dust Layer */}
      <FloatingDreamcoreParticles />

      {/* Subtle Dreamcore Vignette Overlay for Depth & Contrast */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.01) 0%, rgba(20,10,30,0.18) 70%, rgba(0,0,0,0.48) 100%)',
          mixBlendMode: 'multiply',
        }}
      />
    </AbsoluteFill>
  );
};
