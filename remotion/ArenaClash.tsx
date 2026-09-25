import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Img, Audio, Sequence, staticFile } from 'remotion';
import { TypewriterText } from './TypewriterText';
import {
  generateArenaSimulation,
  ARENA_BOX,
  ARENA_CENTER,
  SpecialAbility,
  AlienType,
  getAlienType,
} from '../lib/arena-physics';

export interface ArenaClashData {
  topic: string;
  format: string;
  script?: string;
  events?: any[];
  winner_id?: string;
  duration_seconds?: number;
  seed?: number;
  contestants: {
    id: string;
    name: string;
    color: string;
    image_url?: string | null;
    starting_health?: number;
    damage?: number;
    speed?: number;
    special_power?: string;
    special_ability?: SpecialAbility;
  }[];
  tts_url?: string;
  end_title?: string;
  bg_music_url?: string;
  bg_music_volume?: number;
  bg_music_enabled?: boolean;
}

const resolveAudioUrl = (url?: string) => {
  if (!url) return '';
  if (url.includes('krtdupjglmlhumcbsxke.supabase.co')) {
    return staticFile('audio/battle_bgm.mp3');
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const clean = url.startsWith('/') ? url.slice(1) : url;
  return staticFile(clean);
};

const resolveSoundUrl = (sound: string, abilityType?: string) => {
  switch (sound) {
    case 'hit':
      return staticFile('audio/hit.wav');
    case 'bounce':
      return staticFile('audio/bounce.wav');
    case 'item':
      return staticFile('audio/item.wav');
    case 'gun':
      return staticFile('audio/gun.wav');
    case 'explosion':
      return staticFile('audio/explosion.wav');
    case 'winner':
      return staticFile('audio/item.wav');
    case 'omnitrix_open':
      return staticFile('audio/omnitrix_open.wav');
    case 'omnitrix_turn':
      return staticFile('audio/omnitrix_turn.wav');
    case 'omnitrix_slam':
      return staticFile('audio/omnitrix_slam.wav');
    case 'ability':
      if (abilityType === 'damage') return staticFile('audio/explosion.wav');
      if (abilityType === 'freeze') return staticFile('audio/bounce.wav');
      if (abilityType === 'shield' || abilityType === 'heal') return staticFile('audio/item.wav');
      return staticFile('audio/gun.wav');
    default:
      return staticFile('audio/hit.wav');
  }
};

export const OmnitrixDial: React.FC<{ size?: number; opacity?: number }> = ({ size = 280, opacity = 1 }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        pointerEvents: 'none',
      }}
    >
      {/* Outer Intense Green Aura Glow like the user's reference photo */}
      <div
        style={{
          position: 'absolute',
          inset: -24,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(0, 255, 102, 0.6) 20%, rgba(0, 255, 102, 0.25) 55%, transparent 75%)',
          filter: 'blur(20px)',
        }}
      />

      <svg
        viewBox="0 0 300 300"
        width={size}
        height={size}
        style={{
          filter: 'drop-shadow(0 0 35px rgba(0, 255, 102, 0.95))',
          overflow: 'visible',
        }}
      >
        <defs>
          {/* Ben 10 Alien Green 3D Radial Glow Gradient */}
          <radialGradient id="omniGreenGrad" cx="50%" cy="50%" r="50%" fx="50%" fy="32%">
            <stop offset="0%" stopColor="#8aff7b" />
            <stop offset="30%" stopColor="#39ff14" />
            <stop offset="70%" stopColor="#00cc44" />
            <stop offset="100%" stopColor="#006622" />
          </radialGradient>

          {/* Outer Bezel Dark Metallic Gradient */}
          <radialGradient id="omniBezelGrad" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#1a3b22" />
            <stop offset="60%" stopColor="#07170a" />
            <stop offset="100%" stopColor="#020803" />
          </radialGradient>
        </defs>

        {/* Outer Glowing Edge Ring */}
        <circle cx="150" cy="150" r="145" fill="none" stroke="#00ff66" strokeWidth="5" opacity="0.95" />

        {/* Outer Metallic Bezel */}
        <circle cx="150" cy="150" r="141" fill="url(#omniBezelGrad)" stroke="#021c08" strokeWidth="6" />

        {/* Inner Black Base Disc */}
        <circle cx="150" cy="150" r="132" fill="#000000" stroke="#00ff66" strokeWidth="2" opacity="0.9" />

        {/* Top Green Hourglass Sector */}
        <path
          d="M 146 147 L 72 43 A 132 132 0 0 1 228 43 L 154 147 Z"
          fill="url(#omniGreenGrad)"
          stroke="#003810"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Bottom Green Hourglass Sector */}
        <path
          d="M 146 153 L 72 257 A 132 132 0 0 0 228 257 L 154 153 Z"
          fill="url(#omniGreenGrad)"
          stroke="#003810"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Center Waist Bridge */}
        <rect x="145" y="146" width="10" height="8" rx="2" fill="#39ff14" />

        {/* Subtle Glass Sheen / Highlight Rim */}
        <circle cx="150" cy="150" r="132" fill="none" stroke="rgba(255, 255, 255, 0.22)" strokeWidth="1.5" />
      </svg>
    </div>
  );
};

