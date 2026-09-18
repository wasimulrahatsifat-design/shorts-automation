import React, { useMemo } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, interpolateColors, Sequence, Audio, Img, staticFile } from 'remotion';

interface DataItem {
  label: string;
  image_keyword: string;
  image_url?: string;
  values?: number[];
  value?: number; // fallback for old videos
}

interface DataJson {
  script: string;
  x_axis_label?: string;
  y_axis_label?: string;
  timeline_labels?: string[];
  items: DataItem[];
  tts_url?: string;
  show_subtitles?: boolean;
}

function formatNumberWithUnit(val: number, yAxisLabel?: string): string {
  if (val === undefined || val === null || isNaN(val)) return '0';

  const label = (yAxisLabel || '').trim();
  const labelLower = label.toLowerCase();

  // 1. Detect standard metric unit from yAxisLabel
  let unitSuffix = '';
  if (labelLower.includes('trillion') || /\b(\$)?t\b/i.test(label)) {
    unitSuffix = ' T';
  } else if (labelLower.includes('billion') || /\b(\$)?b\b/i.test(label)) {
    unitSuffix = ' B';
  } else if (labelLower.includes('million') || /\b(\$)?m\b/i.test(label)) {
    unitSuffix = ' M';
  } else if (labelLower.includes('thousand') || /\b(\$)?k\b/i.test(label)) {
    unitSuffix = ' K';
  } else if (labelLower.includes('%') || labelLower.includes('percent')) {
    unitSuffix = '%';
  } else {
    // Check if label specifies a unit in parentheses, e.g. "Capacity (GWh)" -> "GWh"
    const parenMatch = label.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1]) {
      const inside = parenMatch[1].trim();
      const insideLower = inside.toLowerCase();
      if (insideLower.includes('million')) unitSuffix = ' M';
      else if (insideLower.includes('billion')) unitSuffix = ' B';
      else if (insideLower.includes('trillion')) unitSuffix = ' T';
      else if (insideLower.includes('thousand')) unitSuffix = ' K';
      else if (inside.length <= 6) unitSuffix = ` ${inside}`;
    }
  }

  // 2. If a unit was found from yAxisLabel:
  if (unitSuffix) {
    if (unitSuffix.includes('M') && val >= 1_000_000) {
      val = val / 1_000_000;
    } else if (unitSuffix.includes('B') && val >= 1_000_000_000) {
      val = val / 1_000_000_000;
    } else if (unitSuffix.includes('T') && val >= 1_000_000_000_000) {
      val = val / 1_000_000_000_000;
    } else if (unitSuffix.includes('K') && val >= 1_000) {
      val = val / 1_000;
    }

    const formattedNum = Number.isInteger(val)
      ? val.toLocaleString()
      : (val < 10 ? val.toFixed(1) : Math.round(val).toLocaleString());
    return `${formattedNum}${unitSuffix}`;
  }

  // 3. Fallback: Automatically abbreviate raw large values
  const absVal = Math.abs(val);
  if (absVal >= 1_000_000_000_000) {
    const num = val / 1_000_000_000_000;
    return `${num % 1 === 0 ? num : num.toFixed(1)} T`;
  }
  if (absVal >= 1_000_000_000) {
    const num = val / 1_000_000_000;
    return `${num % 1 === 0 ? num : num.toFixed(1)} B`;
  }
  if (absVal >= 1_000_000) {
    const num = val / 1_000_000;
    return `${num % 1 === 0 ? num : num.toFixed(1)} M`;
  }
  if (absVal >= 10_000) {
    const num = val / 1_000;
    return `${num % 1 === 0 ? num : num.toFixed(1)} K`;
  }

  return Math.round(val).toLocaleString();
}

