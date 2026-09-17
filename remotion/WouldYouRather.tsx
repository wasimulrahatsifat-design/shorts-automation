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
}

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

const WyrRound: React.FC<{ scenarioData: Scenario, topic: string }> = ({ scenarioData, topic }) => {
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

  // Flash effect: if timer is just done, flash the higher one for 1 sec (30 frames)
  const flashA = isAHigher && frame > (timerStartFrame + timerFrames) && frame < (timerStartFrame + timerFrames + 30);
  const flashB = !isAHigher && frame > (timerStartFrame + timerFrames) && frame < (timerStartFrame + timerFrames + 30);

  return (
    <AbsoluteFill style={{ backgroundColor: '#111', fontFamily: '"Montserrat", sans-serif' }}>
      
      {/* Timer Sound */}
      <Sequence from={timerStartFrame} durationInFrames={timerFrames}>
        <Audio src={staticFile('timer.mp3')} volume={0.8} />
      </Sequence>
      
      {/* Correct/Reveal Sound */}
      {isTimerDone && (
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
          <Img src={image_url_a} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', opacity: isTimerDone && !isAHigher ? 0.3 : 0.8 }} />
        )}
        {flashA && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'white', opacity: 0.5, zIndex: 5 }} />}
        
        {/* Black gradient to make text readable */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', zIndex: 1 }} />
        
        <h2 style={{ fontSize: 60, fontWeight: 900, color: 'white', textShadow: '2px 2px 10px rgba(0,0,0,0.8)', zIndex: 2, textAlign: 'center', padding: '0 80px' }}>
          {option_a}
        </h2>
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
          <Img src={image_url_b} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', opacity: isTimerDone && isAHigher ? 0.3 : 0.8 }} />
        )}
        {flashB && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'white', opacity: 0.5, zIndex: 5 }} />}
        
        {/* Black gradient to make text readable */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%', background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)', zIndex: 1 }} />
        
        <h2 style={{ fontSize: 60, fontWeight: 900, color: 'white', textShadow: '2px 2px 10px rgba(0,0,0,0.8)', zIndex: 2, textAlign: 'center', padding: '0 80px' }}>
          {option_b}
        </h2>
      </div>

      {/* Center UI */}
      {isTimerDone ? (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: `translate(-50%, -50%) scale(${resultScale})`,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          gap: 40
        }}>
          {/* Top Percentage */}
          <div style={{
            fontSize: 140, fontWeight: 900, 
            color: isAHigher ? '#2a9d8f' : '#e63946',
            textShadow: '0px 10px 30px rgba(0,0,0,1)',
            transform: 'translateY(-60px)'
          }}>
            {percent_a}%
          </div>
          
          {/* Bottom Percentage */}
          <div style={{
            fontSize: 140, fontWeight: 900, 
            color: !isAHigher ? '#2a9d8f' : '#e63946',
            textShadow: '0px 10px 30px rgba(0,0,0,1)',
            transform: 'translateY(60px)'
          }}>
            {percent_b}%
          </div>
        </div>
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

export const WouldYouRather: React.FC<{ data_json: WouldYouRatherJson, topic: string }> = ({ data_json, topic }) => {
  const { fps } = useVideoConfig();
  const { scenarios, tts_urls } = data_json;

  if (!scenarios || !Array.isArray(scenarios)) {
    return <AbsoluteFill style={{ backgroundColor: '#111' }}><h1 style={{ color: 'white' }}>Invalid Data</h1></AbsoluteFill>;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#111' }}>
      <Series>
        {scenarios.map((scenario, index) => {
          const timing = getWyrTiming(scenario, fps);
          const ttsUrl = tts_urls && tts_urls[index] ? tts_urls[index] : null;

          return (
            <Series.Sequence key={index} durationInFrames={timing.totalFrames}>
              {ttsUrl && <Audio src={ttsUrl} volume={0.9} />}
              <WyrRound scenarioData={scenario} topic={topic} />
            </Series.Sequence>
          );
        })}
        {/* Outro */}
        <Series.Sequence durationInFrames={3 * fps}>
           {tts_urls && tts_urls.length > scenarios.length && (
              <Audio src={tts_urls[scenarios.length]} volume={0.9} />
           )}
           <AbsoluteFill style={{ backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }}>
             <h1 style={{ color: 'white', fontSize: 80, fontFamily: '"Montserrat", sans-serif', fontWeight: 900 }}>Thanks for watching!</h1>
           </AbsoluteFill>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
