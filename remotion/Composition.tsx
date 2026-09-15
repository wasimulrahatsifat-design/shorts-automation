import React, { useMemo } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, interpolateColors, Sequence, Audio, Img } from 'remotion';

interface DataItem {
  label: string;
  image_keyword: string;
  image_url?: string;
  values?: number[];
  value?: number; // fallback for old videos
}

interface DataJson {
  script: string;
  timeline_labels?: string[];
  items: DataItem[];
  tts_url?: string;
  show_subtitles?: boolean;
}

export const DataComparison: React.FC<{ data_json: DataJson, topic: string }> = ({ data_json, topic }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  const { script, items, timeline_labels } = data_json;

  // Fallback for old videos that didn't have timeline_labels or values arrays
  const isOldFormat = !timeline_labels || timeline_labels.length === 0 || !items[0].values;
  const labels = isOldFormat ? ['Start', 'End'] : timeline_labels!;
  
  // Normalize items to ensure they all have a values array
  const normalizedItems = useMemo(() => {
    return items.map(item => ({
      ...item,
      values: isOldFormat ? [0, item.value || 0] : (item.values || [])
    }));
  }, [items, isOldFormat]);

  const labelsCount = labels.length;
  
  // Find the absolute maximum value to scale the Y axis
  const maxVal = useMemo(() => {
    return Math.max(1, ...normalizedItems.flatMap(i => i.values!));
  }, [normalizedItems]);

  // Animate Background
  const gradientProgress = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' });
  const color1 = interpolateColors(gradientProgress, [0, 1], ['#0f2027', '#2c5364']);
  const color2 = interpolateColors(gradientProgress, [0, 1], ['#203a43', '#0f2027']);

  // Title Animations
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleScale = spring({ frame, fps, config: { damping: 14 } });
  
  const subtitleOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames - 10], [1, 0], { extrapolateRight: 'clamp' });

  // Chart Layout Dimensions
  const chartX = 100;
  const chartY = 350;
  const chartW = width - 200;
  const chartH = height - 800; // Leave room for title and bottom text

  // Progress animation: from 0 to labelsCount - 1 over the duration (stopping 30 frames early)
  const animDuration = Math.max(1, durationInFrames - 30);
  const progress = interpolate(frame, [15, animDuration], [0, labelsCount - 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Calculate paths for each item
  const paths = useMemo(() => {
    return normalizedItems.map((item, index) => {
      const points = item.values!.map((val, i) => {
        const x = chartX + (i / Math.max(1, labelsCount - 1)) * chartW;
        const y = chartY + chartH - (val / maxVal) * chartH;
        return { x, y, val };
      });

      const d = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
      const color = `hsl(${index * (360 / normalizedItems.length)}, 85%, 65%)`;

      return { item, points, d, color };
    });
  }, [normalizedItems, labelsCount, maxVal, chartW, chartH, chartX, chartY]);

  // Current Label Index
  const currentIndex = Math.min(Math.floor(progress), labelsCount - 1);
  const currentLabel = labels[currentIndex];

  return (
    <AbsoluteFill style={{ 
      background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`, 
      color: 'white', 
      fontFamily: '"Montserrat", sans-serif',
    }}>
      {/* Audio Track */}
      {data_json.tts_url && <Audio src={data_json.tts_url} volume={0.9} />}

      {/* Header Topic */}
      <div style={{ 
        position: 'absolute',
        top: 80,
        width: '100%',
        opacity: titleOpacity, 
        transform: `scale(${titleScale})`, 
        fontSize: 60, 
        fontWeight: 900, 
        textAlign: 'center',
        textShadow: '4px 4px 15px rgba(0,0,0,0.6)',
        color: '#f8f9fa'
      }}>
        {topic || "Animated Line Chart"}
      </div>

      {/* SVG Chart Layer */}
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* Grid Lines */}
        <line x1={chartX} y1={chartY + chartH} x2={chartX + chartW} y2={chartY + chartH} stroke="rgba(255,255,255,0.3)" strokeWidth={4} />
        <line x1={chartX} y1={chartY} x2={chartX} y2={chartY + chartH} stroke="rgba(255,255,255,0.3)" strokeWidth={4} />

        {/* Data Lines */}
        {paths.map((pathData, idx) => {
          // Calculate length to animate dashoffset (rough estimation or just very large)
          const totalLength = chartW * 3; // safe large number for strokeDasharray
          const drawProgress = progress / Math.max(1, labelsCount - 1);
          const drawnLength = drawProgress * totalLength;

          return (
            <path
              key={idx}
              d={pathData.d}
              fill="none"
              stroke={pathData.color}
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={totalLength}
              strokeDashoffset={totalLength - drawnLength}
              style={{ filter: `drop-shadow(0px 10px 10px ${pathData.color}88)` }}
            />
          );
        })}
      </svg>

      {/* Moving Avatars and Values */}
      {paths.map((pathData, idx) => {
        const currI = Math.floor(progress);
        const nextI = Math.min(currI + 1, labelsCount - 1);
        const frac = progress - currI;

        const p1 = pathData.points[currI];
        const p2 = pathData.points[nextI];
        
        const curX = interpolate(frac, [0, 1], [p1.x, p2.x]);
        const curY = interpolate(frac, [0, 1], [p1.y, p2.y]);
        const curVal = interpolate(frac, [0, 1], [p1.val, p2.val]);

        const avatarSize = 90;

        return (
          <div key={idx} style={{
            position: 'absolute',
            left: curX - avatarSize / 2,
            top: curY - avatarSize / 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: 'clamp' })
          }}>
            {/* Avatar Image */}
            <div style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: '50%',
              backgroundColor: '#333',
              border: `6px solid ${pathData.color}`,
              boxShadow: '0 8px 16px rgba(0,0,0,0.6)',
              overflow: 'hidden',
              zIndex: 10
            }}>
              {pathData.item.image_url ? (
                <Img src={pathData.item.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : null}
            </div>

            {/* Label and Value */}
            <div style={{
              marginTop: 15,
              backgroundColor: 'rgba(0,0,0,0.7)',
              padding: '10px 20px',
              borderRadius: 15,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              whiteSpace: 'nowrap'
            }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#ccc' }}>{pathData.item.label}</span>
              <span style={{ fontSize: 32, fontWeight: 900, color: pathData.color }}>
                {Math.round(curVal).toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}

      {/* Dynamic Timeline Text */}
      <div style={{
        position: 'absolute',
        bottom: 300,
        width: '100%',
        textAlign: 'center',
        fontSize: 100,
        fontWeight: 900,
        color: 'rgba(255,255,255,0.2)',
        textTransform: 'uppercase',
        letterSpacing: '10px',
        zIndex: 0
      }}>
        {currentLabel}
      </div>

      {/* Subtitles Area (Hook Script) */}
      {data_json.show_subtitles !== false && (
        <Sequence from={15}>
          <div style={{
            position: 'absolute',
            bottom: 80,
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
            opacity: subtitleOpacity
          }}>
            {script}
          </div>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