export const DataComparison: React.FC<{ data_json: DataJson, topic: string }> = ({ data_json, topic }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  const { script, items, timeline_labels, x_axis_label, y_axis_label } = data_json;

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

  // Find the Winner (highest final value)
  const winner = useMemo(() => {
    let highest = -1;
    let win = normalizedItems[0];
    normalizedItems.forEach(item => {
      const finalVal = item.values![item.values!.length - 1];
      if (finalVal > highest) {
        highest = finalVal;
        win = item;
      }
    });
    return { ...win, finalValue: highest };
  }, [normalizedItems]);

  // Animate Background
  const gradientProgress = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' });
  const color1 = interpolateColors(gradientProgress, [0, 1], ['#0f2027', '#2c5364']);
  const color2 = interpolateColors(gradientProgress, [0, 1], ['#203a43', '#0f2027']);

  // Winner Reveal Timings
  const winnerDuration = 90;
  const chartDuration = durationInFrames - winnerDuration;

  // Title Animations
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleScale = spring({ frame, fps, config: { damping: 14 } });
  
  const subtitleOpacity = interpolate(frame, [chartDuration - 30, chartDuration - 10], [1, 0], { extrapolateRight: 'clamp' });
  const chartOpacity = interpolate(frame, [chartDuration - 15, chartDuration], [1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  // Chart Layout Dimensions
  const chartX = 150;
  const chartY = 350;
  const chartW = width - 300;
  const chartH = height - 900;

  // Progress animation: finish drawing lines before the winner reveal
  const animDuration = Math.max(1, chartDuration - 30);
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

  // Current Label Index and Interpolation for smoothly incrementing numbers
  const currI = Math.min(Math.floor(progress), labelsCount - 1);
  const nextI = Math.min(currI + 1, labelsCount - 1);
  const frac = progress - currI;

  // Parse labels as numbers to smoothly interpolate if possible (e.g. "2020" -> "2021")
  const currLabelNum = parseFloat(labels[currI]);
  const nextLabelNum = parseFloat(labels[nextI]);
  let displayedLabel = labels[currI];
  if (!isNaN(currLabelNum) && !isNaN(nextLabelNum)) {
    displayedLabel = Math.round(interpolate(frac, [0, 1], [currLabelNum, nextLabelNum])).toString();
  }

  // Calculate current X across the chart to use for the clipPath (hides future paths)
  const curX = interpolate(frac, [0, 1], [paths[0].points[currI].x, paths[0].points[nextI].x]);

  // Winner Animations
  const winnerScale = spring({ frame: frame - chartDuration, fps, config: { damping: 12 } });
  const winnerOpacity = interpolate(frame, [chartDuration, chartDuration + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ 
      background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`, 
      color: 'white', 
      fontFamily: '"Montserrat", sans-serif',
    }}>
      {/* Audio Track */}
      {data_json.tts_url && <Audio src={data_json.tts_url} volume={0.9} />}

      {/* Graph Paper Grid Background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.12) 1.5px, transparent 1.5px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.12) 1.5px, transparent 1.5px),
          linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)
        `,
        backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px',
        backgroundPosition: '-1.5px -1.5px, -1.5px -1.5px, -1px -1px, -1px -1px',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <Sequence durationInFrames={chartDuration}>
        <AbsoluteFill style={{ opacity: chartOpacity }}>
          {/* Header Topic */}
          <div style={{ 
            position: 'absolute',
            top: 80,
            width: '100%',
            opacity: titleOpacity, 
            transform: `scale(${titleScale})`, 
            fontSize: 54, 
            fontWeight: 700, 
            textAlign: 'center',
            textShadow: '3px 3px 12px rgba(0,0,0,0.6)',
            color: '#f8f9fa',
            padding: '0 40px'
          }}>
            {topic || "Animated Line Chart"}
          </div>

          {/* SVG Chart Layer */}
          <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            {/* Dynamic ClipPath for True Racing Feel */}
            <clipPath id="racing-clip">
              <rect x={0} y={0} width={curX + 15} height={height} />
            </clipPath>

            {/* Grid Lines */}
            <line x1={chartX} y1={chartY + chartH} x2={chartX + chartW} y2={chartY + chartH} stroke="rgba(255,255,255,0.3)" strokeWidth={4} />
            <line x1={chartX} y1={chartY} x2={chartX} y2={chartY + chartH} stroke="rgba(255,255,255,0.3)" strokeWidth={4} />

            {/* Data Lines mapped with ClipPath */}
            {paths.map((pathData, idx) => (
              <path
                key={idx}
                d={pathData.d}
                fill="none"
                stroke={pathData.color}
                strokeWidth={8}
                strokeLinecap="round"
                strokeLinejoin="round"
                clipPath="url(#racing-clip)"
                style={{ filter: `drop-shadow(0px 10px 10px ${pathData.color}88)` }}
              />
            ))}
          </svg>

          {/* Axis Labels */}
          {y_axis_label && (
            <div style={{
              position: 'absolute',
              top: chartY + chartH / 2,
              left: 80,
              transform: 'translate(-50%, -50%) rotate(-90deg)',
              fontSize: 28,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.65)',
              letterSpacing: 2,
              textTransform: 'uppercase'
            }}>
              {y_axis_label}
            </div>
          )}
          {x_axis_label && (
            <div style={{
              position: 'absolute',
              top: chartY + chartH + 20,
              left: chartX + chartW / 2,
              transform: 'translate(-50%, 0)',
              fontSize: 28,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.65)',
              letterSpacing: 2,
              textTransform: 'uppercase'
            }}>
              {x_axis_label}
            </div>
          )}

          {/* Moving Avatars and Values */}
          {paths.map((pathData, idx) => {
            const p1 = pathData.points[currI];
            const p2 = pathData.points[nextI];
            
            const currentY = interpolate(frac, [0, 1], [p1.y, p2.y]);
            const curVal = interpolate(frac, [0, 1], [p1.val, p2.val]);

            const avatarSize = 90;

            return (
              <div key={idx} style={{
                position: 'absolute',
                left: curX - avatarSize / 2,
                top: currentY - avatarSize / 2,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 15,
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
                  zIndex: 10,
                  flexShrink: 0
                }}>
                  {pathData.item.image_url ? (
                    <Img src={pathData.item.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>

                {/* Label and Value grouped */}
                <div style={{
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  padding: '8px 18px',
                  borderRadius: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap',
                  zIndex: 5
                }}>
                  <span style={{ fontSize: 22, fontWeight: 600, color: '#e2e8f0' }}>{pathData.item.label}</span>
                  <span style={{ fontSize: 28, fontWeight: 700, color: pathData.color }}>
                    {formatNumberWithUnit(curVal, y_axis_label)}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Dynamic Timeline Text (Smooth Increment) positioned between graph bottom and avatars */}
          <div style={{
            position: 'absolute',
            bottom: 390,
            width: '100%',
            textAlign: 'center',
            fontSize: 84,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.35)',
            textTransform: 'uppercase',
            letterSpacing: '8px',
            zIndex: 1
          }}>
            {displayedLabel}
          </div>

          {/* Bottom Avatars */}
          <div style={{
            position: 'absolute',
            bottom: 180,
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 20,
            padding: '0 100px',
            flexWrap: 'wrap',
            zIndex: 2
          }}>
            {paths.map((pathData, idx) => (
              <div key={idx} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: 'clamp' })
              }}>
                <div style={{
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  border: `4px solid ${pathData.color}`,
                  overflow: 'hidden'
                }}>
                  {pathData.item.image_url ? (
                    <Img src={pathData.item.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>
                <div style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: 'white',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  maxWidth: 140,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {pathData.item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Subtitles Area (Hook Script) */}
          {data_json.show_subtitles !== false && (
            <Sequence from={15}>
              <div style={{
                position: 'absolute',
                bottom: 60,
                left: 100,
                right: 100,
                textAlign: 'center',
                fontSize: 44,
                fontWeight: 600,
                textShadow: '3px 3px 12px rgba(0,0,0,0.8)',
                backgroundColor: 'rgba(0,0,0,0.6)',
                padding: '20px 25px',
                borderRadius: 20,
                border: '3px solid rgba(255,255,255,0.1)',
                opacity: subtitleOpacity,
                zIndex: 10
              }}>
                {script}
              </div>
            </Sequence>
          )}
        </AbsoluteFill>
      </Sequence>

      {/* Winner Reveal Sequence */}
      <Sequence from={chartDuration}>
        <AbsoluteFill style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          opacity: winnerOpacity,
          transform: `scale(${winnerScale})`,
          zIndex: 20
        }}>
          {/* Winner Sound Effect */}
          <Audio src={staticFile('winner.mp3')} volume={1} />

          <h1 style={{
            fontSize: 74,
            fontWeight: 700,
            color: '#f1c40f',
            textShadow: '0 8px 18px rgba(0,0,0,0.8)',
            marginBottom: 35,
            textTransform: 'uppercase',
            letterSpacing: '4px'
          }}>
            Winner!
          </h1>

          <div style={{
            width: 340,
            height: 340,
            borderRadius: '50%',
            backgroundColor: '#333',
            border: `12px solid #f1c40f`,
            boxShadow: '0 15px 40px rgba(241,196,15,0.6)',
            overflow: 'hidden',
            marginBottom: 40
          }}>
            {winner.image_url ? (
              <Img src={winner.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : null}
          </div>

          <div style={{
            fontSize: 62,
            fontWeight: 700,
            color: '#ffffff',
            textShadow: '0 6px 12px rgba(0,0,0,0.6)',
            textAlign: 'center',
            marginBottom: 20
          }}>
            {winner.label}
          </div>

          <div style={{
            fontSize: 52,
            fontWeight: 700,
            color: '#2ecc71',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '14px 38px',
            borderRadius: 28,
            boxShadow: '0 8px 20px rgba(0,0,0,0.5)'
          }}>
            {formatNumberWithUnit(winner.finalValue, y_axis_label)}
          </div>
        </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};
