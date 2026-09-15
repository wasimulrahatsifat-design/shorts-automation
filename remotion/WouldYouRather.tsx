import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence, Audio, Img } from 'remotion';

interface WouldYouRatherJson {
  script: string;
  scenario_a: string;
  scenario_b: string;
  image_url_a?: string;
  image_url_b?: string;
  tts_url?: string;
  show_subtitles?: boolean;
}

export const WouldYouRather: React.FC<{ data_json: WouldYouRatherJson, topic: string }> = ({ data_json, topic }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const { script, scenario_a, scenario_b, image_url_a, image_url_b, tts_url, show_subtitles } = data_json;

  // Title Animations
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleScale = spring({ frame, fps, config: { damping: 14 } });

  // Entrance animations for panels
  const panelAProgress = spring({ frame: frame - 10, fps, config: { damping: 14 } });
  const panelBProgress = spring({ frame: frame - 30, fps, config: { damping: 14 } });
  
  // VS badge animation
  const vsScale = spring({ frame: frame - 45, fps, config: { damping: 10, stiffness: 150 } });

  const subtitleOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames - 10], [1, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#111', fontFamily: '"Montserrat", sans-serif' }}>
      {/* Audio Track */}
      {tts_url && <Audio src={tts_url} volume={0.9} />}

      {/* Top Panel (Scenario A) */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, height: '50%',
        backgroundColor: '#e63946',
        transform: `translateY(${(1 - panelAProgress) * -100}%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        overflow: 'hidden'
      }}>
        {image_url_a && (
          <Img src={image_url_a} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />
        )}
        <h2 style={{ fontSize: 60, fontWeight: 900, color: 'white', textShadow: '2px 2px 10px rgba(0,0,0,0.8)', zIndex: 1, textAlign: 'center' }}>
          {scenario_a}
        </h2>
      </div>

      {/* Bottom Panel (Scenario B) */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0, height: '50%',
        backgroundColor: '#1d3557',
        transform: `translateY(${(1 - panelBProgress) * 100}%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        overflow: 'hidden'
      }}>
        {image_url_b && (
          <Img src={image_url_b} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />
        )}
        <h2 style={{ fontSize: 60, fontWeight: 900, color: 'white', textShadow: '2px 2px 10px rgba(0,0,0,0.8)', zIndex: 1, textAlign: 'center' }}>
          {scenario_b}
        </h2>
      </div>

      {/* VS Badge */}
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
        <span style={{ fontSize: 60, fontWeight: 900, color: '#1d3557' }}>VS</span>
      </div>

      {/* Title */}
      <div style={{ 
        position: 'absolute',
        top: 60,
        width: '100%',
        opacity: titleOpacity, 
        transform: `scale(${titleScale})`, 
        fontSize: 70, 
        fontWeight: 900, 
        textAlign: 'center',
        textShadow: '4px 4px 15px rgba(0,0,0,0.8)',
        color: '#f8f9fa',
        zIndex: 20
      }}>
        {topic || "Would You Rather..."}
      </div>

      {/* Subtitles Area */}
      {show_subtitles !== false && (
        <Sequence from={15}>
          <div style={{
            position: 'absolute',
            bottom: 100,
            left: 60,
            right: 60,
            textAlign: 'center',
            fontSize: 50,
            fontWeight: 800,
            textShadow: '4px 4px 15px rgba(0,0,0,0.8)',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: '25px',
            borderRadius: 20,
            border: '4px solid rgba(255,255,255,0.1)',
            opacity: subtitleOpacity,
            color: 'white',
            zIndex: 20
          }}>
            {script}
          </div>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
