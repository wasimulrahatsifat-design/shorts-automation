import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence, Audio, Img, Series, staticFile } from 'remotion';
import { TypewriterText } from './TypewriterText';

interface Scenario {
  option_a: string;
  option_b: string;
  image_keyword_a?: string;
  image_keyword_b?: string;
  image_url_a?: string;
  image_url_b?: string;
  percent_a: number;
  percent_b: number;
}

export interface WouldYouRatherJson {
  format?: string;
  scenarios?: Scenario[];
  tts_urls?: string[] | null;
  show_subtitles?: boolean;
  end_title?: string;
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
  const clean = url.startsWith('/') ? url.slice(1) : url;
  return staticFile(clean);
};

export const getWyrTiming = (s: Scenario, fps: number, isFirstRound?: boolean) => {
  const prefixLength = isFirstRound ? 17 : 0; // "Would you rather " is 17 characters
  const cleanA = (s.option_a || '').replace(/^would you rather\s+/i, '').trim();
  const cleanB = (s.option_b || '').replace(/^would you rather\s+/i, '').trim();
  const textLength = cleanA.length + cleanB.length + prefixLength + 4; // " or " is 4 characters
  // ~21 chars per sec matches ElevenLabs speaking cadence so the timer starts immediately without dead pauses
  const readingSeconds = Math.max(1.5, textLength / 21);
  const readingFrames = Math.round(readingSeconds * fps);
  const timerFrames = 3 * fps;
  const revealFrames = 2 * fps;
  return {
    readingFrames,
    timerFrames,
    revealFrames,
    totalFrames: readingFrames + timerFrames + revealFrames
  };
};

