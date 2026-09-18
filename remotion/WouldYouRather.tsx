import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence, Audio, Img, Series, staticFile } from 'remotion';

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
  bg_music_url?: string;
  bg_music_volume?: number;
  bg_music_enabled?: boolean;
}

const resolveAudioUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const clean = url.startsWith('/') ? url.slice(1) : url;
  return staticFile(clean);
};

export const getWyrTiming = (s: Scenario, fps: number) => {
  const textLength = s.option_a.length + s.option_b.length + 20; // "Would you rather option a or option b"
  // ~15 chars per sec is a good average for natural reading + 1s padding for punctuation
  const readingSeconds = (textLength / 15);
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

const WyrRound: React.FC<{ scenarioData: Scenario; topic: string; isLastRound?: boolean }> = ({ scenarioData, topic, isLastRound }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { option_a, option_b, image_url_a, image_url_b, percent_a, percent_b } = scenarioData;

  // Entrance animations for panels
  const panelAProgress = spring({ frame: frame - 10, fps, config: { damping: 14 } });
  const panelBProgress = spring({ frame: frame - 20, fps, config: { damping: 14 } });
  
  // VS badge animation
  const vsScale = spring({ frame: frame - 30, fps, config: { damping: 10, stiffness: 150 } });

  // Timing
  const { readingFrames, timerFrames } = getWyrTiming(scenarioData, fps);
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
    <AbsoluteFill style={{ backgroundColor: '#111', fontFamily: '"Montserrat", sans-serif' }}>
      
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

      {/* Top Panel (Scenario A) */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, height: '50%',
        backgroundColor: '#0a0908',
        transform: `translateY(${(1 - panelAProgress) * -100}%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: '80px',
        overflow: 'hidden'
      }}>
        {image_url_a && (
          <Img 
            src={image_url_a} 
            style={{ 
              position: 'absolute', 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover', 
              opacity: isTimerDone && !isLastRound && !isAHigher ? 0.3 : 0.85 
            }} 
          />
        )}
        {flashA && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'white', opacity: 0.5, zIndex: 5 }} />}
        
        {/* Black gradient to make text readable */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', zIndex: 1 }} />
        
        {/* Option A Text: Disappears when percentage / result is shown */}
        {!isTimerDone && (
          <h2 style={{ 
            fontSize: 58, 
            fontWeight: 800, 
            color: 'white', 
            textShadow: '2px 2px 12px rgba(0,0,0,0.9)', 
            zIndex: 2, 
            textAlign: 'center', 
            padding: '0 70px',
            lineHeight: 1.25
          }}>
            {option_a}
          </h2>
        )}
      </div>

      {/* Bottom Panel (Scenario B) */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0, height: '50%',
        backgroundColor: '#0a0908',
        transform: `translateY(${(1 - panelBProgress) * 100}%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: '80px',
        overflow: 'hidden'
      }}>
        {image_url_b && (
          <Img 
            src={image_url_b} 
            style={{ 
              position: 'absolute', 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover', 
              opacity: isTimerDone && !isLastRound && isAHigher ? 0.3 : 0.85 
            }} 
          />
        )}
        {flashB && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'white', opacity: 0.5, zIndex: 5 }} />}
        
        {/* Black gradient to make text readable */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%', background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)', zIndex: 1 }} />
        
        {/* Option B Text: Disappears when percentage / result is shown */}
        {!isTimerDone && (
          <h2 style={{ 
            fontSize: 58, 
            fontWeight: 800, 
            color: 'white', 
            textShadow: '2px 2px 12px rgba(0,0,0,0.9)', 
            zIndex: 2, 
            textAlign: 'center', 
            padding: '0 70px',
            lineHeight: 1.25
          }}>
            {option_b}
          </h2>
        )}
      </div>

      {/* Center UI */}
      {isTimerDone ? (
        // For the last round, DO NOT show percentage! Show callout or clean view
        isLastRound ? (
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: `translate(-50%, -50%) scale(${resultScale})`,
            zIndex: 15,
            backgroundColor: 'rgba(0,0,0,0.75)',
            padding: '24px 44px',
            borderRadius: 30,
            border: '2px solid rgba(255,255,255,0.2)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
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
            top: '50%', left: '50%',
            transform: `translate(-50%, -50%) scale(${resultScale})`,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 15,
            gap: 50
          }}>
            {/* Top Percentage with True Vibrant Green */}
            <div style={{
              fontSize: 145, 
              fontWeight: 900, 
              color: isAHigher ? VIBRANT_GREEN : VIBRANT_RED,
              textShadow: '0px 10px 30px rgba(0,0,0,1)',
              transform: 'translateY(-60px)'
            }}>
              {percent_a}%
            </div>
            
            {/* Bottom Percentage with True Vibrant Green */}
            <div style={{
              fontSize: 145, 
              fontWeight: 900, 
              color: !isAHigher ? VIBRANT_GREEN : VIBRANT_RED,
              textShadow: '0px 10px 30px rgba(0,0,0,1)',
              transform: 'translateY(60px)'
            }}>
              {percent_b}%
            </div>
          </div>
        )
      ) : (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: `translate(-50%, -50%) scale(${vsScale})`,
          width: 150, height: 150,
          backgroundColor: '#f1faee',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 10
        }}>
          {frame >= timerStartFrame ? (
            <svg style={{ width: 150, height: 150, position: 'absolute', transform: 'rotate(-90deg)' }}>
              <circle cx="75" cy="75" r="65" stroke="#ccc" strokeWidth="10" fill="none" />
              <circle cx="75" cy="75" r="65" stroke="#e63946" strokeWidth="10" fill="none" 
                strokeDasharray="408" strokeDashoffset={408 - (408 * timerProgress)} 
                strokeLinecap="round" />
            </svg>
          ) : null}
          <span style={{ fontSize: 60, fontWeight: 900, color: '#1d3557' }}>VS</span>
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

  return (
    <AbsoluteFill style={{ backgroundColor: '#111' }}>
      {/* Background Music Support */}
      {bg_music_url && (data_json as any).bg_music_enabled !== false && (
        <Audio src={resolveAudioUrl(bg_music_url)} volume={bg_music_volume ?? 0.15} loop />
      )}

      <Series>
        {scenarios.map((scenario, index) => {
          const timing = getWyrTiming(scenario, fps);
          const ttsUrl = tts_urls && tts_urls[index] ? tts_urls[index] : null;
          const isLastRound = index === scenarios.length - 1;

          return (
            <Series.Sequence key={index} durationInFrames={timing.totalFrames}>
              {ttsUrl && <Audio src={ttsUrl} volume={0.9} />}
              <WyrRound scenarioData={scenario} topic={topic} isLastRound={isLastRound} />
            </Series.Sequence>
          );
        })}

        {/* Outro: "Write down in the comment section." ... "Thanks." */}
        <Series.Sequence durationInFrames={Math.round(3.5 * fps)}>
          {tts_urls && tts_urls.length > scenarios.length && (
            <Audio src={tts_urls[scenarios.length]} volume={0.9} />
          )}
          <AbsoluteFill style={{ 
            backgroundColor: '#0a0a0a', 
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
              textShadow: '0 10px 30px rgba(0,0,0,0.9)'
            }}>
              Write down in the comment section.
            </h1>
            <p style={{ 
              color: '#22c55e', 
              fontSize: 54, 
              fontWeight: 800, 
              marginTop: 28,
              textShadow: '0 6px 20px rgba(34,197,94,0.45)'
            }}>
              Thanks.
            </p>
          </AbsoluteFill>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