export const ArenaClash: React.FC<{ data_json: ArenaClashData; topic: string }> = ({
  data_json,
  topic,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();

  const contestants = data_json.contestants || [];
  const headline = topic || data_json.topic || 'OMNITRIX ALIEN BATTLE';
  const seed = data_json.seed || 42;

  // Run 100% deterministic simulation until winner is crowned
  const simResult = useMemo(() => {
    return generateArenaSimulation(contestants, 3600, seed);
  }, [contestants, seed]);

  const { frames, soundEvents } = simResult;
  const current = frames[frame] || frames[frames.length - 1] || {
    fighters: [],
    items: [],
    bullets: [],
    floatingTexts: [],
    particles: [],
    winner: null,
    aliveCount: contestants.length,
    isOvertime: false,
  };

  const { fighters, items, bullets, floatingTexts, particles, winner: frameWinner } = current;

  // Render Ben 10 Omnitrix Alien Dossier Status Cards below the Arena Box
  const renderHealthBars = () => {
    const startY = ARENA_BOX.bottom + 25; // 1305
    const count = fighters.length;
    const colWidth = 470;
    const leftX = 45;
    const rightX = width - colWidth - 45;
    const rows = Math.ceil(count / 2);
    const rowHeight = Math.min(125, 570 / Math.max(rows, 2));

    return fighters.map((f, idx) => {
      let x = leftX;
      let y = startY;

      if (count === 2) {
        x = idx === 0 ? leftX : rightX;
        y = startY + 40;
      } else if (count === 3) {
        if (idx === 0) {
          x = leftX;
          y = startY;
        } else if (idx === 1) {
          x = rightX;
          y = startY;
        } else {
          x = (width - colWidth) / 2;
          y = startY + rowHeight + 15;
        }
      } else {
        const isRight = idx % 2 === 1;
        const row = Math.floor(idx / 2);
        x = isRight ? rightX : leftX;
        y = startY + row * rowHeight;
      }

      const hpPct = Math.max(0, f.health / f.maxHealth);
      let hpColor = '#00ff66';
      if (hpPct < 0.25) hpColor = '#ef4444';
      else if (hpPct < 0.55) hpColor = '#f59e0b';

      let itemTag = '';
      if (f.bonusShield > 0 || f.hasShield) itemTag += ' [SHIELD]';
      if (f.hasDagger) itemTag += ' [2X DMG]';
      if (f.gunBullets > 0) itemTag += ` [BLASTER x${f.gunBullets}]`;
      if (f.speedBoostTimer > 0) itemTag += ' [SPEED]';
      if (f.frozenTimer > 0) itemTag += ' [FROZEN]';

      const ab = f.specialAbility;
      const energy = Math.round(f.energyCharge || 0);
      const isCharged = energy >= 100 || f.specialMoveReady;

      return (
        <div
          key={f.id}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: colWidth,
            height: rowHeight - 12,
            borderRadius: 18,
            backgroundColor: f.isDead ? 'rgba(5, 15, 10, 0.45)' : 'rgba(3, 16, 8, 0.95)',
            border: `3px solid ${f.isDead ? '#1e293b' : isCharged ? '#00ff66' : f.color}`,
            display: 'flex',
            alignItems: 'center',
            padding: '8px 14px',
            boxSizing: 'border-box',
            gap: 14,
            overflow: 'hidden',
            boxShadow: f.isDead
              ? 'none'
              : isCharged
              ? '0 0 25px rgba(0, 255, 102, 0.5)'
              : `0 4px 16px ${f.color}33`,
          }}
        >
          {/* Avatar Spherical Thumbnail */}
          <div
            style={{
              width: rowHeight - 32,
              height: rowHeight - 32,
              borderRadius: '50%',
              backgroundColor: f.color,
              overflow: 'hidden',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px solid ${isCharged ? '#00ff66' : '#ffffff'}`,
              boxShadow: `0 0 14px ${f.color}88`,
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

          {/* Info & Bars */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Top Row: Alien Name & Live HP */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  color: f.isDead ? '#64748b' : '#ffffff',
                  fontWeight: 900,
                  fontSize: count <= 4 ? 24 : 20,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 220,
                  textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                }}
              >
                {f.name} {itemTag}
              </span>
              <span
                style={{
                  color: f.isDead ? '#ef4444' : '#00ff66',
                  fontWeight: 900,
                  fontSize: count <= 4 ? 22 : 18,
                  textShadow: '0 0 10px rgba(0, 255, 102, 0.7)',
                }}
              >
                {f.isDead ? 'ELIMINATED' : `${Math.round(f.health)} HP`}
              </span>
            </div>

            {/* Health Bar Track */}
            <div
              style={{
                width: '100%',
                height: 12,
                borderRadius: 6,
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${hpPct * 100}%`,
                  height: '100%',
                  borderRadius: 6,
                  backgroundColor: hpColor,
                  boxShadow: `0 0 10px ${hpColor}`,
                }}
              />
            </div>

            {/* Omnitrix Energy Charge Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(0, 20, 10, 0.8)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, energy)}%`,
                    height: '100%',
                    backgroundColor: isCharged ? '#00ff66' : '#10b981',
                    boxShadow: isCharged ? '0 0 8px #00ff66' : 'none',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: isCharged ? '#00ff66' : '#94a3b8',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {isCharged ? 'READY!' : `${energy}%`}
              </span>
            </div>

            {/* Special Move Badge */}
            {ab && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#94a3b8',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {ab.name}
              </span>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#020904',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Background Sound Effects & Music */}
      {data_json.bg_music_enabled !== false && (
        <Audio
          src={resolveAudioUrl(data_json.bg_music_url || '/audio/battle_bgm.mp3')}
          volume={data_json.bg_music_volume ?? 0.25}
          loop
        />
      )}

      {/* Synchronized Sound Effects */}
      {soundEvents.map((evt, idx) => {
        if (evt.frame > durationInFrames) return null;
        return (
          <Sequence key={`sfx_${evt.frame}_${idx}`} from={evt.frame} durationInFrames={20}>
            <Audio src={resolveSoundUrl(evt.sound, evt.abilityType)} volume={evt.volume ?? 0.7} />
          </Sequence>
        );
      })}

      {/* Ben 10 Sci-Fi Radial Glow & Circuit Traces */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 36%, rgba(0, 255, 102, 0.14) 0%, rgba(2, 9, 4, 0.98) 72%)',
        }}
      />

      {/* Top Banner Headline with Omnitrix Hourglass Logo */}
      <div
        style={{
          position: 'absolute',
          top: 110,
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 46,
            fontWeight: 900,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: '#ffffff',
            textShadow: '0 0 25px rgba(0, 255, 102, 0.8), 0 4px 10px rgba(0,0,0,0.9)',
          }}
        >
          <span>{headline}</span>
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: current.isOvertime ? '#ef4444' : '#00ff66',
            backgroundColor: current.isOvertime ? 'rgba(239, 68, 68, 0.25)' : 'rgba(0, 255, 102, 0.15)',
            border: `2px solid ${current.isOvertime ? '#ef4444' : 'rgba(0, 255, 102, 0.5)'}`,
            padding: '4px 18px',
            borderRadius: 20,
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}
        >
          {current.isOvertime
            ? 'OVERTIME: 2X DAMAGE'
            : current.isSelectionIntro
            ? 'SELECTING COMBATANTS'
            : `${current.aliveCount} ALIENS BATTLING`}
        </div>
      </div>

      {/* High-Tech Square Arena Box (900x900) */}
      <div
        style={{
          position: 'absolute',
          left: ARENA_BOX.left,
          top: ARENA_BOX.top,
          width: ARENA_BOX.width,
          height: ARENA_BOX.height,
          border: `5px solid ${current.isOvertime ? '#ef4444' : '#00ff66'}`,
          boxShadow: current.isOvertime
            ? '0 0 50px rgba(239, 68, 68, 0.5), inset 0 0 80px rgba(0,0,0,0.9)'
            : '0 0 45px rgba(0, 255, 102, 0.45), inset 0 0 80px rgba(0, 20, 10, 0.95)',
          backgroundColor: '#030c06',
          zIndex: 5,
        }}
      >
        {/* 4 Corner Sci-Fi Brackets */}
        <div style={{ position: 'absolute', top: -4, left: -4, width: 34, height: 34, borderTop: '6px solid #00ff66', borderLeft: '6px solid #00ff66' }} />
        <div style={{ position: 'absolute', top: -4, right: -4, width: 34, height: 34, borderTop: '6px solid #00ff66', borderRight: '6px solid #00ff66' }} />
        <div style={{ position: 'absolute', bottom: -4, left: -4, width: 34, height: 34, borderBottom: '6px solid #00ff66', borderLeft: '6px solid #00ff66' }} />
        <div style={{ position: 'absolute', bottom: -4, right: -4, width: 34, height: 34, borderBottom: '6px solid #00ff66', borderRight: '6px solid #00ff66' }} />

        {/* Subtle Galvanic Mechamorph Grid Lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(to right, rgba(0, 255, 102, 0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0, 255, 102, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '45px 45px',
          }}
        />

        {/* Ben 10 Omnitrix Center Dial with Pre-Battle Alien Selection Rotation Animation */}
        {current.isSelectionIntro ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) scale(${current.selectionDialScale || 1.0})`,
              width: 280,
              height: 280,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 30,
              pointerEvents: 'none',
              transformOrigin: 'center center',
            }}
          >
            {/* Outer Giant Glowing Alien Aura */}
            <div
              style={{
                position: 'absolute',
                inset: -35,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(0, 255, 102, 0.75) 20%, rgba(0, 255, 102, 0.3) 55%, transparent 75%)',
                filter: 'blur(25px)',
              }}
            />

            {/* Rotation Animation GIF provided by user */}
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '6px solid #00ff66',
                boxShadow: '0 0 50px #00ff66, inset 0 0 30px rgba(0,0,0,0.9)',
                backgroundColor: '#000000',
                position: 'relative',
              }}
            >
              <img
                src={staticFile('images/omnitrix_rotation.gif')}
                alt="Omnitrix Dialing"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>

            {/* Holographic Selection Alien Badge (No emoji) */}
            {current.selectedAlienName && (
              <div
                style={{
                  position: 'absolute',
                  bottom: -50,
                  backgroundColor: 'rgba(2, 9, 4, 0.95)',
                  border: `2px solid ${current.selectedAlienColor || '#00ff66'}`,
                  boxShadow: `0 0 25px ${current.selectedAlienColor || '#00ff66'}`,
                  borderRadius: 14,
                  padding: '6px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 18,
                  fontWeight: 900,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  letterSpacing: '1px',
                }}
              >
                <span>{current.selectedAlienName}</span>
              </div>
            )}
          </div>
        ) : (
          <OmnitrixDial size={280} opacity={0.92} />
        )}
      </div>

      {/* Arena Spawned Items */}
      {items.map((it) => (
        <div
          key={it.id}
          style={{
            position: 'absolute',
            left: it.x,
            top: it.y + Math.sin(frame * 0.1 + it.bobOffset) * 6,
            transform: 'translate(-50%, -50%)',
            zIndex: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: 'rgba(3, 16, 8, 0.95)',
              border: `3px solid ${it.color}`,
              boxShadow: `0 0 20px ${it.color}aa`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
            }}
          >
            {it.icon}
          </div>
          <span
            style={{
              marginTop: 4,
              fontSize: 13,
              fontWeight: 800,
              color: it.color,
              backgroundColor: 'rgba(0,0,0,0.85)',
              padding: '2px 8px',
              borderRadius: 8,
              whiteSpace: 'nowrap',
            }}
          >
            {it.name}
          </span>
        </div>
      ))}

      {/* Bullets */}
      {/* Bullets (Custom Visual Projectiles for Ben 10 Attacks) */}
      {bullets.map((b, idx) => {
        const bType = (b as any).bulletType || 'normal';
        const bAngle = Math.atan2(b.vy, b.vx);
        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: b.x,
              top: b.y,
              transform: `translate(-50%, -50%) rotate(${bAngle}rad)`,
              zIndex: 15,
              pointerEvents: 'none',
            }}
          >
            {bType === 'fireball' ? (
              <div
                style={{
                  width: 36,
                  height: 18,
                  borderRadius: '50% 10% 10% 50%',
                  background: 'linear-gradient(90deg, #ea580c, #facc15, #ffffff)',
                  boxShadow: '0 0 25px #ea580c, 0 0 10px #facc15',
                }}
              />
            ) : bType === 'shockwave' ? (
              <div
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: '50%',
                  border: `4px solid ${b.color}`,
                  boxShadow: `0 0 20px ${b.color}`,
                  backgroundColor: 'transparent',
                }}
              />
            ) : bType === 'laser' ? (
              <div
                style={{
                  width: 46,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: '#22c55e',
                  boxShadow: '0 0 22px #22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ width: 34, height: 4, borderRadius: 2, backgroundColor: '#ffffff' }} />
              </div>
            ) : bType === 'beam' ? (
              <div
                style={{
                  width: 52,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: '#facc15',
                  boxShadow: '0 0 28px #eab308',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ width: 40, height: 6, borderRadius: 3, backgroundColor: '#ffffff' }} />
              </div>
            ) : bType === 'shard' ? (
              <div
                style={{
                  width: 32,
                  height: 14,
                  backgroundColor: '#10b981',
                  clipPath: 'polygon(0% 50%, 50% 0%, 100% 50%, 50% 100%)',
                  boxShadow: '0 0 18px #10b981',
                }}
              />
            ) : bType === 'acid' ? (
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: '#84cc16',
                  boxShadow: '0 0 20px #84cc16',
                  border: '2px solid #bef264',
                }}
              />
            ) : (
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: b.color,
                  boxShadow: `0 0 18px ${b.color}`,
                }}
              />
            )}
          </div>
        );
      })}

      {/* Particles */}
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

      {/* Spherical Alien Balls with Alien-Specific Visual Effects & Centered Live HP */}
      {fighters.map((f) => {
        if (f.isDead) return null;

        const aType = getAlienType(f);
        let itemBadge = '';
        if (f.bonusShield > 0 || f.hasShield) itemBadge += ' [SHIELD]';
        if (f.hasDagger) itemBadge += ' [2X DMG]';
        if (f.gunBullets > 0) itemBadge += ` [BLASTER x${f.gunBullets}]`;
        if (f.speedBoostTimer > 0) itemBadge += ' [SPEED]';
        if (f.frozenTimer > 0) itemBadge += ' [FROZEN]';

        const isAbilityActive = f.abilityAuraTimer > 0;
        const isFrozen = f.frozenTimer > 0;
        const isCharged = (f.energyCharge || 0) >= 100 || f.specialMoveReady;
        const half = f.size / 2;

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
              borderRadius: '50%',
              backgroundColor: isFrozen ? '#0369a1' : '#031408',
              border: `${Math.max(4, Math.round(f.size * 0.055))}px solid ${
                f.hitFlash > 0
                  ? '#ffffff'
                  : isFrozen
                  ? '#38bdf8'
                  : isAbilityActive
                  ? '#00ff66'
                  : f.color
              }`,
              boxShadow: isAbilityActive
                ? `0 0 35px #00ff66, 0 0 15px #ffffff`
                : isCharged
                ? `0 0 25px #00ff66`
                : isFrozen
                ? `0 0 25px #38bdf8`
                : `0 0 22px ${f.color}aa`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* ========================================== */}
            {/* 1. CHARACTER-SPECIFIC VISUAL EFFECTS       */}
            {/* ========================================== */}

            {/* --- HEATBLAST: BLAZING FIRE FLAME AURA --- */}
            {aType === 'heatblast' && (
              <div
                style={{
                  position: 'absolute',
                  inset: -22,
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle, rgba(255, 230, 0, 0.95) 20%, rgba(234, 88, 12, 0.85) 55%, rgba(220, 38, 38, 0.6) 75%, transparent 95%)',
                  filter: 'blur(8px)',
                  boxShadow: '0 0 35px #ea580c, inset 0 0 20px #ffea00',
                  pointerEvents: 'none',
                  zIndex: -1,
                }}
              />
            )}

            {/* --- FOUR ARMS: 4 RED MUSCULAR ARMS (2 ON EACH SIDE) --- */}
            {/* --- FOUR ARMS: 4 RED MUSCULAR TETRAMAND ARMS WITH BLACK WRISTBANDS & CLENCHED FISTS --- */}
            {aType === 'four_arms' && (
              <svg
                style={{
                  position: 'absolute',
                  width: f.size + 90,
                  height: f.size + 90,
                  left: -45,
                  top: -45,
                  pointerEvents: 'none',
                  zIndex: -1,
                  overflow: 'visible',
                }}
                viewBox="0 0 200 200"
              >
                {/* Upper Left Arm */}
                <path
                  d="M 65 75 Q 35 45 25 65 L 35 85 Q 55 85 70 85 Z"
                  fill="#dc2626"
                  stroke="#7f1d1d"
                  strokeWidth="3.5"
                />
                <rect x="23" y="65" width="8" height="16" fill="#0f172a" stroke="#fff" strokeWidth="1" transform="rotate(-20 27 73)" />
                <circle cx="20" cy="73" r="11" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="2.5" />

                {/* Lower Left Arm */}
                <path
                  d="M 60 120 Q 30 145 22 125 L 32 105 Q 50 110 65 115 Z"
                  fill="#dc2626"
                  stroke="#7f1d1d"
                  strokeWidth="3.5"
                />
                <rect x="23" y="115" width="8" height="16" fill="#0f172a" stroke="#fff" strokeWidth="1" transform="rotate(20 27 123)" />
                <circle cx="20" cy="123" r="11" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="2.5" />

                {/* Upper Right Arm */}
                <path
                  d="M 135 75 Q 165 45 175 65 L 165 85 Q 145 85 130 85 Z"
                  fill="#dc2626"
                  stroke="#7f1d1d"
                  strokeWidth="3.5"
                />
                <rect x="169" y="65" width="8" height="16" fill="#0f172a" stroke="#fff" strokeWidth="1" transform="rotate(20 173 73)" />
                <circle cx="180" cy="73" r="11" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="2.5" />

                {/* Lower Right Arm */}
                <path
                  d="M 140 120 Q 170 145 178 125 L 168 105 Q 150 110 135 115 Z"
                  fill="#dc2626"
                  stroke="#7f1d1d"
                  strokeWidth="3.5"
                />
                <rect x="169" y="115" width="8" height="16" fill="#0f172a" stroke="#fff" strokeWidth="1" transform="rotate(-20 173 123)" />
                <circle cx="180" cy="123" r="11" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="2.5" />
              </svg>
            )}

            {/* --- XLR8: HIGH SPEED CYAN DASH BLUR & ELECTRIC TRAILS --- */}
            {aType === 'xlr8' && (
              <div
                style={{
                  position: 'absolute',
                  inset: -14,
                  borderRadius: '50%',
                  boxShadow: '0 0 30px #00f0ff, inset 0 0 18px #0284c7',
                  border: '2px dashed #38bdf8',
                  pointerEvents: 'none',
                  zIndex: -1,
                }}
              />
            )}

            {/* --- DIAMONDHEAD: SHARP CRYSTALLINE SHARDS AROUND PERIMETER --- */}
            {aType === 'diamondhead' && (
              <div
                style={{
                  position: 'absolute',
                  inset: -16,
                  borderRadius: '35%',
                  transform: 'rotate(45deg)',
                  border: '5px solid #10b981',
                  boxShadow: '0 0 25px #10b981',
                  pointerEvents: 'none',
                  zIndex: -1,
                }}
              />
            )}

            {/* --- CANNONBOLT: JAGGED SHARP SILVER ARMOR SHELL --- */}
            {aType === 'cannonbolt' && (
              <div
                style={{
                  position: 'absolute',
                  inset: -12,
                  borderRadius: '50%',
                  border: '6px dashed #cbd5e1',
                  boxShadow: '0 0 20px #94a3b8',
                  pointerEvents: 'none',
                  zIndex: -1,
                }}
              />
            )}

            {/* --- RIPJAWS: AQUATIC WAVE RIPPLE & SPLASH RING --- */}
            {aType === 'ripjaws' && (
              <div
                style={{
                  position: 'absolute',
                  inset: -16,
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle, transparent 60%, rgba(6, 182, 212, 0.45) 80%, rgba(34, 211, 238, 0.8) 100%)',
                  boxShadow: '0 0 25px #06b6d4',
                  border: '3px solid rgba(165, 243, 252, 0.7)',
                  pointerEvents: 'none',
                  zIndex: -1,
                }}
              />
            )}

            {/* --- GHOSTFREAK: GHOSTLY WISPY FLOWING TAIL & SPECTRAL AURA --- */}
            {aType === 'ghostfreak' && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: -36,
                  transform: 'translateX(-50%)',
                  width: half * 1.4,
                  height: 48,
                  background:
                    'linear-gradient(to bottom, rgba(148, 163, 184, 0.85), rgba(203, 213, 225, 0.4) 60%, transparent 100%)',
                  borderRadius: '0 0 50% 50%',
                  filter: 'blur(2px)',
                  boxShadow: '0 10px 25px rgba(203, 213, 225, 0.5)',
                  zIndex: -1,
                }}
              />
            )}

            {/* --- GREY MATTER: GALVAN INTELLECT PULSE --- */}
            {aType === 'grey_matter' && (
              <div
                style={{
                  position: 'absolute',
                  inset: -10,
                  borderRadius: '50%',
                  border: '2px dashed #facc15',
                  boxShadow: '0 0 20px #eab308',
                  pointerEvents: 'none',
                  zIndex: -1,
                }}
              />
            )}

            {/* --- STINKFLY: INSECT WINGS --- */}
            {aType === 'stinkfly' && (
              <div
                style={{
                  position: 'absolute',
                  top: -24,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: f.size * 0.9,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(217, 249, 157, 0.65)',
                  border: '2px solid #84cc16',
                  boxShadow: '0 0 16px #84cc16',
                  pointerEvents: 'none',
                  zIndex: -1,
                }}
              />
            )}

            {/* Ball Interior / Clipped Circular Avatar Image */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
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
                    background: `linear-gradient(135deg, ${f.color}, #020904)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: Math.round(f.size * 0.45),
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

              {/* Frozen Ice Tint Overlay (NO EMOJIS) */}
              {isFrozen && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(56, 189, 248, 0.45)',
                    border: '3px solid #38bdf8',
                    borderRadius: '50%',
                    zIndex: 3,
                  }}
                />
              )}
            </div>

            {/* LIVE HP NUMBER DISPLAYED DIRECTLY INSIDE CENTER OF BALL (Viral Video Style) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  fontSize: Math.round(f.size * 0.38),
                  fontWeight: 900,
                  color: '#ffffff',
                  textShadow:
                    '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 4px 10px rgba(0,0,0,0.95)',
                  letterSpacing: '-0.5px',
                  userSelect: 'none',
                }}
              >
                {Math.round(f.health)}
              </span>
            </div>

            {/* Visible Name Badge directly below the ball */}
            <div
              style={{
                position: 'absolute',
                bottom: -28,
                backgroundColor: 'rgba(3, 16, 8, 0.95)',
                border: `2px solid ${isCharged ? '#00ff66' : f.color}`,
                padding: '3px 12px',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 900,
                color: '#ffffff',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 10px rgba(0,0,0,0.8)',
                zIndex: 12,
              }}
            >
              {f.name}
            </div>

            {/* Active Status Badge Floating Above (NO EMOJIS) */}
            {(itemBadge || isAbilityActive || isCharged) && (
              <div
                style={{
                  position: 'absolute',
                  top: -28,
                  backgroundColor: 'rgba(3, 16, 8, 0.95)',
                  border: `2px solid ${isCharged ? '#00ff66' : '#ffffff'}`,
                  borderRadius: 12,
                  padding: '2px 8px',
                  fontSize: 13,
                  fontWeight: 800,
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.8)',
                  zIndex: 12,
                }}
              >
                {isCharged && <span style={{ color: '#00ff66' }}>READY</span>}
                {itemBadge}
              </div>
            )}
          </div>
        );
      })}

      {/* Floating Combat Text & Special Move Banners */}
      {floatingTexts.map((ft) => (
        <div
          key={ft.id}
          style={{
            position: 'absolute',
            left: ft.x,
            top: ft.y,
            transform: `translate(-50%, -50%) scale(${ft.scale || 1})`,
            color: ft.color,
            fontSize: 26,
            fontWeight: 900,
            textShadow: '0 0 12px rgba(0,0,0,0.9), 0 2px 4px #000',
            opacity: Math.max(0, ft.alpha),
            zIndex: 35,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {ft.text}
        </div>
      ))}

      {/* High-Tech Ben 10 Omnitrix Alien Dossier Health Cards */}
      {renderHealthBars()}

      {/* Victory Celebration Overlay (NO EMOJIS) */}
      {frameWinner && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(2, 9, 4, 0.88)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          {/* Golden Victory Emblem (NO EMOJIS) */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: '#facc15',
              boxShadow: '0 0 35px #eab308',
              border: '4px solid #ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 900,
              color: '#031408',
            }}
          >
            WIN
          </div>

          {/* Winner Spherical Avatar */}
          <div
            style={{
              width: 170,
              height: 170,
              borderRadius: '50%',
              backgroundColor: frameWinner.color,
              border: '6px solid #00ff66',
              boxShadow: '0 0 50px #00ff66',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '20px 0',
            }}
          >
            {frameWinner.image_url ? (
              <Img src={frameWinner.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 75, fontWeight: 900, color: '#fff' }}>
                {frameWinner.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: 68,
              fontWeight: 900,
              letterSpacing: '3px',
              color: '#00ff66',
              textShadow: '0 0 35px rgba(0, 255, 102, 0.9), 0 4px 12px #000',
            }}
          >
            VICTORY!
          </div>

          <div
            style={{
              fontSize: 42,
              fontWeight: 800,
              color: '#ffffff',
              marginTop: 10,
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            {frameWinner.name} WINS!
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
