import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Img, Audio, Sequence, staticFile } from 'remotion';
import { TypewriterText } from './TypewriterText';
import {
  generateArenaSimulation,
  ARENA_CENTER,
  ARENA_RADIUS,
  SpecialAbility,
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
    case 'ability':
      if (abilityType === 'damage') return staticFile('audio/explosion.wav');
      if (abilityType === 'freeze') return staticFile('audio/bounce.wav');
      if (abilityType === 'shield' || abilityType === 'heal') return staticFile('audio/item.wav');
      return staticFile('audio/gun.wav');
    default:
      return staticFile('audio/hit.wav');
  }
};

export const ArenaClash: React.FC<{ data_json: ArenaClashData; topic: string }> = ({
  data_json,
  topic,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();

  const contestants = data_json.contestants || [];
  const headline = topic || data_json.topic || 'ARENA CLASH';
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

  // Render High-Contrast, Large-Text Healthbars below the Arena (y = 1220 to 1880)
  const renderHealthBars = () => {
    const startY = 1220;
    const count = fighters.length;
    const colWidth = 470;
    const leftX = 45;
    const rightX = width - colWidth - 45;
    const rows = Math.ceil(count / 2);
    const rowHeight = Math.min(135, 590 / Math.max(rows, 2));

    return fighters.map((f, idx) => {
      let x = leftX;
      let y = startY;

      if (count === 2) {
        x = idx === 0 ? leftX : rightX;
        y = startY + 70;
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
      if (f.bonusShield > 0 || f.hasShield) itemTag += ' 🛡️';
      if (f.hasDagger) itemTag += ' 🗡️';
      if (f.gunBullets > 0) itemTag += ` 🔫x${f.gunBullets}`;
      if (f.speedBoostTimer > 0) itemTag += ' ⚡';
      if (f.frozenTimer > 0) itemTag += ' ❄️';

      // Special Ability Badge Text
      const ab = f.specialAbility;
      const abilityBadge = ab ? `${ab.icon} ${ab.name}` : '';

      return (
        <div
          key={f.id}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: colWidth,
            height: rowHeight - 14,
            borderRadius: 22,
            backgroundColor: f.isDead ? 'rgba(15, 23, 42, 0.45)' : 'rgba(15, 23, 42, 0.95)',
            border: `3.5px solid ${f.isDead ? '#334155' : f.color}`,
            display: 'flex',
            alignItems: 'center',
            padding: '10px 16px',
            boxSizing: 'border-box',
            gap: 16,
            overflow: 'hidden',
            boxShadow: f.isDead ? 'none' : `0 4px 20px ${f.color}33`,
          }}
        >
          {/* Avatar Square Thumbnail */}
          <div
            style={{
              width: rowHeight - 34,
              height: rowHeight - 34,
              borderRadius: 16,
              backgroundColor: f.color,
              overflow: 'hidden',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
                  fontSize: 30,
                }}
              >
                {f.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Info & Bar */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Top Row: Enlarged Name & Status Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  color: f.isDead ? '#94a3b8' : '#ffffff',
                  fontWeight: 900,
                  fontSize: count <= 4 ? 28 : 24, // Greatly enlarged for maximum legibility!
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 240,
                  textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                }}
              >
                {f.name} {itemTag}
              </span>
              <span
                style={{
                  color: f.isDead ? '#ef4444' : '#38bdf8',
                  fontWeight: 900,
                  fontSize: count <= 4 ? 22 : 18,
                  textShadow: '0 2px 6px rgba(0,0,0,0.9)',
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
                backgroundColor: 'rgba(30, 41, 59, 0.95)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${hpPct * 100}%`,
                  height: '100%',
                  borderRadius: 8,
                  backgroundColor: hpColor,
                  boxShadow: `0 0 10px ${hpColor}`,
                  transition: 'width 0.1s linear',
                }}
              />
            </div>

            {/* Bottom Row: Special Ability Indicator */}
            {abilityBadge && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: f.color,
                    letterSpacing: '0.3px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 260,
                  }}
                >
                  {abilityBadge}
                </span>
                {!f.isDead && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: f.abilityCooldownTimer === 0 ? '#facc15' : '#94a3b8',
                    }}
                  >
                    {f.abilityCooldownTimer === 0 ? 'READY' : `${Math.ceil(f.abilityCooldownTimer / 30)}s`}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#030712',
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

      {/* Dynamic Background Glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 38%, rgba(56, 189, 248, 0.12) 0%, rgba(3, 7, 18, 0.95) 75%)',
        }}
      />

      {/* Top Banner Headline */}
      <div
        style={{
          position: 'absolute',
          top: 75,
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
            fontSize: 48,
            fontWeight: 900,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: '#ffffff',
            textShadow: '0 0 25px rgba(56, 189, 248, 0.8), 0 4px 10px rgba(0,0,0,0.9)',
          }}
        >
          {headline}
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: current.isOvertime ? '#ef4444' : '#38bdf8',
            backgroundColor: current.isOvertime ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.15)',
            border: `2px solid ${current.isOvertime ? '#ef4444' : 'rgba(56, 189, 248, 0.4)'}`,
            padding: '4px 16px',
            borderRadius: 20,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            animation: current.isOvertime ? 'pulse 1s infinite' : 'none',
          }}
        >
          {current.isOvertime ? '⚠️ OVERTIME: 2X DAMAGE' : `${current.aliveCount} FIGHTERS REMAINING`}
        </div>
      </div>

      {/* Circular Arena Boundary */}
      <div
        style={{
          position: 'absolute',
          left: ARENA_CENTER.x - ARENA_RADIUS,
          top: ARENA_CENTER.y - ARENA_RADIUS,
          width: ARENA_RADIUS * 2,
          height: ARENA_RADIUS * 2,
          borderRadius: '50%',
          border: `6px solid ${current.isOvertime ? '#ef4444' : '#38bdf8'}`,
          boxShadow: `0 0 50px ${current.isOvertime ? 'rgba(239, 68, 68, 0.45)' : 'rgba(56, 189, 248, 0.35)'}, inset 0 0 80px rgba(15, 23, 42, 0.95)`,
          backgroundColor: '#0a0f1d',
          zIndex: 5,
        }}
      >
        {/* Subtle Radar Rings */}
        <div
          style={{
            position: 'absolute',
            inset: 70,
            borderRadius: '50%',
            border: '2px dashed rgba(56, 189, 248, 0.18)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 170,
            borderRadius: '50%',
            border: '2px solid rgba(56, 189, 248, 0.12)',
          }}
        />
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
              borderRadius: 16,
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
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
              fontSize: 14,
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

      {/* Fighters: Rendered with Dynamic Proportional Sizing */}
      {fighters.map((f) => {
        if (f.isDead) return null;

        let itemBadge = '';
        if (f.bonusShield > 0 || f.hasShield) itemBadge += '🛡️';
        if (f.hasDagger) itemBadge += '🗡️';
        if (f.gunBullets > 0) itemBadge += `🔫x${f.gunBullets}`;
        if (f.speedBoostTimer > 0) itemBadge += '⚡';
        if (f.frozenTimer > 0) itemBadge += '❄️';

        const isAbilityActive = f.abilityAuraTimer > 0;
        const isFrozen = f.frozenTimer > 0;

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
              borderRadius: Math.round(f.size * 0.18),
              backgroundColor: isFrozen ? '#0369a1' : '#0f172a',
              border: `${Math.max(4, Math.round(f.size * 0.055))}px solid ${
                f.hitFlash > 0 ? '#ffffff' : isFrozen ? '#38bdf8' : isAbilityActive ? f.abilityAuraColor : f.color
              }`,
              boxShadow: isAbilityActive
                ? `0 0 35px ${f.abilityAuraColor}, 0 0 15px #ffffff`
                : isFrozen
                ? `0 0 25px #38bdf8`
                : `0 0 22px ${f.color}aa`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Box Interior / Avatar Image */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: Math.round(f.size * 0.13),
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

              {/* Frozen Ice Tint Overlay */}
              {isFrozen && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(56, 189, 248, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: Math.round(f.size * 0.4),
                    zIndex: 3,
                  }}
                >
                  ❄️
                </div>
              )}
            </div>

            {/* Visible Name Badge directly below the fighter box */}
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

            {/* Active Item / Ability Badges Floating Above */}
            {(itemBadge || isAbilityActive) && (
              <div
                style={{
                  position: 'absolute',
                  top: -28,
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: `2px solid ${isAbilityActive ? f.abilityAuraColor : '#ffffff'}`,
                  borderRadius: 12,
                  padding: '2px 8px',
                  fontSize: 14,
                  fontWeight: 800,
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.8)',
                  zIndex: 5,
                }}
              >
                {isAbilityActive && <span>{f.abilityAuraIcon}</span>}
                {itemBadge}
              </div>
            )}
          </div>
        );
      })}

      {/* Floating Damage & Special Ability Banner Texts */}
      {floatingTexts.map((ft) => (
        <div
          key={ft.id}
          style={{
            position: 'absolute',
            left: ft.x,
            top: ft.y,
            transform: `translate(-50%, -50%) scale(${ft.scale})`,
            color: ft.color,
            fontSize: 22,
            fontWeight: 900,
            textShadow: '0 2px 10px rgba(0,0,0,0.9), 0 0 15px rgba(0,0,0,0.8)',
            opacity: ft.alpha,
            zIndex: 25,
            whiteSpace: 'nowrap',
            letterSpacing: '0.5px',
          }}
        >
          {ft.text}
        </div>
      ))}

      {/* Dual-Sided Healthbars below the Arena */}
      {renderHealthBars()}

      {/* Victory Celebration Overlay: Shown when only 1 champion stands */}
      {frameWinner && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(3, 7, 18, 0.88)',
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.5s ease-out',
          }}
        >
          <div
            style={{
              width: 170,
              height: 170,
              borderRadius: 32,
              backgroundColor: frameWinner.color,
              border: '8px solid #facc15',
              boxShadow: '0 0 60px #eab308, 0 0 100px rgba(234, 179, 8, 0.5)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            {frameWinner.image_url ? (
              <Img src={frameWinner.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span
                style={{
                  fontSize: 78,
                  fontWeight: 900,
                  color: frameWinner.color === '#ffffff' ? '#000' : '#fff',
                }}
              >
                {frameWinner.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: 78,
              fontWeight: 900,
              color: '#facc15',
              textShadow: '0 0 35px #ca8a04',
              marginBottom: 10,
              letterSpacing: '2px',
            }}
          >
            VICTORY!
          </div>

          <div
            style={{
              fontSize: 52,
              fontWeight: 900,
              color: '#ffffff',
              textTransform: 'uppercase',
              textShadow: '0 4px 15px rgba(0,0,0,0.9)',
              letterSpacing: '1px',
            }}
          >
            {frameWinner.name} WINS!
          </div>

          {frameWinner.specialAbility && (
            <div
              style={{
                marginTop: 12,
                fontSize: 26,
                fontWeight: 800,
                color: frameWinner.color,
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                padding: '6px 20px',
                borderRadius: 16,
                border: `2px solid ${frameWinner.color}`,
              }}
            >
              Ultimate: {frameWinner.specialAbility.icon} {frameWinner.specialAbility.name}
            </div>
          )}

          {data_json.end_title && data_json.end_title.trim() && (
            <div
              style={{
                marginTop: 24,
                fontSize: 38,
                fontWeight: 800,
                color: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.75)',
                padding: '12px 36px',
                borderRadius: 22,
                border: '2px solid rgba(255,255,255,0.3)',
                textAlign: 'center',
                maxWidth: '85%',
              }}
            >
              <TypewriterText text={data_json.end_title.trim()} delayFrames={10} />
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
