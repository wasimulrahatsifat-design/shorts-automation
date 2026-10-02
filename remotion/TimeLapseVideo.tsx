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

export interface TimeLapseVideoJson {
  format?: 'TimeLapseVideo' | 'VideoFlow' | string;
  topic?: string;
  title?: string;
  video_url?: string;
  start_day?: number;
  end_day?: number;
  day_prefix?: string;
  duration_seconds?: number;
  bg_music_url?: string;
  bg_music_volume?: number;
  bg_music_enabled?: boolean;
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
  const { durationInFrames } = useVideoConfig();

  const {
    video_url,
    title = topic || '90 Days Transformation',
    start_day = 0,
    end_day = 90,
    day_prefix = 'Day ',
    bg_music_url,
    bg_music_volume = 0.35,
    bg_music_enabled = false,
  } = data_json;

  const resolvedVideoUrl = resolveMediaUrl(video_url);

  // Calculate current day linearly across duration
  const currentDay = Math.round(
    interpolate(frame, [0, durationInFrames], [start_day, end_day], {
      extrapolateRight: 'clamp',
    })
  );

  // Calculate day progress percentage for progress bar
  const totalDays = Math.max(1, end_day - start_day);
  const currentDayProgress = Math.min(100, Math.max(0, ((currentDay - start_day) / totalDays) * 100));

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
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%)',
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
          height: 480,
          background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Title in Quicksand Font */}
      {title && title.trim() && (
        <div
          style={{
            position: 'absolute',
            top: 130,
            left: 50,
            right: 50,
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
              fontSize: 54,
              color: '#FFFFFF',
              lineHeight: 1.25,
              letterSpacing: '-0.5px',
              textShadow: '0 4px 20px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.9)',
              padding: '12px 32px',
              backgroundColor: 'rgba(0, 0, 0, 0.42)',
              backdropFilter: 'blur(10px)',
              borderRadius: 40,
              border: '1.5px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            }}
          >
            {title}
          </div>
        </div>
      )}

      {/* Bottom Center Day Counter in Quicksand Font */}
      <div
        style={{
          position: 'absolute',
          bottom: 180,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 68,
            color: '#FFFFFF',
            letterSpacing: '0.5px',
            backgroundColor: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(16px)',
            padding: '16px 52px',
            borderRadius: 60,
            border: '2.5px solid rgba(255, 255, 255, 0.35)',
            boxShadow: '0 14px 40px rgba(0, 0, 0, 0.75), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
            textShadow: '0 3px 12px rgba(0, 0, 0, 0.9)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {day_prefix}{currentDay}
        </div>

        {/* Minimalist Day Progression Bar */}
        <div
          style={{
            width: 320,
            height: 7,
            backgroundColor: 'rgba(255, 255, 255, 0.22)',
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              width: `${currentDayProgress}%`,
              height: '100%',
              backgroundColor: '#38BDF8',
              borderRadius: 10,
              boxShadow: '0 0 10px #38BDF8',
            }}
          />
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
