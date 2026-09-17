import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Img, Audio } from 'remotion';
import {
  generateArenaSimulation,
  ARENA_CENTER,
  ARENA_RADIUS,
  SimFighter,
} from '../lib/arena-physics';

export interface ArenaClashData {
  topic: string;
  format: string;
  script?: string;
  events?: any[];
  winner_id?: string;
  contestants: {
    id: string;
    name: string;
    color: string;
    image_url?: string | null;
    starting_health?: number;
    damage?: number;
    speed?: number;
    special_power?: string;
  }[];
  tts_url?: string;
}

export const ArenaClash: React.FC<{ data_json: ArenaClashData; topic: string }> = ({
  data_json,
  topic,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  const contestants = data_json.contestants || [];
  const headline = topic || data_json.topic || 'ARENA CLASH';

  // Generate 100% deterministic simulation for the entire video duration
  const simulation = useMemo(() => {
    return generateArenaSimulation(contestants, durationInFrames, 42);
  }, [contestants, durationInFrames]);

  const current = simulation[frame] || simulation[simulation.length - 1] || {
    fighters: [],
    items: [],
    bullets: [],
    floatingTexts: [],
    particles: [],
    winner: null,
    aliveCount: contestants.length,
  };

  const { fighters, items, bullets, floatingTexts, particles, winner } = current;

  // Render Dual-Sided Healthbars below the Arena (y = 1240 to 1840)
  const renderHealthBars = () => {
    const startY = 1250;
    const count = fighters.length;
    const colWidth = 450;
    const leftX = 60;
    const rightX = width - colWidth - 60; // 570
    const rows = Math.ceil(count / 2);
    const rowHeight = Math.min(115, 520 / Math.max(rows, 2));

    return fighters.map((f, idx) => {
      let x = leftX;
      let y = startY;

      if (count === 2) {
        x = idx === 0 ? leftX : rightX;
        y = startY + 50;
      } else if (count === 3) {
        if (idx === 0) {
          x = leftX;
          y = startY;
        } else if (idx === 1) {
          x = rightX;
          y = startY;
        } else {
          x = (width - colWidth) / 2;
          y = startY + rowHeight + 20;
        }
      } else {
        const isRight = idx % 2 === 1;
        const row = Math.floor(idx / 2);
        x = isRight ? rightX : leftX;
        y = startY + row * rowHeight;
      }

      const hpPct = Math.max(0, f.health / f.maxHealth);
      let hpColor = '#10b981';
      if (hpPct < 0.25) hpColor = '#ef4444';
      else if (hpPct < 0.5) hpColor = '#f59e0b';

      let itemTag = '';
      if (f.hasShield) itemTag += ' 🛡️';
      if (f.hasDagger) itemTag += ' 🗡️';
      if (f.gunBullets > 0) itemTag += ` 🔫x${f.gunBullets}`;
      if (f.speedBoostTimer > 0) itemTag += ' ⚡';

      return (
        <div
          key={f.id}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: colWidth,
            height: rowHeight - 16,
            borderRadius: 18,
            backgroundColor: f.isDead ? 'rgba(15, 23, 42, 0.4)' : 'rgba(15, 23, 42, 0.85)',
            border: `2px solid ${f.isDead ? '#334155' : f.color}`,
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            boxSizing: 'border-box',
            gap: 12,
            overflow: 'hidden',
          }}
        >
          {/* Avatar Square Thumbnail */}
          <div
            style={{
              width: rowHeight - 36,
              height: rowHeight - 36,
              borderRadius: 12,
              backgroundColor: f.color,
              overflow: 'hidden',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {f.image_url ? (
              <Img src={f.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span
                style={{
                  color: f.color === '#ffffff' ? '#000' : '#fff',
                  fontWeight: 900,
                  fontSize: 22,
                }}
              >
                {f.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Info & Bar */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Top Row: Name and HP */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  color: f.isDead ? '#64748b' : '#ffffff',
                  fontWeight: 900,
                  fontSize: 19,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 220,
                }}
              >
                {f.name} {itemTag}
              </span>
              <span
                style={{
                  color: f.isDead ? '#ef4444' : '#38bdf8',
                  fontWeight: 800,
                  fontSize: 16,
                }}
              >
                {f.isDead ? 'ELIMINATED' : `${Math.round(f.health)} HP`}
              </span>
            </div>

            {/* Health Bar Track */}
            <div
              style={{
                width: '100%',
                height: 14,
                borderRadius: 7,
                backgroundColor: 'rgba(30, 41, 59, 0.8)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${hpPct * 100}%`,
                  height: '100%',
                  backgroundColor: hpColor,
                  borderRadius: 7,
                  boxShadow: `0 0 10px ${hpColor}`,
                  transition: 'width 0.1s linear',
                }}
              />
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#05070c',
        color: 'white',
        fontFamily: '"Montserrat", sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Audio if available */}
      {data_json.tts_url && <Audio src={data_json.tts_url} volume={0.9} />}

      {/* Subtle Background Lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
          backgroundSize: '120px 120px',
        }}
      />

      {/* Top Headline */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          width: '100%',
          textAlign: 'center',
          zIndex: 30,
        }}
      >
        <div
          style={{
            fontSize: 54,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            textShadow: '0 4px 20px rgba(0,0,0,0.9), 0 0 30px rgba(56, 189, 248, 0.3)',
          }}
        >
          {headline}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#38bdf8',
            letterSpacing: '2px',
            marginTop: 8,
          }}
        >
          ⚡ CIRCULAR ARENA BATTLE ⚡
        </div>
      </div>

      {/* Circular Arena Floor */}
      <div
        style={{
          position: 'absolute',
          left: ARENA_CENTER.x - ARENA_RADIUS,
          top: ARENA_CENTER.y - ARENA_RADIUS,
          width: ARENA_RADIUS * 2,
          height: ARENA_RADIUS * 2,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.9) 75%, rgba(2, 6, 23, 0.95) 100%)',
          border: '10px solid #38bdf8',
          boxShadow: '0 0 35px #0284c7, inset 0 0 40px rgba(0,0,0,0.8)',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5,
        }}
      >
        {/* Inner subtle circle */}
        <div
          style={{
            width: ARENA_RADIUS * 0.9,
            height: ARENA_RADIUS * 0.9,
            borderRadius: '50%',
            border: '4px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: 80,
              fontWeight: 900,
              color: 'rgba(255, 255, 255, 0.04)',
            }}
          >
            VS
          </span>
        </div>
      </div>

      {/* Arena Random Items */}
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            position: 'absolute',
            left: item.x,
            top: item.y,
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              backgroundColor: '#0f172a',
              border: `3px solid ${item.color}`,
              boxShadow: `0 0 20px ${item.color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
            }}
          >
            {item.icon}
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: item.color,
              marginTop: 4,
              textShadow: '0 2px 6px black',
            }}
          >
            {item.name}
          </span>
        </div>
      ))}

      {/* Arena Bullets */}
      {bullets.map((b, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            left: b.x,
            top: b.y,
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: b.color,
            boxShadow: `0 0 15px ${b.color}`,
            transform: 'translate(-50%, -50%)',
            zIndex: 15,
          }}
        />
      ))}

      {/* Spark Particles */}
      {particles.map((p, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.radius * 2,
            height: p.radius * 2,
            borderRadius: '50%',
            backgroundColor: p.color,
            boxShadow: `0 0 8px ${p.color}`,
            opacity: p.alpha,
            transform: 'translate(-50%, -50%)',
            zIndex: 18,
          }}
        />
      ))}

      {/* Square Contestants */}
      {fighters.map((f) => {
        if (f.isDead) return null;

        let itemBadge = '';
        if (f.hasShield) itemBadge += '🛡️';
        if (f.hasDagger) itemBadge += '🗡️';
        if (f.gunBullets > 0) itemBadge += `🔫x${f.gunBullets}`;
        if (f.speedBoostTimer > 0) itemBadge += '⚡';

        return (
          <div
            key={f.id}
            style={{
              position: 'absolute',
              left: f.x,
              top: f.y,
              width: f.size,
              height: f.size,
              transform: 'translate(-50%, -50%)',
              zIndex: 20,
              borderRadius: 18,
              backgroundColor: '#0f172a',
              border: `6px solid ${f.hitFlash > 0 ? '#ffffff' : f.color}`,
              boxShadow: `0 0 20px ${f.color}`,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {f.image_url ? (
              <Img src={f.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: `linear-gradient(135deg, ${f.color}, #020617)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 42,
                  fontWeight: 900,
                  color: f.color === '#ffffff' ? '#000' : '#fff',
                }}
              >
                {f.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Red hit flash */}
            {f.hitFlash > 0 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(239, 68, 68, 0.6)',
                  zIndex: 2,
                }}
              />
            )}

            {/* Item badge floating above */}
            {itemBadge && (
              <div
                style={{
                  position: 'absolute',
                  top: -24,
                  fontSize: 16,
                  zIndex: 3,
                }}
              >
                {itemBadge}
              </div>
            )}
          </div>
        );
      })}

      {/* Floating Damage Numbers */}
      {floatingTexts.map((ft) => (
        <div
          key={ft.id}
          style={{
            position: 'absolute',
            left: ft.x,
            top: ft.y,
            transform: `translate(-50%, -50%) scale(${ft.scale})`,
            color: ft.color,
            fontSize: 28,
            fontWeight: 900,
            textShadow: '0 2px 8px black',
            opacity: ft.alpha,
            zIndex: 25,
          }}
        >
          {ft.text}
        </div>
      ))}

      {/* Dual-Sided Live Healthbars below the Arena */}
      {renderHealthBars()}

      {/* Victory Screen Overlay */}
      {winner && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div style={{ fontSize: 90, marginBottom: -10 }}>👑</div>

          {/* Winner Box */}
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 24,
              backgroundColor: winner.color,
              border: '6px solid #facc15',
              boxShadow: '0 0 40px #eab308',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            {winner.image_url ? (
              <Img src={winner.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 900,
                  color: winner.color === '#ffffff' ? '#000' : '#fff',
                }}
              >
                {winner.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: 68,
              fontWeight: 900,
              color: '#facc15',
              textShadow: '0 0 25px #ca8a04',
              marginBottom: 8,
            }}
          >
            VICTORY!
          </div>

          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: '#ffffff',
            }}
          >
            {winner.name} WINS!
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
