import React, { useMemo } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, interpolateColors, Sequence, Audio, Img, staticFile } from 'remotion';
import { TypewriterText } from './TypewriterText';

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

function getRankBadgeStyle(rank: number) {
  if (rank === 1) {
    return {
      text: '1st',
      color: '#facc15', // Gold
      bg: 'rgba(250, 204, 21, 0.22)',
      border: '1.5px solid #facc15',
      glow: '0 0 12px rgba(250, 204, 21, 0.45)',
    };
  }
  if (rank === 2) {
    return {
      text: '2nd',
      color: '#e2e8f0', // Silver
      bg: 'rgba(226, 232, 240, 0.2)',
      border: '1.5px solid #cbd5e1',
      glow: '0 0 10px rgba(226, 232, 240, 0.3)',
    };
  }
  if (rank === 3) {
    return {
      text: '3rd',
      color: '#fb923c', // Bronze
      bg: 'rgba(251, 146, 60, 0.2)',
      border: '1.5px solid #fb923c',
      glow: '0 0 10px rgba(251, 146, 60, 0.3)',
    };
  }
  return {
    text: `${rank}th`,
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.15)',
    border: '1.5px solid rgba(148, 163, 184, 0.4)',
    glow: 'none',
  };
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
  const chartY = 370;
  const chartW = width - 300;
  const chartH = height - 980;

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

      {/* Background Music Track */}
      {data_json.bg_music_url && data_json.bg_music_enabled !== false && (
        <Audio src={resolveAudioUrl(data_json.bg_music_url)} volume={data_json.bg_music_volume ?? 0.15} loop />
      )}

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
          {/* Header Topic with proper top padding */}
          <div style={{ 
            position: 'absolute',
            top: 60,
            width: '100%',
            opacity: titleOpacity, 
            transform: `scale(${titleScale})`, 
            fontSize: 46, 
            fontWeight: 700, 
            lineHeight: 1.25,
            textAlign: 'center',
            textShadow: '3px 3px 12px rgba(0,0,0,0.7)',
            color: '#f8f9fa',
            padding: '0 45px',
            boxSizing: 'border-box'
          }}>
            {topic || "Animated Line Chart"}
          </div>

          {/* Clean Fixed Legend Overlay (Names & Colors) - Rock-solid stable layout */}
          {(() => {
            const itemCount = paths.length;
            // Determine fixed widths per item so badges NEVER resize, drift, wrap mid-animation or shift flex center
            const pillWidth = itemCount <= 2 ? 420 : (itemCount === 3 ? 300 : (itemCount === 4 ? 420 : 300));
            const gap = itemCount >= 5 ? 12 : 14;
            const topPos = itemCount > 3 ? 180 : 195;

            return (
              <div style={{
                position: 'absolute',
                top: topPos,
                left: 40,
                right: 40,
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap,
                flexWrap: 'wrap',
                zIndex: 15,
                opacity: interpolate(frame, [10, 25], [0, 1], { extrapolateRight: 'clamp' }),
              }}>
                {paths.map((pathData, idx) => {
                  const p1 = pathData.points[currI];
                  const p2 = pathData.points[nextI];
                  const curVal = interpolate(frac, [0, 1], [p1.val, p2.val]);

                  return (
                    <div
                      key={idx}
                      style={{
                        width: pillWidth,
                        minWidth: pillWidth,
                        maxWidth: pillWidth,
                        height: 44,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'rgba(15, 23, 42, 0.88)',
                        backdropFilter: 'blur(10px)',
                        border: `2px solid ${pathData.color}aa`,
                        borderRadius: 999,
                        padding: '0 14px',
                        boxShadow: `0 4px 14px rgba(0,0,0,0.5), 0 0 10px ${pathData.color}33`,
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Left Section: Avatar + Label */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                      }}>
                        {/* Legend Avatar or Color Dot */}
                        <div style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          backgroundColor: pathData.color,
                          overflow: 'hidden',
                          flexShrink: 0,
                          border: '2px solid rgba(255,255,255,0.85)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {pathData.item.image_url ? (
                            <Img src={pathData.item.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'white' }} />
                          )}
                        </div>

                        {/* Name */}
                        <span style={{
                          fontSize: pillWidth > 350 ? 21 : 18,
                          fontWeight: 700,
                          color: '#f8fafc',
                          letterSpacing: '0.2px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                        }}>
                          {pathData.item.label}
                        </span>
                      </div>

                      {/* Right Section: Live Value (tabular-nums prevents digit jitter) */}
                      <span style={{
                        fontSize: pillWidth > 350 ? 22 : 19,
                        fontWeight: 800,
                        color: pathData.color,
                        fontVariantNumeric: 'tabular-nums',
                        fontFeatureSettings: '"tnum"',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        marginLeft: 8,
                        textAlign: 'right',
                        textShadow: `0 0 10px ${pathData.color}44`,
                      }}>
                        {formatNumberWithUnit(curVal, y_axis_label)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* SVG Chart Layer */}
          <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            {/* Dynamic ClipPath for True Racing Feel */}
            <clipPath id="racing-clip">
              <rect x={0} y={0} width={curX + 15} height={height} />
            </clipPath>

            {/* Grid Axes Lines */}
            <line x1={chartX} y1={chartY + chartH} x2={chartX + chartW} y2={chartY + chartH} stroke="rgba(255,255,255,0.4)" strokeWidth={4} />
            <line x1={chartX} y1={chartY} x2={chartX} y2={chartY + chartH} stroke="rgba(255,255,255,0.4)" strokeWidth={4} />

            {/* X-Axis Tick Marks and Timeline Labels */}
            {labels.map((lbl, i) => {
              const xPos = chartX + (i / Math.max(1, labelsCount - 1)) * chartW;
              return (
                <g key={`x-tick-${i}`}>
                  {/* Vertical Tick Mark ("দাগ কাটা") */}
                  <line
                    x1={xPos}
                    y1={chartY + chartH}
                    x2={xPos}
                    y2={chartY + chartH + 12}
                    stroke="rgba(255,255,255,0.75)"
                    strokeWidth={2.5}
                  />
                  {/* Subtle vertical dashed grid line up through chart */}
                  <line
                    x1={xPos}
                    y1={chartY}
                    x2={xPos}
                    y2={chartY + chartH}
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                  {/* Small Timeline Label Text below tick mark */}
                  <text
                    x={xPos}
                    y={chartY + chartH + 34}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.8)"
                    fontSize={labelsCount > 7 ? 16 : 20}
                    fontWeight={600}
                    fontFamily='"Montserrat", sans-serif'
                  >
                    {lbl}
                  </text>
                </g>
              );
            })}

            {/* Y-Axis Tick Marks, Grid Lines, and Value Labels */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((step, idx) => {
              const tickVal = step * maxVal;
              const yPos = chartY + chartH - step * chartH;
              return (
                <g key={`y-tick-${idx}`}>
                  {/* Horizontal Tick Mark ("দাগ কাটা") on Y Axis */}
                  <line
                    x1={chartX - 12}
                    y1={yPos}
                    x2={chartX}
                    y2={yPos}
                    stroke="rgba(255,255,255,0.75)"
                    strokeWidth={2.5}
                  />
                  {/* Subtle horizontal dashed grid line across chart */}
                  {step > 0 && (
                    <line
                      x1={chartX}
                      y1={yPos}
                      x2={chartX + chartW}
                      y2={yPos}
                      stroke="rgba(255,255,255,0.08)"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                  )}
                  {/* Small Value Label to the left of tick mark */}
                  <text
                    x={chartX - 18}
                    y={yPos + 6}
                    textAnchor="end"
                    fill="rgba(255,255,255,0.8)"
                    fontSize={18}
                    fontWeight={600}
                    fontFamily='"Montserrat", sans-serif'
                  >
                    {step === 0 ? '0' : formatNumberWithUnit(tickVal, y_axis_label)}
                  </text>
                </g>
              );
            })}

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

          {/* Y Axis Label */}
          {y_axis_label && (
            <div style={{
              position: 'absolute',
              top: chartY + chartH / 2,
              left: 45,
              transform: 'translate(-50%, -50%) rotate(-90deg)',
              fontSize: 24,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.65)',
              letterSpacing: 2,
              textTransform: 'uppercase'
            }}>
              {y_axis_label}
            </div>
          )}

          {/* Optional X Axis Category Label if distinct from timeline labels */}
          {x_axis_label && (
            <div style={{
              position: 'absolute',
              top: chartY + chartH + 52,
              left: chartX + chartW / 2,
              transform: 'translate(-50%, 0)',
              fontSize: 22,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: 2,
              textTransform: 'uppercase'
            }}>
              {x_axis_label}
            </div>
          )}

          {/* Moving Avatars at the head of each line (Circles ONLY - No overlapping text) */}
          {paths.map((pathData, idx) => {
            const p1 = pathData.points[currI];
            const p2 = pathData.points[nextI];
            
            const currentY = interpolate(frac, [0, 1], [p1.y, p2.y]);
            const avatarSize = 78;

            return (
              <div 
                key={idx} 
                style={{
                  position: 'absolute',
                  left: curX - avatarSize / 2,
                  top: currentY - avatarSize / 2,
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: '50%',
                  backgroundColor: '#1e293b',
                  border: `5px solid ${pathData.color}`,
                  boxShadow: `0 6px 18px rgba(0,0,0,0.7), 0 0 16px ${pathData.color}99`,
                  overflow: 'hidden',
                  zIndex: 10,
                  opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: 'clamp' }),
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {pathData.item.image_url ? (
                  <Img src={pathData.item.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 22, fontWeight: 800, color: pathData.color }}>
                    {pathData.item.label.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            );
          })}

          {/* Dynamic Timeline Text (Slightly smaller size & pure White color) */}
          <div style={{
            position: 'absolute',
            bottom: 395,
            width: '100%',
            textAlign: 'center',
            fontSize: 66,
            fontWeight: 800,
            color: '#ffffff',
            textTransform: 'uppercase',
            letterSpacing: '8px',
            textShadow: '0 4px 18px rgba(0,0,0,0.75)',
            zIndex: 1
          }}>
            {displayedLabel}
          </div>

          {/* Bottom Avatars with Smooth Swipe Animation */}
          {(() => {
            const cardWidth = Math.min(145, Math.floor((width - 120 - (paths.length - 1) * 20) / paths.length));
            const gap = 20;
            const totalWidth = paths.length * cardWidth + (paths.length - 1) * gap;
            const startX = (width - totalWidth) / 2;

            // Helper to get rank of an item at a specific frame
            const getRankAt = (f: number, origIdx: number) => {
              const p = interpolate(f, [15, animDuration], [0, labelsCount - 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp'
              });
              const ci = Math.min(Math.floor(p), labelsCount - 1);
              const ni = Math.min(ci + 1, labelsCount - 1);
              const fc = p - ci;
              const vals = paths.map((itemPath, i) => {
                const v1 = itemPath.points[ci].val;
                const v2 = itemPath.points[ni].val;
                return { i, val: interpolate(fc, [0, 1], [v1, v2]) };
              });
              vals.sort((a, b) => b.val - a.val);
              return vals.findIndex(v => v.i === origIdx);
            };

            // Window-based smoothing for fluid horizontal swipe transition
            const SMOOTH_WINDOW = 14;

            return (
              <div style={{
                position: 'absolute',
                bottom: 140,
                width: '100%',
                height: 220,
                pointerEvents: 'none',
                zIndex: 5
              }}>
                {paths.map((pathData, origIdx) => {
                  const p1 = pathData.points[currI];
                  const p2 = pathData.points[nextI];
                  const curVal = interpolate(frac, [0, 1], [p1.val, p2.val]);

                  // Compute smoothed rank position over the trailing window
                  let sumRank = 0;
                  for (let w = 0; w < SMOOTH_WINDOW; w++) {
                    sumRank += getRankAt(frame - w, origIdx);
                  }
                  const smoothedRank = sumRank / SMOOTH_WINDOW;

                  // Target discrete rank for badge
                  const currentDiscreteRank = getRankAt(frame, origIdx) + 1;
                  const badge = getRankBadgeStyle(currentDiscreteRank);

                  // Calculate smooth horizontal slot X
                  const currentX = startX + smoothedRank * (cardWidth + gap);

                  // Slight vertical elevation when moving up in rank to avoid visual collision
                  const isTransitioning = Math.abs(smoothedRank - (currentDiscreteRank - 1)) > 0.05;
                  const yOffset = isTransitioning && (smoothedRank < (currentDiscreteRank - 1)) ? -8 : 0;

                  return (
                    <div 
                      key={pathData.item.label} 
                      style={{
                        position: 'absolute',
                        left: currentX,
                        top: yOffset,
                        width: cardWidth,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: 'clamp' }),
                        zIndex: isTransitioning ? 10 : (paths.length - currentDiscreteRank + 1),
                      }}
                    >
                      {/* Small Rank Badge (1st, 2nd, 3rd...) above picture */}
                      <div style={{
                        fontSize: 14,
                        fontWeight: 900,
                        color: badge.color,
                        backgroundColor: badge.bg,
                        border: badge.border,
                        borderRadius: 999,
                        padding: '2px 10px',
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        boxShadow: badge.glow,
                        lineHeight: 1.2
                      }}>
                        {badge.text}
                      </div>

                      {/* Avatar Circle */}
                      <div style={{
                        width: 86,
                        height: 86,
                        borderRadius: '50%',
                        border: `4px solid ${pathData.color}`,
                        overflow: 'hidden',
                        backgroundColor: '#1e293b',
                        boxShadow: currentDiscreteRank === 1 ? '0 0 16px rgba(250, 204, 21, 0.45)' : '0 4px 12px rgba(0,0,0,0.4)',
                        flexShrink: 0
                      }}>
                        {pathData.item.image_url ? (
                          <Img src={pathData.item.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : null}
                      </div>

                      {/* Label */}
                      <div style={{
                        fontSize: 21,
                        fontWeight: 700,
                        color: 'white',
                        textAlign: 'center',
                        lineHeight: 1.2,
                        maxWidth: cardWidth - 8,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textShadow: '0 2px 6px rgba(0,0,0,0.8)'
                      }}>
                        {pathData.item.label}
                      </div>

                      {/* Live Value */}
                      <div style={{
                        fontSize: 19,
                        fontWeight: 800,
                        color: pathData.color,
                        textAlign: 'center',
                        lineHeight: 1.2,
                        marginTop: 2,
                        textShadow: '0 2px 6px rgba(0,0,0,0.8)'
                      }}>
                        {formatNumberWithUnit(curVal, y_axis_label)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

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

          {data_json.end_title && data_json.end_title.trim() && (
            <div style={{
              marginTop: 25,
              fontSize: 40,
              fontWeight: 800,
              color: '#ffffff',
              backgroundColor: 'rgba(255,255,255,0.15)',
              padding: '12px 36px',
              borderRadius: 24,
              border: '2px solid rgba(255,255,255,0.3)',
              textAlign: 'center',
              textShadow: '0 4px 15px rgba(0,0,0,0.8)',
              maxWidth: '85%'
            }}>
              <TypewriterText text={data_json.end_title.trim()} delayFrames={10} />
            </div>
          )}
        </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};
