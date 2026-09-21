import React from 'react';
import { useCurrentFrame } from 'remotion';

interface TypewriterTextProps {
  text: string;
  delayFrames?: number;
  speedMultiplier?: number;
  durationInFrames?: number;
  style?: React.CSSProperties;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  delayFrames = 4,
  speedMultiplier = 1,
  durationInFrames,
  style,
}) => {
  const frame = useCurrentFrame();
  const relFrame = Math.max(0, frame - delayFrames);

  let charsPerFrame = (19 / 30) * speedMultiplier;
  if (durationInFrames && durationInFrames > delayFrames + 20 && text.length > 0) {
    // Finish typing 15-20 frames before the end so the viewer can read the full text
    const activeFrames = Math.max(15, durationInFrames - delayFrames - 20);
    charsPerFrame = Math.max(charsPerFrame, text.length / activeFrames);
  }

  const charsToShow = Math.min(text.length, Math.floor(relFrame * charsPerFrame));
  const isTyping = charsToShow < text.length && relFrame > 0;
  const cursor = isTyping && (Math.floor(relFrame / 4) % 2 === 0) ? '▋' : '';

  return (
    <span style={{ display: 'inline', ...style }}>
      {text.slice(0, charsToShow)}
      {cursor && (
        <span style={{ opacity: 0.9, marginLeft: 4, color: '#facc15' }}>
          {cursor}
        </span>
      )}
    </span>
  );
};
