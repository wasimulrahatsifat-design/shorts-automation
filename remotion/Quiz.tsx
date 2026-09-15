import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence, Audio, Img } from 'remotion';

interface QuizJson {
  script: string;
  question: string;
  options: string[];
  correct_answer: string;
  image_url?: string;
  tts_url?: string;
  show_subtitles?: boolean;
}

export const Quiz: React.FC<{ data_json: QuizJson, topic: string }> = ({ data_json, topic }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const { script, question, options, correct_answer, image_url, tts_url, show_subtitles } = data_json;

  // Title Animations
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleScale = spring({ frame, fps, config: { damping: 14 } });

  // Question entrance
  const questionY = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  
  // Timer circle
  const timerDuration = 5 * fps;
  const timerStartFrame = 60; // Start timer after 2 seconds
  const timerProgress = interpolate(frame, [timerStartFrame, timerStartFrame + timerDuration], [0, 1], { extrapolateRight: 'clamp' });
  const isTimerDone = frame > timerStartFrame + timerDuration;

  const subtitleOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames - 10], [1, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#2b2d42', fontFamily: '"Montserrat", sans-serif', padding: '60px 40px', color: 'white' }}>
      {/* Audio Track */}
      {tts_url && <Audio src={tts_url} volume={0.9} />}

      {/* Header Topic */}
      <div style={{ 
        opacity: titleOpacity, 
        transform: `scale(${titleScale})`, 
        fontSize: 50, 
        fontWeight: 900, 
        textAlign: 'center',
        color: '#8d99ae',
        marginBottom: 20
      }}>
        {topic || "Trivia Time!"}
      </div>

      {/* Image & Question Box */}
      <div style={{
        transform: `translateY(${(1 - questionY) * -50}px)`,
        opacity: questionY,
        backgroundColor: '#edf2f4',
        borderRadius: 30,
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 40
      }}>
        {image_url && (
          <Img src={image_url} style={{ width: '100%', height: 350, objectFit: 'cover' }} />
        )}
        <div style={{ padding: '40px', fontSize: 50, fontWeight: 800, color: '#2b2d42', textAlign: 'center' }}>
          {question}
        </div>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 25, flex: 1 }}>
        {options.map((opt, index) => {
          const optEntrance = spring({ frame: frame - (30 + index * 10), fps, config: { damping: 14 } });
          const isCorrect = opt === correct_answer;
          
          // Pulse correct answer when timer is done
          const highlightCorrect = isTimerDone && isCorrect;
          const fadeIncorrect = isTimerDone && !isCorrect;

          return (
            <div key={index} style={{
              transform: `translateX(${(1 - optEntrance) * -100}px)`,
              opacity: fadeIncorrect ? 0.3 : optEntrance,
              backgroundColor: highlightCorrect ? '#2a9d8f' : '#8d99ae',
              padding: '30px',
              borderRadius: 20,
              fontSize: 45,
              fontWeight: 700,
              boxShadow: highlightCorrect ? '0 0 40px #2a9d8f' : 'none',
              transition: 'all 0.5s',
              border: highlightCorrect ? '6px solid white' : '6px solid transparent'
            }}>
              <span style={{ marginRight: 20, opacity: 0.7 }}>{['A', 'B', 'C'][index]}</span>
              {opt}
            </div>
          );
        })}
      </div>

      {/* Timer Bar */}
      <div style={{
        marginTop: 40,
        height: 20,
        backgroundColor: '#8d99ae',
        borderRadius: 10,
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${(1 - timerProgress) * 100}%`,
          height: '100%',
          backgroundColor: '#ef233c'
        }} />
      </div>

      {/* Subtitles Area */}
      {show_subtitles !== false && (
        <Sequence from={15}>
          <div style={{
            position: 'absolute',
            bottom: 150,
            left: 40,
            right: 40,
            textAlign: 'center',
            fontSize: 45,
            fontWeight: 800,
            textShadow: '4px 4px 15px rgba(0,0,0,0.8)',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: '20px',
            borderRadius: 15,
            border: '2px solid rgba(255,255,255,0.1)',
            opacity: subtitleOpacity,
            color: 'white',
            zIndex: 20
          }}>
            {script}
          </div>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
