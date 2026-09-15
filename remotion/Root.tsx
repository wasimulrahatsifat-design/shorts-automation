import React from 'react';
import { Composition, Audio } from 'remotion';
import { DataComparison } from './Composition';
import { WouldYouRather } from './WouldYouRather';
import { Quiz } from './Quiz';
import { loadFont } from '@remotion/google-fonts/Montserrat';

// Preload a bold, modern font for our text
loadFont();

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DataComparison"
        component={DataComparison}
        durationInFrames={450} // default
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={({ props }: any) => {
          return {
            durationInFrames: props.data_json?.duration_seconds ? props.data_json.duration_seconds * 30 : 450
          };
        }}
        defaultProps={{
          data_json: {
            script: "Welcome to this racing line chart!",
            timeline_labels: ["2018", "2019", "2020", "2021", "2022"],
            items: [
              { label: 'Example A', image_keyword: 'apple', values: [10, 20, 30, 80, 150] },
              { label: 'Example B', image_keyword: 'banana', values: [5, 15, 40, 60, 90] },
              { label: 'Example C', image_keyword: 'orange', values: [12, 18, 25, 45, 110] },
            ],
            tts_url: null,
            show_subtitles: true,
          },
          topic: 'Example Topic',
        }}
      />
      <Composition
        id="WouldYouRather"
        component={WouldYouRather}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={({ props }: any) => {
          return {
            durationInFrames: props.data_json?.duration_seconds ? props.data_json.duration_seconds * 30 : 450
          };
        }}
        defaultProps={{
          data_json: {
            script: "Would you rather have flying cars or teleportation?",
            scenario_a: "Flying Cars",
            scenario_b: "Teleportation",
            image_url_a: null,
            image_url_b: null,
            tts_url: null,
            show_subtitles: true,
          },
          topic: 'Would You Rather',
        }}
      />
      <Composition
        id="Quiz"
        component={Quiz}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={({ props }: any) => {
          return {
            durationInFrames: props.data_json?.duration_seconds ? props.data_json.duration_seconds * 30 : 450
          };
        }}
        defaultProps={{
          data_json: {
            script: "Can you guess this trivia question?",
            question: "What is the largest planet in our solar system?",
            options: ["Earth", "Jupiter", "Saturn"],
            correct_answer: "Jupiter",
            image_url: null,
            tts_url: null,
            show_subtitles: true,
          },
          topic: 'Trivia Time',
        }}
      />
    </>
  );
};
