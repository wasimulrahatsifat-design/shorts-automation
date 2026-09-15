import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Img, Sequence, Audio, spring } from 'remotion';

interface Racer {
  id: string;
  name: string;
  color: string;
  speed_profile: number[];
  image_keyword?: string;
  image_url?: string;
}

interface MazeRaceData {
  topic: string;
  format: string;
  script: string;
  track_length: number;
  racers: Racer[];
  winner_id: string;
  tts_url?: string;
}

const waypoints = [
  { x: 540, y: 1750 },
  { x: 850, y: 1600 },
  { x: 850, y: 1400 },
  { x: 230, y: 1250 },
  { x: 230, y: 950 },
  { x: 850, y: 800 },
  { x: 850, y: 500 },
  { x: 230, y: 350 },
  { x: 540, y: 150 },
];

export const MazeRace: React.FC<{ data_json: MazeRaceData, topic: string }> = ({ data_json, topic }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  const { racers, winner_id } = data_json;

  // Calculate Track Geometry
  const trackGeometry = useMemo(() => {
    const distances = [];
    let totalDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const dx = waypoints[i+1].x - waypoints[i].x;
      const dy = waypoints[i+1].y - waypoints[i].y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      distances.push(dist);
      totalDistance += dist;
    }
    return { distances, totalDistance };
  }, []);

  const getCoordinate = (progress: number) => {
    const targetDist = progress * trackGeometry.totalDistance;
    let currentDist = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const segmentDist = trackGeometry.distances[i];
      if (currentDist + segmentDist >= targetDist || i === waypoints.length - 2) {
        const segmentProgress = Math.max(0, Math.min(1, (targetDist - currentDist) / segmentDist));
        const x = waypoints[i].x + (waypoints[i+1].x - waypoints[i].x) * segmentProgress;
        const y = waypoints[i].y + (waypoints[i+1].y - waypoints[i].y) * segmentProgress;
        return { x, y };
      }
      currentDist += segmentDist;
    }
    return waypoints[waypoints.length - 1]; // Fallback
  };

  const raceDuration = durationInFrames - 90; // Reserve last 3 secs for winner reveal

  const racerPositions = useMemo(() => {
    return racers.map((racer, index) => {
      const profile = racer.speed_profile || [1, 1, 1, 1, 1]; 
      const numSegments = profile.length;
      
      const inputRange = [];
      for (let i = 0; i <= numSegments; i++) {
        inputRange.push((i / numSegments) * raceDuration);
      }
      
      const outputRange = [0];
      const totalSpeed = profile.reduce((a, b) => a + b, 0);
      let cumulative = 0;
      for (let i = 0; i < numSegments; i++) {
        cumulative += profile[i];
        outputRange.push(cumulative / totalSpeed);
      }
      
      let progress = interpolate(frame, inputRange, outputRange, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      
      // If they are the winner, ensure they definitively reach exactly 1.0 (finish line)
      if (racer.id === winner_id && frame >= raceDuration) {
        progress = 1.0;
      } else if (racer.id !== winner_id && progress > 0.95) {
         // Keep losers slightly behind the finish line if they happened to calculate too high
        progress = Math.min(progress, 0.95);
      }

      const coord = getCoordinate(progress);
      
      // Offset so they don't overlap completely
      const offsetX = (index - racers.length / 2) * 20;
      const offsetY = (index - racers.length / 2) * 20;

      return {
        ...racer,
        x: coord.x + offsetX,
        y: coord.y + offsetY,
        progress
      };
    });
  }, [racers, frame, raceDuration, winner_id, trackGeometry]);

  const trackPath = `M ${waypoints.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const finishLine = waypoints[waypoints.length - 1];

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleScale = spring({ frame, fps, config: { damping: 14 } });
  
  const winner = racers.find(r => r.id === winner_id) || racers[0];
  const winnerScale = spring({ frame: frame - raceDuration, fps, config: { damping: 12 } });
  const winnerOpacity = interpolate(frame, [raceDuration, raceDuration + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ 
      backgroundColor: '#111827', // Dark Gray BG
      color: 'white',
      fontFamily: '"Montserrat", sans-serif'
    }}>
      {/* Audio Track */}
      {data_json.tts_url && <Audio src={data_json.tts_url} volume={0.9} />}

      <Sequence durationInFrames={raceDuration}>
        {/* Header Topic */}
        <div style={{ 
          position: 'absolute',
          top: 50,
          width: '100%',
          opacity: titleOpacity, 
          transform: `scale(${titleScale})`, 
          fontSize: 60, 
          fontWeight: 900, 
          textAlign: 'center',
          textShadow: '4px 4px 15px rgba(0,0,0,0.8)',
          color: '#f8f9fa',
          zIndex: 50
        }}>
          {topic || "Maze Race"}
        </div>

        {/* The Track (SVG Polyline) */}
        <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
          {/* Track Base */}
          <path
            d={trackPath}
            fill="none"
            stroke="#1f2937" // Lighter dark gray
            strokeWidth={140}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Track Centerline (Dashed) */}
          <path
            d={trackPath}
            fill="none"
            stroke="#4b5563"
            strokeWidth={8}
            strokeDasharray="20, 20"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Finish Line Checkers */}
          <rect x={finishLine.x - 70} y={finishLine.y - 70} width={140} height={40} fill="#f1c40f" />
          <text x={finishLine.x} y={finishLine.y - 45} textAnchor="middle" fill="#000" fontSize="24" fontWeight="bold">FINISH</text>
        </svg>

        {/* Racers */}
        {racerPositions.map((racer, idx) => (
          <div key={idx} style={{
            position: 'absolute',
            left: racer.x - 40,
            top: racer.y - 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10 + Math.floor(racer.progress * 100) // Ensure racers further ahead render on top
          }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: '#333',
              border: `6px solid ${racer.color}`,
              boxShadow: `0 8px 16px rgba(0,0,0,0.6), 0 0 20px ${racer.color}66`,
              overflow: 'hidden'
            }}>
              {racer.image_url && <Img src={racer.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{
              marginTop: 5,
              fontSize: 18,
              fontWeight: 800,
              color: 'white',
              backgroundColor: 'rgba(0,0,0,0.7)',
              padding: '4px 10px',
              borderRadius: 10,
              border: `2px solid ${racer.color}88`,
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
              whiteSpace: 'nowrap'
            }}>
              {racer.name}
            </div>
          </div>
        ))}
      </Sequence>

      {/* Winner Reveal Sequence */}
      <Sequence from={raceDuration}>
        <AbsoluteFill style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          opacity: winnerOpacity,
          transform: `scale(${winnerScale})`,
          backgroundColor: 'rgba(17, 24, 39, 0.9)' // Dark overlay
        }}>
          <h1 style={{
            fontSize: 80,
            fontWeight: 900,
            color: '#f1c40f',
            textShadow: '0 10px 20px rgba(0,0,0,0.8)',
            marginBottom: 40,
            textTransform: 'uppercase',
            letterSpacing: '5px'
          }}>
            Winner!
          </h1>

          <div style={{
            width: 350,
            height: 350,
            borderRadius: '50%',
            backgroundColor: '#333',
            border: `15px solid ${winner.color}`,
            boxShadow: `0 15px 40px ${winner.color}88`,
            overflow: 'hidden',
            marginBottom: 50
          }}>
            {winner.image_url && <Img src={winner.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>

          <div style={{
            fontSize: 70,
            fontWeight: 900,
            color: '#ffffff',
            textShadow: '0 8px 15px rgba(0,0,0,0.6)',
            textAlign: 'center',
            marginBottom: 20
          }}>
            {winner.name}
          </div>
        </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};
