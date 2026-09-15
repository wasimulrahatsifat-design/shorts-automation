import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence, Audio, Img, Series } from 'remotion';

interface Question {
  question: string;
  options: string[];
  correct_answer: string;
  image_keyword?: string;
  image_url?: string;
}

interface QuizJson {
  script: string;
  questions: Question[];
  tts_url?: string;
  show_subtitles?: boolean;
}

const QuizRound: React.FC<{ questionData: Question, roundDuration: number, topic: string }> = ({ questionData, roundDuration, topic }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { question, options, correct_answer, image_url } = questionData;

  // Title Animations
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleScale = spring({ frame, fps, config: { damping: 14 } });

  // Question entrance
  const questionY = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  
  // Timer circle/bar
  // The user says timer starts before audio ends.
  // We allocate 16s per round. Reading takes ~9s, timer takes 5s, reveal takes 2s.
  // Let's hardcode the timer to start at exactly 9 seconds (9 * fps) into the round.
  const timerStartFrame = 9 * fps;
  const timerDuration = 5 * fps;
  
  const timerProgress = interpolate(frame, [timerStartFrame, timerStartFrame + timerDuration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const isTimerDone = frame > timerStartFrame + timerDuration;

  return (
    <AbsoluteFill style={{ display: 'flex', flexDirection: 'column' }}>
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
        marginBottom: 40,
        marginTop: 20
      }}>
        {image_url && (
          <Img src={image_url} style={{ width: '100%', height: 400, objectFit: 'contain', backgroundColor: '#d8e2dc' }} />
        )}
        <div style={{ padding: '20px 30px', fontSize: 40, fontWeight: 800, color: '#2b2d42', textAlign: 'center' }}>
          {question}
        </div>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
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
              padding: '25px',
              borderRadius: 20,
              fontSize: 40,
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
        overflow: 'hidden',
        opacity: timerProgress > 0 ? 1 : 0.3, // Dim before starting
        transition: 'opacity 0.3s'
      }}>
        <div style={{
          width: `${(1 - timerProgress) * 100}%`,
          height: '100%',
          backgroundColor: '#ef233c'
        }} />
      </div>
    </AbsoluteFill>
  );
};

export const Quiz: React.FC<{ data_json: QuizJson, topic: string }> = ({ data_json, topic }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const { script, questions = [], tts_url, show_subtitles } = data_json;

  // Fallback if no questions are provided
  if (!questions || questions.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#2b2d42', justifyContent: 'center', alignItems: 'center', color: 'white' }}>
        <h1>No Questions Found</h1>
      </AbsoluteFill>
    );
  }

  // Divide total duration equally among questions
  const roundDuration = Math.floor(durationInFrames / questions.length);

  const subtitleOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames - 10], [1, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#2b2d42', fontFamily: '"Montserrat", sans-serif', padding: '60px 40px', color: 'white' }}>
      {/* Background Audio Track - single track spanning all questions */}
      {tts_url && <Audio src={tts_url} volume={0.9} />}

      <Series>
        {questions.map((q, idx) => {
          // If it's the last question, give it whatever remaining frames exist so we don't end early due to flooring
          const isLast = idx === questions.length - 1;
          const dur = isLast ? durationInFrames - (roundDuration * (questions.length - 1)) : roundDuration;
          
          return (
            <Series.Sequence key={idx} durationInFrames={dur}>
              <QuizRound questionData={q} roundDuration={dur} topic={topic} />
            </Series.Sequence>
          );
        })}
      </Series>

      {/* Subtitles Area (Optional) */}
      {show_subtitles !== false && (
        <div style={{
          position: 'absolute',
          bottom: 150,
          left: 40,
          right: 40,
          textAlign: 'center',
          fontSize: 35,
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
          {/* Subtitles can be tricky with SSML breaks, we might need a dedicated subtitle parser 
              if the text gets too long, but for now we just show a static or simple scrolling view if needed */}
          Trivia Challenge!
        </div>
      )}
    </AbsoluteFill>
  );
};
