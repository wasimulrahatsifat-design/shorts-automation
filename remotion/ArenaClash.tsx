import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Img, Sequence, Audio, spring } from 'remotion';

interface Contestant {
  id: string;
  name: string;
  color: string;
  image_keyword?: string;
  image_url?: string;
  starting_health: number;
}

interface BattleEvent {
  frame: number;
  attacker: string;
  defender: string;
  damage: number;
  item_used: string;
}

interface ArenaClashData {
  topic: string;
  format: string;
  script: string;
  contestants: Contestant[];
  events: BattleEvent[];
  winner_id: string;
  tts_url?: string;
}

export const ArenaClash: React.FC<{ data_json: ArenaClashData, topic: string }> = ({ data_json, topic }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  const { contestants, events = [], winner_id } = data_json;

  const arenaRadius = 400;
  const arenaCenterX = width / 2;
  const arenaCenterY = height / 2 + 100;

  const battleDuration = durationInFrames - 90; // Reserve 3s for winner reveal

  // Calculate live health for each contestant
  const liveContestants = useMemo(() => {
    return contestants.map((c, i) => {
      let currentHealth = c.starting_health || 100;
      events.forEach(ev => {
        if (ev.defender === c.id && frame >= ev.frame) {
          currentHealth -= ev.damage;
        }
      });
      // Prevent negative health
      currentHealth = Math.max(0, currentHealth);

      // Simple circular movement around the arena for alive contestants
      const isDead = currentHealth <= 0;
      
      // Calculate a specific angle for this contestant
      const baseAngle = (i / contestants.length) * Math.PI * 2;
      
      // Add some movement based on the frame, unless dead
      const angle = isDead ? baseAngle : baseAngle + frame * 0.01 * (i % 2 === 0 ? 1 : -1);
      
      // Distance from center fluctuates slightly
      const dist = isDead ? arenaRadius - 50 : arenaRadius * 0.6 + Math.sin(frame * 0.05 + i) * 100;

      const x = arenaCenterX + Math.cos(angle) * dist;
      const y = arenaCenterY + Math.sin(angle) * dist;

      return {
        ...c,
        health: currentHealth,
        isDead,
        x,
        y
      };
    });
  }, [contestants, events, frame, arenaCenterX, arenaCenterY, arenaRadius]);

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleScale = spring({ frame, fps, config: { damping: 14 } });
  
  const winner = contestants.find(c => c.id === winner_id) || contestants[0];
  const winnerScale = spring({ frame: frame - battleDuration, fps, config: { damping: 12 } });
  const winnerOpacity = interpolate(frame, [battleDuration, battleDuration + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Get active events for this frame (display for 30 frames)
  const activeEvents = events.filter(ev => frame >= ev.frame && frame < ev.frame + 30);

  return (
    <AbsoluteFill style={{ 
      backgroundColor: '#111827', // Dark Gray BG
      color: 'white',
      fontFamily: '"Montserrat", sans-serif'
    }}>
      {/* Audio Track */}
      {data_json.tts_url && <Audio src={data_json.tts_url} volume={0.9} />}

      <Sequence durationInFrames={battleDuration}>
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
          textShadow: '4px 4px 15px rgba(0,0,0,0.8)',
          color: '#f8f9fa',
          zIndex: 50
        }}>
          {topic || "Arena Clash"}
        </div>

        {/* The Arena (Circular Ring) */}
        <div style={{
          position: 'absolute',
          left: arenaCenterX - arenaRadius,
          top: arenaCenterY - arenaRadius,
          width: arenaRadius * 2,
          height: arenaRadius * 2,
          borderRadius: '50%',
          border: '10px dashed #374151',
          backgroundColor: '#1f2937',
          zIndex: 0
        }} />

        {/* Contestants */}
        {liveContestants.map((c, idx) => (
          <div key={idx} style={{
            position: 'absolute',
            left: c.x - 50,
            top: c.y - 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: c.isDead ? 5 : 10,
            opacity: c.isDead ? 0.3 : 1,
            filter: c.isDead ? 'grayscale(100%)' : 'none',
            transition: 'all 0.5s ease-out' // Smooth position updates if lagging
          }}>
            <div style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              backgroundColor: '#333',
              border: `6px solid ${c.color}`,
              boxShadow: c.isDead ? 'none' : `0 8px 16px rgba(0,0,0,0.6), 0 0 20px ${c.color}66`,
              overflow: 'hidden'
            }}>
              {c.image_url && <Img src={c.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{
              marginTop: 10,
              fontSize: 20,
              fontWeight: 800,
              color: 'white',
              backgroundColor: 'rgba(0,0,0,0.7)',
              padding: '4px 12px',
              borderRadius: 12,
              border: `2px solid ${c.color}88`,
              whiteSpace: 'nowrap'
            }}>
              {c.name}
            </div>
            
            {/* Health Bar */}
            <div style={{
              width: 100,
              height: 12,
              backgroundColor: '#555',
              borderRadius: 6,
              marginTop: 8,
              overflow: 'hidden',
              border: '2px solid #222'
            }}>
              <div style={{
                width: `${Math.max(0, (c.health / (c.starting_health || 100)) * 100)}%`,
                height: '100%',
                backgroundColor: c.health > 40 ? '#2ecc71' : (c.health > 20 ? '#f1c40f' : '#e74c3c'),
                transition: 'width 0.3s ease-out'
              }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 4 }}>
              {c.health} / {c.starting_health || 100}
            </div>
          </div>
        ))}

        {/* Floating Events */}
        {activeEvents.map((ev, idx) => {
          const defender = liveContestants.find(c => c.id === ev.defender);
          const attacker = liveContestants.find(c => c.id === ev.attacker);
          if (!defender || !attacker) return null;

          const progress = (frame - ev.frame) / 30;
          const floatY = interpolate(progress, [0, 1], [defender.y - 120, defender.y - 200]);
          const eventOpacity = interpolate(progress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

          return (
            <div key={`${ev.frame}-${idx}`} style={{
              position: 'absolute',
              left: defender.x,
              top: floatY,
              transform: 'translateX(-50%)',
              opacity: eventOpacity,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 100
            }}>
              <div style={{
                fontSize: 48,
                fontWeight: 900,
                color: '#e74c3c',
                textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
              }}>
                -{ev.damage}
              </div>
              <div style={{
                fontSize: 24,
                fontWeight: 800,
                color: '#f1c40f',
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: '4px 12px',
                borderRadius: 12,
                marginTop: 4
              }}>
                {ev.item_used}
              </div>
            </div>
          );
        })}
      </Sequence>

      {/* Winner Reveal Sequence */}
      <Sequence from={battleDuration}>
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
