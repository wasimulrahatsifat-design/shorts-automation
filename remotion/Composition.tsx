import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface DataItem {
  label: string;
  value: number;
  image_keyword: string;
}

export const DataComparison: React.FC<{ data_json: DataItem[], topic: string }> = ({ data_json, topic }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 15], [50, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#111', color: 'white', fontFamily: 'sans-serif', padding: 100 }}>
      <div style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)`, fontSize: 60, fontWeight: 'bold', marginBottom: 100, textAlign: 'center' }}>
        {topic || "Data Comparison"}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 40, flex: 1, justifyContent: 'center' }}>
        {data_json.map((item, index) => {
          // Stagger the animation of each row by 15 frames
          const delay = index * 15 + 20;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: {
              damping: 12,
            },
          });
          
          const maxVal = Math.max(...data_json.map(d => d.value));
          const barWidth = maxVal === 0 ? 0 : progress * (item.value / maxVal) * 100;
          
          return (
            <div key={index} style={{ opacity: progress, transform: `translateX(${(1 - progress) * 100}px)` }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>{item.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ 
                  width: `${Math.max(barWidth, 1)}%`, 
                  height: 60, 
                  backgroundColor: `hsl(${index * 50}, 80%, 60%)`, 
                  borderRadius: 10 
                }} />
                <div style={{ fontSize: 40, fontWeight: 'bold' }}>{item.value}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
