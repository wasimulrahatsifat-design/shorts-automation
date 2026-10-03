import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  OffthreadVideo,
  Img,
  Audio,
  interpolate,
  staticFile,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Quicksand';

// Load Quicksand font with optimal weights
const { fontFamily } = loadFont('normal', {
  weights: ['400', '600', '700'],
  ignoreTooManyRequestsWarning: true,
});

export interface DayKeyframe {
  time: number; // in seconds
  day: number;  // day number
}

export interface TimeLapseVideoJson {
  format?: 'TimeLapseVideo' | 'VideoFlow' | string;
  topic?: string;
  title?: string;
  video_url?: string;
  start_day?: number;
  end_day?: number;
  day_prefix?: string;
  duration_seconds?: number;
  pacing_mode?: 'linear' | 'slow_start' | 'fast_start' | 'custom';
  keyframes?: DayKeyframe[];
  bg_music_url?: string;
  bg_music_volume?: number;
  bg_music_enabled?: boolean;
}

export function calculateDayAtSecond({
  second,
  duration,
  startDay,
  endDay,
  pacingMode = 'linear',
  keyframes,
}: {
  second: number;
  duration: number;
  startDay: number;
  endDay: number;
  pacingMode?: 'linear' | 'slow_start' | 'fast_start' | 'custom' | string;
  keyframes?: DayKeyframe[];
}): number {
  const sDay = Number(startDay) || 0;
  const eDay = Number(endDay) !== undefined && !isNaN(Number(endDay)) ? Number(endDay) : 90;
  const dSec = Math.max(0.1, Number(duration) || 15);
  const clampedSecond = Math.max(0, Math.min(dSec, Number(second) || 0));

  // Custom Keyframes interpolation
  if (pacingMode === 'custom' && keyframes && keyframes.length >= 2) {
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    if (clampedSecond <= sorted[0].time) return sorted[0].day;
    if (clampedSecond >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].day;

    for (let i = 0; i < sorted.length - 1; i++) {
      const k1 = sorted[i];
      const k2 = sorted[i + 1];
      if (clampedSecond >= k1.time && clampedSecond <= k2.time) {
        const span = k2.time - k1.time;
        if (span <= 0.0001) return k2.day;
        const ratio = (clampedSecond - k1.time) / span;
        return Math.round(k1.day + ratio * (k2.day - k1.day));
      }
    }
    return sorted[sorted.length - 1].day;
  }

  const progress = dSec > 0 ? clampedSecond / dSec : 0;
  let adjustedProgress = progress;

  if (pacingMode === 'slow_start') {
    // Ease-in (growth curve): slow start for planting/germination (first 2-3s stays low), then accelerates
    adjustedProgress = Math.pow(progress, 2.2);
  } else if (pacingMode === 'fast_start') {
    // Ease-out: fast initial burst, then settles
    adjustedProgress = 1 - Math.pow(1 - progress, 2.2);
  }

  return Math.round(sDay + adjustedProgress * (eDay - sDay));
}

const resolveAudioUrl = (url?: string) => {
  if (!url) return '';
  if (url.includes('krtdupjglmlhumcbsxke.supabase.co')) {
    return staticFile('audio/lofi_chill.mp3');
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  let clean = url.startsWith('/') ? url.slice(1) : url;
  if (clean.startsWith('public/')) {
    clean = clean.slice(7);
  }
  return staticFile(clean);
};

const resolveMediaUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  let clean = url.startsWith('/') ? url.slice(1) : url;
  if (clean.startsWith('public/')) {
    clean = clean.slice(7);
  }
  return staticFile(clean);
};

export const TimeLapseVideo: React.FC<{ data_json: TimeLapseVideoJson; topic?: string }> = ({
  data_json,
  topic,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const sDay = Number(data_json.start_day) || 0;
  const eDay = data_json.end_day !== undefined && !isNaN(Number(data_json.end_day)) ? Number(data_json.end_day) : 90;

  const {
    video_url,
    title = topic || `${eDay} Days Transformation`,
    day_prefix = 'Day ',
    pacing_mode = 'linear',
    keyframes,
    bg_music_url,
    bg_music_volume = 0.35,
    bg_music_enabled = false,
  } = data_json;

  const resolvedVideoUrl = resolveMediaUrl(video_url);

  // Calculate current second and day based on pacing mode or keyframes
  const durationSeconds = durationInFrames / fps;
  const currentSecond = frame / fps;
  const currentDay = calculateDayAtSecond({
    second: currentSecond,
    duration: durationSeconds,
    startDay: sDay,
    endDay: eDay,
    pacingMode: pacing_mode,
    keyframes,
  });

  const isVideo = Boolean(
    resolvedVideoUrl && (
      resolvedVideoUrl.startsWith('data:video/') ||
      resolvedVideoUrl.endsWith('.mp4') ||
      resolvedVideoUrl.endsWith('.webm') ||
      resolvedVideoUrl.includes('.mp4?') ||
      resolvedVideoUrl.includes('.webm?') ||
      resolvedVideoUrl.includes('/video')
    )
  );

  const audioSrc = bg_music_enabled ? resolveAudioUrl(bg_music_url) : null;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', overflow: 'hidden' }}>
      {/* Background Media */}
      {resolvedVideoUrl ? (
        isVideo ? (
          <OffthreadVideo
            src={resolvedVideoUrl}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <Img
            src={resolvedVideoUrl}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )
      ) : (
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backgroundColor: '#111827',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9CA3AF',
            fontFamily,
            fontSize: 36,
          }}
        >
          No Video Uploaded
        </div>
      )}

      {/* Top Gradient Shadow for Crisp Title Visibility */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 380,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom Gradient Shadow for Bold Day Counter Visibility */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 380,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Title in Quicksand Font - Higher up, Larger size, NO border, NO box */}
      {title && title.trim() && (
        <div
          style={{
            position: 'absolute',
            top: 70,
            left: 40,
            right: 40,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily,
              fontWeight: 700,
              fontSize: 70,
              color: '#FFFFFF',
              lineHeight: 1.2,
              letterSpacing: '-0.5px',
              textShadow: '0 4px 24px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 0.9), 0 0 35px rgba(0, 0, 0, 0.8)',
            }}
          >
            {title}
          </div>
        </div>
      )}

      {/* Bottom Center Day Counter in Quicksand Font - Lower down, Smaller size, NO border, NO capsule, NO progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 85,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 50,
            color: '#FFFFFF',
            letterSpacing: '0.5px',
            textShadow: '0 4px 20px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 0.9), 0 0 25px rgba(0, 0, 0, 0.75)',
          }}
        >
          {day_prefix}{currentDay}
        </div>
      </div>

      {/* Optional Background Audio */}
      {audioSrc && (
        <Audio
          src={audioSrc}
          volume={(f) => {
            if (f < 20) return interpolate(f, [0, 20], [0, bg_music_volume]);
            if (f > durationInFrames - 25) return interpolate(f, [durationInFrames - 25, durationInFrames], [bg_music_volume, 0]);
            return bg_music_volume;
          }}
        />
      )}
    </AbsoluteFill>
  );
};
