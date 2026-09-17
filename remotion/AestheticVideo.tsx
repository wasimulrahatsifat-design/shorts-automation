import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Sequence, Img, Series, interpolate } from 'remotion';

export interface AestheticScene {
  image_keyword: string;
  image_url?: string;
  duration: number;
}

export interface AestheticVideoJson {
  format?: string;
  topic?: string;
  scenes?: AestheticScene[];
}

const KenBurnsScene: React.FC<{ sceneData: AestheticScene }> = ({ sceneData }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { image_url, duration } = sceneData;

  // Ken Burns: slow scale from 1 to 1.1 over the duration of the scene
  const scale = interpolate(frame, [0, duration], [1, 1.1], { extrapolateRight: 'clamp' });

  // Soft crossfade: fade in the first 15 frames, fade out the last 15 frames
  // (Note: Remotion's Series component automatically handles sequences, 
  // but we can add an opacity transition to the image itself if we overlap sequences, 
  // or just fade in/out slightly.)
  const opacity = interpolate(
    frame,
    [0, 15, duration - 15, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      {image_url ? (
        <Img 
          src={image_url} 
          style={{ 
            position: 'absolute', 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover', 
            transform: `scale(${scale})`,
            opacity
          }} 
        />
      ) : (
        <div style={{ color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          No Image
        </div>
      )}
    </AbsoluteFill>
  );
};

export const AestheticVideo: React.FC<{ data_json: AestheticVideoJson, topic: string }> = ({ data_json, topic }) => {
  const { fps } = useVideoConfig();
  const { scenes } = data_json;

  if (!scenes || !Array.isArray(scenes)) {
    return <AbsoluteFill style={{ backgroundColor: '#111' }}><h1 style={{ color: 'white' }}>Invalid Data</h1></AbsoluteFill>;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Series>
        {scenes.map((scene, index) => {
          return (
            <Series.Sequence key={index} durationInFrames={scene.duration}>
              <KenBurnsScene sceneData={scene} />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
