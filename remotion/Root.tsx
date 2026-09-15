import React from 'react';
import { Composition, Audio } from 'remotion';
import { DataComparison } from './Composition';
import { ThreeDComposition } from './ThreeDComposition';
import './style.css';
import { loadFont } from '@remotion/google-fonts/Montserrat';

// Preload a bold, modern font for our text
loadFont();

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DataComparison"
        component={DataComparison}
        durationInFrames={450} // increased to 15s to fit TTS/Music
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          data_json: {
            script: "Did you know that some countries have thousands of active satellites in orbit? Let's take a look at the data!",
            items: [
              { label: 'Example A', value: 100, image_keyword: 'apple' },
              { label: 'Example B', value: 200, image_keyword: 'banana' },
              { label: 'Example C', value: 300, image_keyword: 'cherry' },
            ],
            tts_url: null, // Placeholder for TTS URL
            show_subtitles: true,
          },
          topic: 'Example Topic',
        }}
      />
      <Composition
        id="ThreeDComparison"
        component={ThreeDComposition}
        durationInFrames={450} // 15 seconds default
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          data_json: {
            script: "Welcome to this 3D data comparison!",
            items: [
              { label: 'Example A', value: 100, image_keyword: 'apple' },
              { label: 'Example B', value: 200, image_keyword: 'banana' },
              { label: 'Example C', value: 300, image_keyword: 'cherry' },
            ],
            tts_url: null,
            show_subtitles: true,
          },
          topic: '3D Example Topic',
        }}
      />
    </>
  );
};