const WyrRound: React.FC<{ 
  scenarioData: Scenario; 
  topic: string; 
  isLastRound?: boolean;
  isFirstRound?: boolean;
}> = ({ scenarioData, topic, isLastRound, isFirstRound }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { option_a, option_b, image_url_a, image_url_b, percent_a, percent_b } = scenarioData;

  // Entrance animations for panels
  const panelAProgress = spring({ frame: frame - 10, fps, config: { damping: 14 } });
  const panelBProgress = spring({ frame: frame - 20, fps, config: { damping: 14 } });
  
  // VS badge animation
  const vsScale = spring({ frame: frame - 30, fps, config: { damping: 10, stiffness: 150 } });

  // Timing
  const { readingFrames, timerFrames } = getWyrTiming(scenarioData, fps, isFirstRound);
  const timerStartFrame = readingFrames;
  
  const timerProgress = interpolate(frame, [timerStartFrame, timerStartFrame + timerFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const isTimerDone = frame >= timerStartFrame + timerFrames;

  // Result animation
  const resultScale = spring({ frame: frame - (timerStartFrame + timerFrames), fps, config: { damping: 12 } });

  const isAHigher = percent_a >= percent_b;

  // Flash effect: if timer is just done, flash the higher one for 1 sec (30 frames) (only if not last round)
  const flashA = !isLastRound && isAHigher && frame > (timerStartFrame + timerFrames) && frame < (timerStartFrame + timerFrames + 30);
  const flashB = !isLastRound && !isAHigher && frame > (timerStartFrame + timerFrames) && frame < (timerStartFrame + timerFrames + 30);

  // True vibrant green
  const VIBRANT_GREEN = '#22c55e';
  const VIBRANT_RED = '#ef4444';

  return (
    <AbsoluteFill style={{ backgroundColor: '#09090b', fontFamily: '"Montserrat", sans-serif' }}>
      
      {/* Timer Sound */}
      <Sequence from={timerStartFrame} durationInFrames={timerFrames}>
        <Audio src={staticFile('timer.mp3')} volume={0.8} />
      </Sequence>
      
      {/* Reveal Sound (only for rounds with results) */}
      {isTimerDone && !isLastRound && (
        <Sequence from={timerStartFrame + timerFrames} durationInFrames={30}>
          <Audio src={staticFile('correct.mp3')} volume={1} />
        </Sequence>
      )}

      {/* Top Blue Card (Scenario A) */}
      <div style={{
        position: 'absolute',
        top: 50,
        left: 50,
        right: 50,
        height: 860,
        background: 'linear-gradient(160deg, #1d4ed8 0%, #1e3a8a 60%, #0f172a 100%)',
        borderRadius: 32,
        border: '4px solid #3b82f6',
        boxShadow: '0 16px 40px rgba(29, 78, 216, 0.45)',
        transform: `translateY(${(1 - panelAProgress) * -120}%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 24,
        boxSizing: 'border-box',
        overflow: 'hidden',
        zIndex: 5
      }}>
        {/* Equal-sized Image Box (width: 100%, height: 510) */}
        <div style={{
          width: '100%',
          height: 510,
          borderRadius: 22,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#0a0a0a',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          flexShrink: 0
        }}>
          {image_url_a && (
            <Img 
              src={image_url_a} 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover', 
                opacity: isTimerDone && !isLastRound && !isAHigher ? 0.35 : 1 
              }} 
            />
          )}
          {flashA && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'white', opacity: 0.5, zIndex: 10 }} />}
        </div>

        {/* Text & Result Area */}
        <div style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 20px',
          boxSizing: 'border-box'
        }}>
          {isTimerDone && !isLastRound ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              transform: `scale(${resultScale})` 
            }}>
              <span style={{ 
                fontSize: 135, 
                fontWeight: 900, 
                color: isAHigher ? VIBRANT_GREEN : VIBRANT_RED, 
                textShadow: '0 6px 28px rgba(0,0,0,0.95)',
                letterSpacing: '-2px'
              }}>
                {percent_a}%
              </span>
            </div>
          ) : (
            <h2 style={{ 
              fontSize: 48, 
              fontWeight: 800, 
              color: '#ffffff', 
              textAlign: 'center', 
              lineHeight: 1.25, 
              margin: 0,
              textShadow: '0 4px 14px rgba(0,0,0,0.8)'
            }}>
              {option_a}
            </h2>
          )}
        </div>
      </div>

      {/* Bottom Red Card (Scenario B) */}
      <div style={{
        position: 'absolute',
        top: 1010,
        left: 50,
        right: 50,
        height: 860,
        background: 'linear-gradient(160deg, #dc2626 0%, #991b1b 60%, #450a0a 100%)',
        borderRadius: 32,
        border: '4px solid #ef4444',
        boxShadow: '0 16px 40px rgba(220, 38, 38, 0.45)',
        transform: `translateY(${(1 - panelBProgress) * 120}%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 24,
        boxSizing: 'border-box',
        overflow: 'hidden',
        zIndex: 5
      }}>
        {/* Text & Result Area (on top for Red card) */}
        <div style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 20px',
          boxSizing: 'border-box'
        }}>
          {isTimerDone && !isLastRound ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              transform: `scale(${resultScale})` 
            }}>
              <span style={{ 
                fontSize: 135, 
                fontWeight: 900, 
                color: !isAHigher ? VIBRANT_GREEN : VIBRANT_RED, 
                textShadow: '0 6px 28px rgba(0,0,0,0.95)',
                letterSpacing: '-2px'
              }}>
                {percent_b}%
              </span>
            </div>
          ) : (
            <h2 style={{ 
              fontSize: 48, 
              fontWeight: 800, 
              color: '#ffffff', 
              textAlign: 'center', 
              lineHeight: 1.25, 
              margin: 0,
              textShadow: '0 4px 14px rgba(0,0,0,0.8)'
            }}>
              {option_b}
            </h2>
          )}
        </div>

        {/* Equal-sized Image Box (on bottom for Red card, width: 100%, height: 510) */}
        <div style={{
          width: '100%',
          height: 510,
          borderRadius: 22,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#0a0a0a',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          flexShrink: 0
        }}>
          {image_url_b && (
            <Img 
              src={image_url_b} 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover', 
                opacity: isTimerDone && !isLastRound && isAHigher ? 0.35 : 1 
              }} 
            />
          )}
          {flashB && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'white', opacity: 0.5, zIndex: 10 }} />}
        </div>
      </div>

      {/* Center UI / VS Badge */}
      {isTimerDone && isLastRound ? (
        <div style={{
          position: 'absolute',
          top: 960,
          left: 540,
          transform: `translate(-50%, -50%) scale(${resultScale})`,
          zIndex: 30,
          backgroundColor: 'rgba(0,0,0,0.85)',
          padding: '24px 44px',
          borderRadius: 30,
          border: '3px solid rgba(255,255,255,0.3)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.9)',
          textAlign: 'center',
          whiteSpace: 'nowrap'
        }}>
          <span style={{ fontSize: 44, fontWeight: 800, color: '#f8fafc', letterSpacing: '1px' }}>
            Comment Your Choice!
          </span>
        </div>
      ) : (
        <div style={{
          position: 'absolute',
          top: 960,
          left: 540,
          transform: `translate(-50%, -50%) scale(${vsScale})`,
          width: 140,
          height: 140,
          backgroundColor: '#f8fafc',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
          zIndex: 25
        }}>
          {frame >= timerStartFrame && !isTimerDone ? (
            <svg style={{ width: 140, height: 140, position: 'absolute', transform: 'rotate(-90deg)' }}>
              <circle cx="70" cy="70" r="60" stroke="#cbd5e1" strokeWidth="10" fill="none" />
              <circle cx="70" cy="70" r="60" stroke="#e11d48" strokeWidth="10" fill="none" 
                strokeDasharray="377" strokeDashoffset={377 - (377 * timerProgress)} 
                strokeLinecap="round" />
            </svg>
          ) : null}
          <span style={{ fontSize: 52, fontWeight: 900, color: '#0f172a' }}>VS</span>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const WouldYouRather: React.FC<{ data_json: WouldYouRatherJson; topic: string }> = ({ data_json, topic }) => {
  const { fps } = useVideoConfig();
  const { scenarios, tts_urls, bg_music_url, bg_music_volume } = data_json;

  if (!scenarios || !Array.isArray(scenarios)) {
    return <AbsoluteFill style={{ backgroundColor: '#111' }}><h1 style={{ color: 'white' }}>Invalid Data</h1></AbsoluteFill>;
  }

  const hasOutro = Boolean(data_json.end_title && data_json.end_title.trim());

  return (
    <AbsoluteFill style={{ backgroundColor: '#09090b' }}>
      {/* Background Music Support */}
      {bg_music_url && (data_json as any).bg_music_enabled !== false && (
        <Audio src={resolveAudioUrl(bg_music_url)} volume={bg_music_volume ?? 0.15} loop />
      )}

      <Series>
        {scenarios.map((scenario, index) => {
          const isFirstRound = index === 0;
          const timing = getWyrTiming(scenario, fps, isFirstRound);
          const ttsUrl = tts_urls && tts_urls[index] ? tts_urls[index] : null;
          const isLastRound = index === scenarios.length - 1;

          return (
            <Series.Sequence key={index} durationInFrames={timing.totalFrames}>
              {ttsUrl && <Audio src={ttsUrl} volume={0.9} />}
              <WyrRound 
                scenarioData={scenario} 
                topic={topic} 
                isLastRound={isLastRound} 
                isFirstRound={isFirstRound} 
              />
            </Series.Sequence>
          );
        })}

        {/* Outro Sequence: Only rendered when end_title is provided */}
        {hasOutro && (
          <Series.Sequence durationInFrames={Math.round(2.8 * fps)}>
            {tts_urls && tts_urls.length > scenarios.length && (
              <Audio src={tts_urls[scenarios.length]} volume={0.9} />
            )}
            <AbsoluteFill style={{ 
              backgroundColor: '#09090b', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'center', 
              padding: '0 60px',
              fontFamily: '"Montserrat", sans-serif'
            }}>
              <h1 style={{ 
                color: '#ffffff', 
                fontSize: 66, 
                fontWeight: 800, 
                textAlign: 'center', 
                lineHeight: 1.3,
                textShadow: '0 10px 30px rgba(0,0,0,0.9)',
                maxWidth: '90%'
              }}>
                <TypewriterText 
                  text={data_json.end_title!.trim()} 
                  durationInFrames={Math.round(2.8 * fps)} 
                  delayFrames={4} 
                />
              </h1>
            </AbsoluteFill>
          </Series.Sequence>
        )}
      </Series>
    </AbsoluteFill>
  );
};
