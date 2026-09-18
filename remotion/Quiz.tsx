import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence, Audio, Img, Series, staticFile } from 'remotion';

interface Question {
  question: string;
  options: string[];
  correct_answer: string;
  image_keyword?: string;
  image_url?: string;
}

export interface QuizJson {
  script: string;
  format?: string;
  questions?: Question[];
  tts_url?: string | null;
  tts_urls?: string[] | null;
  show_subtitles?: boolean;
  bg_music_url?: string;
  bg_music_volume?: number;
  bg_music_enabled?: boolean;
}

const resolveAudioUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const clean = url.startsWith('/') ? url.slice(1) : url;
  return staticFile(clean);
};

export const getQuestionTiming = (q: Question, fps: number) => {
  const textLength = q.question.length + q.options.join(' ').length;
  // ~15 chars per sec is a good average for natural reading + 1s padding for punctuation
  const readingSeconds = (textLength / 15) + 1;
  const readingFrames = Math.round(readingSeconds * fps);
  const timerFrames = 5 * fps;
  const revealFrames = 2 * fps;
  return {
    readingFrames,
    timerFrames,
    revealFrames,
    totalFrames: readingFrames + timerFrames + revealFrames
  };
};

const QuizRound: React.FC<{ questionData: Question, topic: string }> = ({ questionData, topic }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { question, options, correct_answer, image_url } = questionData;

  // Title Animations
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleScale = spring({ frame, fps, config: { damping: 14 } });

  // Question entrance
  const questionY = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  
  // Timer circle/bar
  const { readingFrames, timerFrames } = getQuestionTiming(questionData, fps);
  const timerStartFrame = readingFrames;
  
  const timerProgress = interpolate(frame, [timerStartFrame, timerStartFrame + timerFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const isTimerDone = frame > timerStartFrame + timerFrames;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1b1d28',
        padding: '0 80px',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center', // Centers title, image, question, options, and timer bar vertically
        alignItems: 'stretch',
        fontFamily: '"Montserrat", sans-serif',
      }}
    >
      {/* Question / Quiz Topic Title */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          fontSize: 52,
          fontWeight: 900,
          textAlign: 'center',
          color: '#facc15',
          textTransform: 'uppercase',
          letterSpacing: 2,
          marginBottom: 28,
          textShadow: '0 4px 15px rgba(0,0,0,0.5)',
        }}
      >
        {topic || 'Trivia Time!'}
      </div>

      {/* Image & Question Box */}
      <div
        style={{
          transform: `translateY(${(1 - questionY) * -30}px)`,
          opacity: questionY,
          backgroundColor: '#edf2f4',
          borderRadius: 32,
          overflow: 'hidden',
          boxShadow: '0 15px 40px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: 32,
        }}
      >
        <div
          style={{
            width: '100%',
            height: 380,
            backgroundColor: '#0f172a',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          {isTimerDone ? (
            image_url ? (
              <Img src={image_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : null
          ) : (
            <div
              style={{
                fontSize: 150,
                transform: `rotate(${Math.sin(frame / 8) * 15}deg) scale(${1 + Math.sin(frame / 6) * 0.1})`,
                filter: 'drop-shadow(0px 10px 20px rgba(0,0,0,0.3))',
              }}
            >
              🤔
            </div>
          )}
        </div>
        <div
          style={{
            padding: '26px 32px',
            fontSize: 42,
            fontWeight: 800,
            color: '#2b2d42',
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          {question}
        </div>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
        {options.map((opt, index) => {
          const optEntrance = spring({ frame: frame - (30 + index * 10), fps, config: { damping: 14 } });
          const isCorrect = opt === correct_answer;

          // Pulse correct answer when timer is done
          const highlightCorrect = isTimerDone && isCorrect;
          const fadeIncorrect = isTimerDone && !isCorrect;

          return (
            <div
              key={index}
              style={{
                transform: `translateX(${(1 - optEntrance) * -100}px)`,
                opacity: fadeIncorrect ? 0.35 : optEntrance,
                backgroundColor: highlightCorrect ? '#10b981' : '#334155',
                padding: '24px 30px',
                borderRadius: 22,
                fontSize: 38,
                fontWeight: 800,
                boxShadow: highlightCorrect ? '0 0 45px #10b981' : '0 6px 15px rgba(0,0,0,0.3)',
                transition: 'all 0.5s',
                border: highlightCorrect ? '5px solid white' : '5px solid transparent',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: highlightCorrect ? 'white' : 'rgba(255,255,255,0.12)',
                  color: highlightCorrect ? '#10b981' : 'white',
                  fontWeight: 900,
                  fontSize: 30,
                  marginRight: 24,
                  flexShrink: 0,
                }}
              >
                {['A', 'B', 'C', 'D'][index]}
              </span>
              <span>{opt}</span>
            </div>
          );
        })}
      </div>

      {/* Timer Sound */}
      {frame >= timerStartFrame && frame < timerStartFrame + timerFrames && (
        <Sequence from={timerStartFrame} durationInFrames={timerFrames}>
          <Audio src={staticFile('timer.mp3')} volume={0.6} />
        </Sequence>
      )}

      {/* Correct Answer Sound */}
      {frame >= timerStartFrame + timerFrames && (
        <Sequence from={timerStartFrame + timerFrames} durationInFrames={30}>
          <Audio src={staticFile('correct.mp3')} volume={0.8} />
        </Sequence>
      )}

      {/* Timer Bar */}
      <div
        style={{
          height: 22,
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          borderRadius: 12,
          overflow: 'hidden',
          opacity: timerProgress > 0 ? 1 : 0.4,
          transition: 'opacity 0.3s',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            width: `${(1 - timerProgress) * 100}%`,
            height: '100%',
            backgroundColor: '#ef4444',
            borderRadius: 12,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const Quiz: React.FC<{ data_json: QuizJson, topic: string }> = ({ data_json, topic }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const { script, questions = [], tts_url, tts_urls, show_subtitles, bg_music_url, bg_music_volume } = data_json;

  // Fallback if no questions are provided
  if (!questions || questions.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#1b1d28', justifyContent: 'center', alignItems: 'center', color: 'white' }}>
        <h1>No Questions Found</h1>
      </AbsoluteFill>
    );
  }

  const subtitleOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames - 10], [1, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#1b1d28', fontFamily: '"Montserrat", sans-serif', color: 'white' }}>
      {/* Background Music Track */}
      {bg_music_url && data_json.bg_music_enabled !== false && (
        <Audio src={resolveAudioUrl(bg_music_url)} volume={bg_music_volume ?? 0.15} loop />
      )}

      {/* Background Audio Track - legacy fallback for single track */}
      {tts_url && (!tts_urls || tts_urls.length === 0) && <Audio src={tts_url} volume={0.9} />}

      <Series>
        {questions.map((q, idx) => {
          const { totalFrames } = getQuestionTiming(q, fps);
          
          return (
            <Series.Sequence key={idx} durationInFrames={totalFrames}>
              {/* Play individual audio for this specific question */}
              {tts_urls && tts_urls[idx] && <Audio src={tts_urls[idx]} volume={0.9} />}
              <QuizRound questionData={q} topic={topic} />
            </Series.Sequence>
          );
        })}
        
        {/* Outro Sequence */}
        <Series.Sequence durationInFrames={3 * fps}>
          {tts_urls && tts_urls[questions.length] && (
            <Audio src={tts_urls[questions.length]} volume={0.9} />
          )}
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ fontSize: 80, fontWeight: 'bold', textShadow: '0px 10px 30px rgba(0,0,0,0.8)' }}>
              Thanks for watching!
            </div>
          </AbsoluteFill>
        </Series.Sequence>
      </Series>

      {/* Subtitles Area (Optional) */}
      {show_subtitles !== false && (
        <div style={{
          position: 'absolute',
          bottom: 150,
          left: 100,
          right: 100,
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
