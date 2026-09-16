import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Img, Sequence, Audio, spring, Easing } from 'remotion';

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

  const battleDuration = durationInFrames - 90; // Reserve last 3s for winner

  // Fixed positions for exactly 4 contestants in a 1080x1920 layout
  const positions = [
    { x: 300, y: 600 },
    { x: 780, y: 600 },
    { x: 300, y: 1300 },
    { x: 780, y: 1300 }
  ];

  // Calculate live health and active event status for each contestant
  const liveContestants = useMemo(() => {
    return contestants.map((c, i) => {
      let currentHealth = c.starting_health || 100;
      let activeDefendEvent: BattleEvent | null = null;
      let activeAttackEvent: BattleEvent | null = null;

      events.forEach(ev => {
        if (frame >= ev.frame && frame < ev.frame + 30) {
          if (ev.defender === c.id) activeDefendEvent = ev;
          if (ev.attacker === c.id) activeAttackEvent = ev;
        }
        if (ev.defender === c.id && frame >= ev.frame) {
          currentHealth -= ev.damage;
        }
      });

      const isDead = currentHealth <= 0;
      currentHealth = Math.max(0, currentHealth);

      return {
        ...c,
        health: currentHealth,
        isDead,
        baseX: positions[i]?.x || 540,
        baseY: positions[i]?.y || 960,
        activeDefendEvent: activeDefendEvent as BattleEvent | null,
        activeAttackEvent: activeAttackEvent as BattleEvent | null
      };
    });
  }, [contestants, events, frame]);

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleScale = spring({ frame, fps, config: { damping: 12 } });
  
  const winner = contestants.find(c => c.id === winner_id) || contestants[0];
  const winnerScale = spring({ frame: frame - battleDuration, fps, config: { damping: 10 } });
  const winnerOpacity = interpolate(frame, [battleDuration, battleDuration + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Background Grid Animation
  const bgOffsetY = (frame * 2) % 100;

  return (
    <AbsoluteFill style={{ 
      backgroundColor: '#0f172a',
      color: 'white',
      fontFamily: '"Outfit", "Montserrat", sans-serif',
      overflow: 'hidden'
    }}>
      {/* Dynamic Grid Background */}
      <div style={{
        position: 'absolute',
        width: '200%',
        height: '200%',
        top: -height/2,
        left: -width/2,
        backgroundImage: 'linear-gradient(#334155 2px, transparent 2px), linear-gradient(90deg, #334155 2px, transparent 2px)',
        backgroundSize: '100px 100px',
        transform: `perspective(500px) rotateX(60deg) translateY(${bgOffsetY}px)`,
        opacity: 0.3,
        zIndex: 0
      }} />

      {data_json.tts_url && <Audio src={data_json.tts_url} volume={0.9} />}

      <Sequence durationInFrames={battleDuration}>
        {/* Title */}
        <div style={{ 
          position: 'absolute',
          top: 120,
          width: '100%',
          opacity: titleOpacity, 
          transform: `scale(${titleScale})`, 
          fontSize: 70, 
          fontWeight: 900, 
          textAlign: 'center',
          textShadow: '0 8px 25px rgba(0,0,0,0.9), 0 0 40px rgba(239,68,68,0.5)',
          color: '#f8fafc',
          zIndex: 50,
          textTransform: 'uppercase',
          letterSpacing: '2px'
        }}>
          {topic || "Arena Clash"}
        </div>

        {/* VS Circle in Middle */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 250,
          height: 250,
          borderRadius: '50%',
          backgroundColor: '#1e293b',
          border: '10px solid #cbd5e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 80,
          fontWeight: 900,
          color: '#cbd5e1',
          boxShadow: '0 0 50px rgba(0,0,0,0.8), inset 0 0 30px rgba(0,0,0,0.5)',
          zIndex: 10
        }}>
          VS
        </div>

        {/* Contestants */}
        {liveContestants.map((c, idx) => {
          // Attack animation: lunge forward towards center slightly
          let offsetX = 0;
          let offsetY = 0;
          if (c.activeAttackEvent) {
            const attackProgress = (frame - c.activeAttackEvent.frame) / 30;
            const lunge = interpolate(attackProgress, [0, 0.2, 0.5, 1], [0, 60, 60, 0], { easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
            // Direction towards center (540, 960)
            const dx = 540 - c.baseX;
            const dy = 960 - c.baseY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            offsetX = (dx / dist) * lunge;
            offsetY = (dy / dist) * lunge;
          }

          // Defend animation: shake
          if (c.activeDefendEvent) {
            const shake = Math.sin(frame * 2) * 15;
            offsetX += shake;
          }

          const currentX = c.baseX + offsetX;
          const currentY = c.baseY + offsetY;

          const healthPercent = Math.max(0, (c.health / (c.starting_health || 100)) * 100);
          const isLowHealth = healthPercent > 0 && healthPercent <= 25;

          return (
            <div key={idx} style={{
              position: 'absolute',
              left: currentX,
              top: currentY,
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: c.isDead ? 5 : 20,
              opacity: c.isDead ? 0.2 : 1,
              filter: c.isDead ? 'grayscale(100%)' : 'none',
              transition: 'opacity 0.5s ease-out'
            }}>
              
              {/* Avatar */}
              <div style={{
                width: 240,
                height: 240,
                borderRadius: 40,
                backgroundColor: '#1e293b',
                border: `10px solid ${c.color}`,
                boxShadow: c.isDead ? 'none' : `0 20px 40px rgba(0,0,0,0.8), 0 0 30px ${c.color}aa`,
                overflow: 'hidden',
                position: 'relative'
              }}>
                {c.image_url ? (
                  <Img src={c.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 24, textAlign: 'center', padding: 20 }}>
                    {c.image_keyword || "No Image"}
                  </div>
                )}
                
                {/* Red flash when hit */}
                {c.activeDefendEvent && (
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(239, 68, 68, 0.5)',
                    zIndex: 2
                  }} />
                )}
              </div>

              {/* Name Tag */}
              <div style={{
                marginTop: 20,
                fontSize: 34,
                fontWeight: 900,
                color: 'white',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                padding: '10px 24px',
                borderRadius: 20,
                border: `3px solid ${c.color}`,
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                textTransform: 'uppercase',
                maxWidth: 320,
                textAlign: 'center',
                lineHeight: 1.1
              }}>
                {c.name}
              </div>
              
              {/* Health Bar Wrapper */}
              <div style={{
                width: 260,
                height: 24,
                backgroundColor: '#334155',
                borderRadius: 12,
                marginTop: 16,
                overflow: 'hidden',
                border: '3px solid #0f172a',
                boxShadow: 'inset 0 4px 6px rgba(0,0,0,0.5)',
                position: 'relative'
              }}>
                <div style={{
                  width: `${healthPercent}%`,
                  height: '100%',
                  backgroundColor: healthPercent > 50 ? '#22c55e' : (healthPercent > 25 ? '#eab308' : '#ef4444'),
                  transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 0 10px rgba(255,255,255,0.3) inset'
                }} />
                
                {/* Low Health Pulsing overlay */}
                {isLowHealth && (
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(255,0,0,0.4)',
                    opacity: Math.sin(frame / 3) * 0.5 + 0.5
                  }} />
                )}
              </div>
              
              {/* HP Text */}
              <div style={{ 
                fontSize: 24, 
                fontWeight: 900, 
                marginTop: 8,
                color: isLowHealth ? '#ef4444' : '#94a3b8',
                textShadow: '0 2px 4px rgba(0,0,0,0.8)'
              }}>
                {Math.ceil(c.health)} HP
              </div>

              {/* Damage Popups */}
              {c.activeDefendEvent && (
                <div style={{
                  position: 'absolute',
                  top: -60,
                  transform: `translateY(${interpolate((frame - c.activeDefendEvent.frame)/30, [0, 1], [0, -100])}px) scale(${interpolate((frame - c.activeDefendEvent.frame)/30, [0, 0.2, 1], [0.5, 1.2, 1])})`,
                  opacity: interpolate((frame - c.activeDefendEvent.frame)/30, [0, 0.8, 1], [1, 1, 0]),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  zIndex: 100
                }}>
                  <div style={{
                    fontSize: 70,
                    fontWeight: 900,
                    color: '#ef4444',
                    textShadow: '3px 3px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 4px 8px 15px rgba(0,0,0,0.6)',
                  }}>
                    -{c.activeDefendEvent.damage}
                  </div>
                  <div style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: '#fcd34d',
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    padding: '8px 20px',
                    borderRadius: 16,
                    marginTop: 8,
                    border: '2px solid #b45309'
                  }}>
                    {c.activeDefendEvent.item_used}
                  </div>
                </div>
              )}
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
          backgroundColor: 'rgba(15, 23, 42, 0.95)', // Deep dark overlay
          zIndex: 100
        }}>
          <h2 style={{
            fontSize: 50,
            fontWeight: 800,
            color: '#cbd5e1',
            marginBottom: 20,
            textTransform: 'uppercase',
            letterSpacing: '10px'
          }}>
            Winner
          </h2>

          <div style={{
            width: 450,
            height: 450,
            borderRadius: 60,
            backgroundColor: '#1e293b',
            border: `15px solid ${winner.color}`,
            boxShadow: `0 30px 60px rgba(0,0,0,0.9), 0 0 80px ${winner.color}88`,
            overflow: 'hidden',
            marginBottom: 50,
            position: 'relative'
          }}>
            {winner.image_url && <Img src={winner.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            
            {/* Shimmer effect */}
            <div style={{
              position: 'absolute',
              top: 0, left: -200, bottom: 0, width: 100,
              background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent)',
              transform: 'skewX(-20deg)',
              animation: 'shimmer 2s infinite'
            }} />
          </div>

          <div style={{
            fontSize: 90,
            fontWeight: 900,
            color: '#ffffff',
            textShadow: `0 10px 20px rgba(0,0,0,0.8), 0 0 40px ${winner.color}aa`,
            textAlign: 'center',
            textTransform: 'uppercase',
            padding: '0 40px'
          }}>
            {winner.name}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Global CSS for shimmer */}
      <style>
        {`
          @keyframes shimmer {
            0% { left: -200px; }
            100% { left: 1000px; }
          }
        `}
      </style>
    </AbsoluteFill>
  );
};
