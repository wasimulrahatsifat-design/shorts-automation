import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, interpolateColors, Sequence, Audio, staticFile } from 'remotion';

interface DataItem {
  label: string;
  value: number;
  image_keyword: string;
}

interface DataJson {
  script: string;
  items: DataItem[];
}

export const DataComparison: React.FC<{ data_json: DataJson, topic: string }> = ({ data_json, topic }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const { script, items } = data_json;

  // Animate Background
  const gradientProgress = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' });
  const color1 = interpolateColors(gradientProgress, [0, 1], ['#0f2027', '#2c5364']);
  const color2 = interpolateColors(gradientProgress, [0, 1], ['#203a43', '#0f2027']);

  // Title Animations
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleScale = spring({ frame, fps, config: { damping: 14 } });
  
  // Subtitle opacity (fades out near the end)
  const subtitleOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames - 10], [1, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ 
      background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`, 
      color: 'white', 
      fontFamily: '"Montserrat", sans-serif',
      padding: '80px 60px'
    }}>
      
      {/* Background Music (requires public/bg-music.mp3) */}
      {/* <Audio src={staticFile('bg-music.mp3')} volume={0.1} /> */}
      
      {/* Voiceover Placeholder (requires public/voiceover.mp3) */}
      {/* <Audio src={staticFile('voiceover.mp3')} volume={0.8} /> */}

      <div style={{ 
        opacity: titleOpacity, 
        transform: `scale(${titleScale})`, 
        fontSize: 70, 
        fontWeight: 900, 
        marginBottom: 80, 
        textAlign: 'center',
        textShadow: '4px 4px 15px rgba(0,0,0,0.6)',
        color: '#f8f9fa'
      }}>
        {topic || "Data Comparison"}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, flex: 1, justifyContent: 'center' }}>
        {items.map((item, index) => {
          // Snappy stagger for each row
          const delay = index * 10 + 20;
          
          const progress = spring({
            frame: frame - delay,
            fps,
            config: {
              damping: 14,
              stiffness: 120, // Faster, snappier growth
            },
          });
          
          const maxVal = Math.max(...items.map(d => d.value));
          const targetBarWidth = maxVal === 0 ? 0 : (item.value / maxVal) * 100;
          const currentBarWidth = progress * targetBarWidth;
          
          // Count up effect
          const displayValue = Math.floor(progress * item.value);

          return (
            <div key={index} style={{ 
              opacity: interpolate(progress, [0, 1], [0, 1]), 
              transform: `translateY(${(1 - progress) * 50}px)` 
            }}>
              <div style={{ 
                fontSize: 45, 
                fontWeight: 700, 
                marginBottom: 12,
                textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
                color: '#e9ecef'
              }}>
                {item.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ 
                  width: `${Math.max(currentBarWidth, 1)}%`, 
                  height: 65, 
                  background: `linear-gradient(90deg, hsl(${index * 45}, 85%, 65%), hsl(${index * 45 + 30}, 85%, 55%))`, 
                  borderRadius: 15,
                  boxShadow: '0 10px 20px rgba(0,0,0,0.3)'
                }} />
                <div style={{ 
                  fontSize: 45, 
                  fontWeight: 900,
                  textShadow: '2px 2px 10px rgba(0,0,0,0.6)',
                  minWidth: 150
                }}>
                  {displayValue.toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Subtitles Area (Hook Script) */}
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
          backgroundColor: 'rgba(0,0,0,0.4)',
          padding: '25px',
          borderRadius: 20,
          border: '4px solid rgba(255,255,255,0.1)',
          opacity: subtitleOpacity
        }}>
          {script}
        </div>
      </Sequence>
      
    </AbsoluteFill>
  );
};
