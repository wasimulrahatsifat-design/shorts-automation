import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Img, Audio, Sequence, staticFile } from 'remotion';
import {
  generateArenaSimulation,
  ARENA_CENTER,
  ARENA_RADIUS,
  BOX_SIZE,
} from '../lib/arena-physics';

export interface ArenaClashData {
  topic: string;
  format: string;
  script?: string;
  events?: any[];
  winner_id?: string;
  duration_seconds?: number;
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
  const { durationInFrames, width } = useVideoConfig();

  const contestants = data_json.contestants || [];
  const headline = topic || data_json.topic || 'ARENA CLASH';

  // Run 100% deterministic simulation and sound event generation
  const simResult = useMemo(() => {
    return generateArenaSimulation(contestants, durationInFrames, 42);
  }, [contestants, durationInFrames]);

  const { frames, soundEvents, winner } = simResult;
  const current = frames[frame] || frames[frames.length - 1] || {
    fighters: [],
    items: [],
    bullets: [],
    floatingTexts: [],
    particles: [],
    winner: null,
    aliveCount: contestants.length,
  };

  const { fighters, items, bullets, floatingTexts, particles } = current;

  // Render Dual-Sided Healthbars below the larger Arena (y = 1220 to 1880)
  const renderHealthBars = () => {
    const startY = 1220;
    const count = fighters.length;
    const colWidth = 460;
    const leftX = 50;
    const rightX = width - colWidth - 50;
    const rows = Math.ceil(count / 2);
    const rowHeight = Math.min(125, 580 / Math.max(rows, 2));

    return fighters.map((f, idx) => {
      let x = leftX;
      let y = startY;

      if (count === 2) {
        x = idx === 0 ? leftX : rightX;
        y = startY + 60;
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
            borderRadius: 20,
            backgroundColor: f.isDead ? 'rgba(15, 23, 42, 0.45)' : 'rgba(15, 23, 42, 0.9)',
            border: `3px solid ${f.isDead ? '#334155' : f.color}`,
            display: 'flex',
            alignItems: 'center',
            padding: '10px 14px',
            boxSizing: 'border-box',
            gap: 14,
            overflow: 'hidden',
          }}
        >
          {/* Avatar Square Thumbnail */}
          <div
            style={{
              width: rowHeight - 36,
              height: rowHeight - 36,
              borderRadius: 14,
              backgroundColor: f.color,
              overflow: 'hidden',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 12px ${f.color}66`,
            }}
          >
            {f.image_url ? (
              <Img src={f.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span
                style={{
                  color: f.color === '#ffffff' ? '#000' : '#fff',
                  fontWeight: 900,
                  fontSize: 26,
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
                  fontSize: 22,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 230,
                }}
              >
                {f.name} {itemTag}
              </span>
              <span
                style={{
                  color: f.isDead ? '#ef4444' : '#38bdf8',
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                {f.isDead ? 'ELIMINATED' : `${Math.round(f.health)} HP`}
              </span>
            </div>

            {/* Health Bar Track */}
            <div
              style={{
                width: '100%',
                height: 16,
                borderRadius: 8,
                backgroundColor: 'rgba(30, 41, 59, 0.85)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${hpPct * 100}%`,
                  height: '100%',
                  backgroundColor: hpColor,
                  borderRadius: 8,
                  boxShadow: `0 0 12px ${hpColor}`,
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
      {/* 1. Background Battle Music (Energetic Arcade BGM) */}
      <Audio src={staticFile('audio/battle_bgm.wav')} volume={0.32} loop />

      {/* 2. Sequenced Sound Effects (Bounce, Hit, Gun, Item, Explosion, Winner) */}
      {soundEvents.map((ev, idx) => {
        const audioPath = ev.sound === 'winner' ? 'winner.mp3' : `audio/${ev.sound}.wav`;
        return (
          <Sequence key={`sfx_${idx}`} from={ev.frame} durationInFrames={ev.sound === 'winner' ? 120 : 25}>
            <Audio src={staticFile(audioPath)} volume={ev.volume || 0.8} />
          </Sequence>
        );
      })}

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

      {/* Top Headline Only (circular arena battle text removed as requested) */}
      <div
        style={{
          position: 'absolute',
          top: 90,
          width: '100%',
          textAlign: 'center',
          zIndex: 30,
        }}
      >
        <div
          style={{
            fontSize: 66,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            textShadow: '0 4px 25px rgba(0,0,0,0.9), 0 0 35px rgba(56, 189, 248, 0.35)',
          }}
        >
          {headline}
        </div>
      </div>

      {/* Circular Arena Floor (Enlarged Radius: 430px, Diameter: 860px) */}
      <div
        style={{
          position: 'absolute',
          left: ARENA_CENTER.x - ARENA_RADIUS,
          top: ARENA_CENTER.y - ARENA_RADIUS,
          width: ARENA_RADIUS * 2,
          height: ARENA_RADIUS * 2,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.9) 75%, rgba(2, 6, 23, 0.98) 100%)',
          border: '12px solid #38bdf8',
          boxShadow: '0 0 45px #0284c7, inset 0 0 50px rgba(0,0,0,0.85)',
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
            width: ARENA_RADIUS * 0.92,
            height: ARENA_RADIUS * 0.92,
            borderRadius: '50%',
            border: '4px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: 90,
              fontWeight: 900,
              color: 'rgba(255, 255, 255, 0.04)',
            }}
          >
            VS
          </span>
        </div>
      </div>

      {/* Arena Random Items (Pops up 8s after collected) */}
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
              width: 58,
              height: 58,
              borderRadius: '50%',
              backgroundColor: '#0f172a',
              border: `3px solid ${item.color}`,
              boxShadow: `0 0 25px ${item.color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
            }}
          >
            {item.icon}
          </div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: item.color,
              marginTop: 5,
              textShadow: '0 2px 8px black',
              backgroundColor: 'rgba(0,0,0,0.7)',
              padding: '2px 8px',
              borderRadius: 8,
            }}
          >
            {item.name}
          </span>
        </div>
      ))}

      {/* Arena Bullets (Gun shoots 5 bullets) */}
      {bullets.map((b, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            left: b.x,
            top: b.y,
            width: 14,
            height: 14,
            borderRadius: '50%',
            backgroundColor: b.color,
            boxShadow: `0 0 18px ${b.color}`,
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

      {/* Square Contestants (Enlarged Box Size: 120px) with clearly visible names */}
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
              width: BOX_SIZE,
              height: BOX_SIZE,
              transform: 'translate(-50%, -50%)',
              zIndex: 20,
              borderRadius: 22,
              backgroundColor: '#0f172a',
              border: `7px solid ${f.hitFlash > 0 ? '#ffffff' : f.color}`,
              boxShadow: `0 0 25px ${f.color}aa`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Box Interior / Image */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 15,
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
                    fontSize: 54,
                    fontWeight: 900,
                    color: f.color === '#ffffff' ? '#000' : '#fff',
                  }}
                >
                  {f.name.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Red Hit Flash */}
              {f.hitFlash > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(239, 68, 68, 0.65)',
                    zIndex: 2,
                  }}
                />
              )}
            </div>

            {/* Clearly Visible Name Badge directly below the box */}
            <div
              style={{
                position: 'absolute',
                bottom: -28,
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: `2px solid ${f.color}`,
                padding: '3px 12px',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 900,
                color: '#ffffff',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 10px rgba(0,0,0,0.8)',
                zIndex: 4,
              }}
            >
              {f.name}
            </div>

            {/* Active Item Badge Floating Above */}
            {itemBadge && (
              <div
                style={{
                  position: 'absolute',
                  top: -28,
                  fontSize: 18,
                  zIndex: 4,
                }}
              >
                {itemBadge}
              </div>
            )}
          </div>
        );
      })}

      {/* Floating Damage Numbers (Larger 38px font) */}
      {floatingTexts.map((ft) => (
        <div
          key={ft.id}
          style={{
            position: 'absolute',
            left: ft.x,
            top: ft.y,
            transform: `translate(-50%, -50%) scale(${ft.scale})`,
            color: ft.color,
            fontSize: 38,
            fontWeight: 900,
            textShadow: '0 3px 12px black, 0 0 10px black',
            opacity: ft.alpha,
            zIndex: 25,
          }}
        >
          {ft.text}
        </div>
      ))}

      {/* Dual-Sided Live Healthbars below the Arena */}
      {renderHealthBars()}

      {/* Full Victory Celebration Screen Overlay */}
      {winner && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div style={{ fontSize: 100, marginBottom: -10 }}>👑</div>

          {/* Winner Box */}
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 28,
              backgroundColor: winner.color,
              border: '8px solid #facc15',
              boxShadow: '0 0 50px #eab308',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            {winner.image_url ? (
              <Img src={winner.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span
                style={{
                  fontSize: 74,
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
              fontSize: 76,
              fontWeight: 900,
              color: '#facc15',
              textShadow: '0 0 30px #ca8a04',
              marginBottom: 10,
            }}
          >
            VICTORY!
          </div>

          <div
            style={{
              fontSize: 50,
              fontWeight: 800,
              color: '#ffffff',
              textTransform: 'uppercase',
            }}
          >
            {winner.name} WINS!
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
