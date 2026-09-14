import React from 'react';
import { Composition } from 'remotion';
import { DataComparison } from './Composition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DataComparison"
        component={DataComparison}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          data_json: [
            { label: 'Example A', value: 100, image_keyword: 'apple' },
            { label: 'Example B', value: 200, image_keyword: 'banana' },
            { label: 'Example C', value: 300, image_keyword: 'cherry' },
          ],
          topic: 'Example Topic',
        }}
      />
    </>
  );
};
