import React from 'react';
import { Composition, Audio } from 'remotion';
import { DataComparison } from './Composition';
import { WouldYouRather } from './WouldYouRather';
import { Quiz, getQuestionTiming } from './Quiz';
import { ArenaClash } from './ArenaClash';
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
          if (props.data_json?.questions && Array.isArray(props.data_json.questions)) {
            let totalFrames = 0;
            for (const q of props.data_json.questions) {
              totalFrames += getQuestionTiming(q, 30).totalFrames;
            }
            // Add a little padding at the end
            return { durationInFrames: totalFrames + 30 };
          }
          return {
            durationInFrames: props.data_json?.duration_seconds ? props.data_json.duration_seconds * 30 : 450
          };
        }}
        defaultProps={{
          data_json: {
            script: "What is the largest planet in our solar system? A, Earth, B, Jupiter, C, Saturn. <break time=\"5s\"/> Which element has the chemical symbol O? A, Gold, B, Oxygen, C, Osmium. <break time=\"5s\"/> What is the capital of Japan? A, Seoul, B, Beijing, C, Tokyo. <break time=\"5s\"/> Who wrote Hamlet? A, Charles Dickens, B, William Shakespeare, C, Jane Austen. <break time=\"5s\"/> What is the speed of light? A, 300,000 km/s, B, 150,000 km/s, C, 1,000,000 km/s. <break time=\"5s\"/>",
            format: "Quiz",
            questions: [
              {
                question: "What is the largest planet in our solar system?",
                options: ["Earth", "Jupiter", "Saturn"],
                correct_answer: "Jupiter",
                image_keyword: "Jupiter"
              },
              {
                question: "Which element has the chemical symbol O?",
                options: ["Gold", "Oxygen", "Osmium"],
                correct_answer: "Oxygen",
                image_keyword: "Oxygen"
              },
              {
                question: "What is the capital of Japan?",
                options: ["Seoul", "Beijing", "Tokyo"],
                correct_answer: "Tokyo",
                image_keyword: "Tokyo"
              },
              {
                question: "Who wrote Hamlet?",
                options: ["Charles Dickens", "William Shakespeare", "Jane Austen"],
                correct_answer: "William Shakespeare",
                image_keyword: "William Shakespeare"
              },
              {
                question: "What is the speed of light?",
                options: ["300,000 km/s", "150,000 km/s", "1,000,000 km/s"],
                correct_answer: "300,000 km/s",
                image_keyword: "Speed of light"
              }
            ],
            tts_url: null,
            show_subtitles: true,
          },
          topic: 'Trivia Time',
        }}
      />
      <Composition
        id="ArenaClash"
        component={ArenaClash}
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
            script: "Welcome to the ultimate Battle Royale!",
            format: "Arena Clash",
            contestants: [
              { id: "1", name: "Fighter A", color: "#FF0000", starting_health: 100 },
              { id: "2", name: "Fighter B", color: "#0000FF", starting_health: 100 },
              { id: "3", name: "Fighter C", color: "#00FF00", starting_health: 100 },
              { id: "4", name: "Fighter D", color: "#FFFF00", starting_health: 100 }
            ],
            events: [
              { frame: 60, attacker: "1", defender: "2", damage: 25, item_used: "Sword" },
              { frame: 120, attacker: "3", defender: "1", damage: 40, item_used: "Fireball" },
              { frame: 200, attacker: "4", defender: "3", damage: 100, item_used: "Sniper" }
            ],
            winner_id: "4",
            tts_url: null,
            show_subtitles: true,
          },
          topic: 'Arena Clash Demo',
        }}
      />
    </>
  );
};
