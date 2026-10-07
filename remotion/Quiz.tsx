import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence, Audio, Img, Series, staticFile } from 'remotion';
import { TypewriterText } from './TypewriterText';

export interface Question {
  question: string;
  options: string[];
  correct_answer: string;
  image_keyword?: string;
  image_url?: string;
  show_image_first?: boolean;
  answer_tts_url?: string;
}

export interface QuizJson {
  script: string;
  format?: string;
  part_title?: string;
  questions?: Question[];
  tts_url?: string | null;
  tts_urls?: string[] | null;
  answer_tts_urls?: (string | null)[] | null;
  show_subtitles?: boolean;
  end_title?: string;
  bg_music_url?: string;
  bg_music_volume?: number;
  bg_music_enabled?: boolean;
  thinking_gif?: string;
  show_image_first?: boolean;
}

const resolveAudioUrl = (url?: string) => {
  if (!url) return '';
  if (url.includes('krtdupjglmlhumcbsxke.supabase.co')) {
    return staticFile('audio/lofi_chill.mp3');
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const clean = url.startsWith('/') ? url.slice(1) : url;
  return staticFile(clean);
};

const resolveGifUrl = (url?: string) => {
  if (!url) return staticFile('thinking.gif');
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const clean = url.startsWith('/') ? url.slice(1) : url;
  return staticFile(clean);
};

/**
 * Accurate frame timing calculation so audio and voiceovers never get truncated:
 * - readingFrames: Natural comfortable reading rate (~12 chars/sec + 1.8s padding)
 * - timerFrames: 3 seconds countdown
 * - revealFrames: 2.6 seconds to announce answer (e.g. "A, Bamboo") & show celebration
 */
export const getQuestionTiming = (q: Question, fps: number) => {
  const textLength = (q.question || '').length + (q.options || []).join(' ').length;
  const readingSeconds = Math.max(4.5, (textLength / 12) + 1.8);
  const readingFrames = Math.round(readingSeconds * fps);
  const timerFrames = 3 * fps; // 3 seconds countdown timer
  const revealFrames = Math.round(2.6 * fps); // 2.6 seconds to speak and celebrate the answer
  return {
    readingFrames,
    timerFrames,
    revealFrames,
    totalFrames: readingFrames + timerFrames + revealFrames,
  };
};

const ThinkingAnimation: React.FC<{ thinkingGifUrl?: string }> = ({ thinkingGifUrl }) => {
  const frame = useCurrentFrame();

  if (thinkingGifUrl && thinkingGifUrl !== 'thinking.gif' && !thinkingGifUrl.endsWith('/thinking.gif')) {
    return (
      <img
        src={resolveGifUrl(thinkingGifUrl)}
        alt="Thinking"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          fontSize: 180,
          transform: `rotate(${Math.sin(frame / 8) * 12}deg) scale(${1 + Math.sin(frame / 6) * 0.08})`,
          filter: 'drop-shadow(0px 10px 25px rgba(0,0,0,0.5))',
          userSelect: 'none',
          lineHeight: 1,
        }}
      >
        {'\u{1F914}'}
      </div>
    </div>
  );
};

const QuizRound: React.FC<{ 
  questionData: Question; 
  topic: string; 
  partTitle?: string;
  thinkingGifUrl?: string;
  globalShowImageFirst?: boolean;
  answerAudioUrl?: string;
}> = ({ questionData, topic, partTitle, thinkingGifUrl, globalShowImageFirst, answerAudioUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { question, options = [], correct_answer, image_url } = questionData;

  // Smart detection for Picture/Image Guessing Quiz
  const isImageQuiz = Boolean(
    questionData.show_image_first ?? 
    globalShowImageFirst ?? 
    (questionData.image_url && (
      /\b(this (image|picture|photo|pic|logo|character|person|flag|celebrity|animal|place|item|thing|silhouette|shadow))\b/i.test(questionData.question) ||
      /\b(guess the (image|picture|character|logo|flag|celebrity|animal|person|movie|hero|alien|villain|pokemon|brand))\b/i.test(questionData.question) ||
      /\b(who is this|what is this|name this|identify this|which character|which person|which flag|which logo)\b/i.test(questionData.question) ||
      /(এই ছবি|ছবিতে কে|ছবিটি কার|চিহ্নিত কর|ছবিটি দেখে বলো)/i.test(questionData.question) ||
      /\b(guess the|identify the|visual quiz|picture quiz|photo quiz|logo quiz|flag quiz)\b/i.test(topic)
    ))
  );

  // Timing Breakdown
  const { readingFrames, timerFrames, revealFrames } = getQuestionTiming(questionData, fps);
  const timerStartFrame = readingFrames;
  
  const timerProgress = interpolate(
    frame, 
    [timerStartFrame, timerStartFrame + timerFrames], 
    [0, 1], 
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const isTimerDone = frame >= timerStartFrame + timerFrames;

  // Smooth Red Pen / Marker Underline Animation across readingFrames
  // Hand-drawn stroke draws from left to right as question is read aloud
  const penProgress = interpolate(
    frame,
    [3, Math.max(12, Math.round(readingFrames * 0.9))],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Find correct answer index
  const correctIdx = options.findIndex(opt => opt.trim().toLowerCase() === (correct_answer || '').trim().toLowerCase());
  const correctLetter = correctIdx >= 0 ? ['A', 'B', 'C', 'D'][correctIdx] : 'A';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#111520',
        color: 'white',
        fontFamily: '"Quicksand", sans-serif',
        overflow: 'hidden',
      }}
    >
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@600;700;800;900&display=swap');
          * {
            font-family: 'Quicksand', sans-serif !important;
          }
        `}
      </style>

      {/* 1. Static Top Title (Clean, Centered, Perfectly Stable) */}
      <div
        style={{
          position: 'absolute',
          top: 65,
          left: 60,
          right: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
        }}
      >
        <div
          style={{
            fontSize: 54,
            fontWeight: 900,
            textAlign: 'center',
            color: '#facc15',
            textTransform: 'uppercase',
            letterSpacing: 2.5,
            textShadow: '0 4px 20px rgba(0,0,0,0.85)',
            lineHeight: 1.15,
          }}
        >
          {topic || 'Trivia Challenge'}
        </div>

        {partTitle && partTitle.trim() ? (
          <div
            style={{
              marginTop: 12,
              fontSize: 26,
              fontWeight: 800,
              color: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.16)',
              border: '2px solid rgba(56, 189, 248, 0.5)',
              borderRadius: 999,
              padding: '4px 28px',
              letterSpacing: 2,
              textTransform: 'uppercase',
              boxShadow: '0 4px 15px rgba(0,0,0,0.35)',
            }}
          >
            {partTitle.trim()}
          </div>
        ) : null}
      </div>

      {/* 2. Static Question & Image Frame (Expanded 520px height for Crystal Clear View) */}
      <div
        style={{
          position: 'absolute',
          top: partTitle && partTitle.trim() ? 200 : 170,
          left: 65,
          right: 65,
          backgroundColor: '#ffffff',
          borderRadius: 36,
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.12)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        {/* Expanded Image Box (520px height) */}
        <div
          style={{
            width: '100%',
            height: 520,
            backgroundColor: '#090d16',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {isImageQuiz && image_url ? (
            <>
              <Img
                src={image_url}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  transform: isTimerDone ? 'scale(1.04)' : 'scale(1)',
                  transition: 'transform 0.4s ease-out',
                  filter: isTimerDone ? 'drop-shadow(0 0 30px rgba(74, 222, 128, 0.5))' : 'none',
                }}
              />

              {!isTimerDone && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    right: 16,
                    backgroundColor: 'rgba(9, 13, 22, 0.88)',
                    backdropFilter: 'blur(10px)',
                    border: '2px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: 999,
                    padding: '8px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  }}
                >
                  <span style={{ fontSize: 28, lineHeight: 1 }}>{'\u{1F914}'}</span>
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#38bdf8',
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                    }}
                  >
                    Thinking
                  </span>
                </div>
              )}
            </>
          ) : (
            isTimerDone ? (
              image_url ? (
                <Img src={image_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ fontSize: 130, lineHeight: 1 }}>{'\u{1F3AF}'}</div>
              )
            ) : (
              <ThinkingAnimation thinkingGifUrl={thinkingGifUrl} />
            )
          )}
        </div>

        {/* Question Text Box with Hand-Drawn Red Marker Underline */}
        <div
          style={{
            width: '100%',
            padding: '28px 36px 36px 36px',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              fontSize: 40,
              fontWeight: 800,
              color: '#1e293b',
              textAlign: 'center',
              lineHeight: 1.34,
              letterSpacing: -0.3,
              position: 'relative',
              display: 'inline-block',
              maxWidth: '100%',
              paddingBottom: 8,
            }}
          >
            {question}

            {/* Hand-Drawn Red Pen/Marker Underline that traces from left to right */}
            <div
              style={{
                position: 'absolute',
                bottom: -4,
                left: '2%',
                width: '96%',
                height: 18,
                overflow: 'visible',
                pointerEvents: 'none',
              }}
            >
              <svg
                viewBox="0 0 700 18"
                preserveAspectRatio="none"
                style={{
                  width: '100%',
                  height: '100%',
                  overflow: 'visible',
                }}
              >
                <path
                  d="M 5,11 Q 175,7 350,12 T 695,10"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: 720,
                    strokeDashoffset: (1 - penProgress) * 720,
                    filter: 'drop-shadow(0 2px 6px rgba(239, 68, 68, 0.5))',
                  }}
                />
              </svg>

              {/* Glowing Pen Tip Indicator along the active stroke */}
              {penProgress > 0.02 && penProgress < 0.98 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: `calc(${penProgress * 100}% - 7px)`,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    backgroundColor: '#dc2626',
                    boxShadow: '0 0 12px #ef4444, 0 0 4px #ffffff',
                    transform: 'scale(1.2)',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Options List with Smooth Staggered Animation & Answer Highlight */}
      <div
        style={{
          position: 'absolute',
          top: partTitle && partTitle.trim() ? 890 : 860,
          left: 65,
          right: 65,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          zIndex: 10,
        }}
      >
        {options.map((opt, index) => {
          const optDelay = 10 + index * 7;
          const optSpring = spring({ frame: frame - optDelay, fps, config: { damping: 16, stiffness: 95 } });
          const optTranslateY = interpolate(optSpring, [0, 1], [40, 0]);
          const optOpacity = interpolate(frame, [optDelay, optDelay + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

          const isCorrect = opt.trim().toLowerCase() === (correct_answer || '').trim().toLowerCase();
          const highlightCorrect = isTimerDone && isCorrect;
          const fadeIncorrect = isTimerDone && !isCorrect;

          return (
            <div
              key={index}
              style={{
                transform: `translateY(${optTranslateY}px) scale(${highlightCorrect ? 1.03 : 1})`,
                opacity: fadeIncorrect ? 0.35 : optOpacity,
                backgroundColor: highlightCorrect ? '#10b981' : '#232b3e',
                padding: '22px 28px',
                borderRadius: 24,
                fontSize: 38,
                fontWeight: 800,
                boxShadow: highlightCorrect
                  ? '0 0 40px rgba(16, 185, 129, 0.8), 0 10px 25px rgba(0,0,0,0.5)'
                  : '0 8px 20px rgba(0,0,0,0.3)',
                border: highlightCorrect ? '4px solid #ffffff' : '4px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                transition: 'transform 0.3s ease, background-color 0.3s ease, opacity 0.3s ease',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: highlightCorrect ? '#ffffff' : 'rgba(255,255,255,0.14)',
                  color: highlightCorrect ? '#10b981' : '#ffffff',
                  fontWeight: 900,
                  fontSize: 28,
                  marginRight: 22,
                  flexShrink: 0,
                  boxShadow: highlightCorrect ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                {['A', 'B', 'C', 'D'][index]}
              </span>
              <span style={{ color: '#ffffff', flex: 1, lineHeight: 1.25 }}>
                {opt}
              </span>
              {highlightCorrect && (
                <span
                  style={{
                    fontSize: 32,
                    marginLeft: 14,
                  }}
                >
                  {'\u{2705}'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Timer Bar & Answer Announcement Banner (Positioned above Shorts bottom UI zone) */}
      <div
        style={{
          position: 'absolute',
          bottom: 220,
          left: 80,
          right: 80,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          zIndex: 15,
        }}
      >
        {/* Countdown Bar */}
        <div
          style={{
            width: '100%',
            height: 22,
            backgroundColor: 'rgba(255, 255, 255, 0.14)',
            borderRadius: 999,
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            border: '2px solid rgba(255,255,255,0.2)',
          }}
        >
          <div
            style={{
              width: `${(1 - timerProgress) * 100}%`,
              height: '100%',
              backgroundColor: timerProgress > 0.65 ? '#ef4444' : '#f59e0b',
              borderRadius: 999,
              transition: 'background-color 0.3s ease',
            }}
          />
        </div>

        {/* Prominent Correct Answer Pill Badge at Countdown End */}
        {isTimerDone && (
          <div
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.95)',
              color: 'white',
              padding: '12px 36px',
              borderRadius: 999,
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: 1,
              textTransform: 'uppercase',
              boxShadow: '0 10px 30px rgba(16, 185, 129, 0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span>Answer:</span>
            <span style={{ textDecoration: 'underline' }}>{correctLetter} • {correct_answer}</span>
          </div>
        )}
      </div>

      {/* 5. Sound Effects & Spoken Reveal Audio */}
      {/* Countdown ticking sound */}
      {frame >= timerStartFrame && frame < timerStartFrame + timerFrames && (
        <Sequence from={timerStartFrame} durationInFrames={timerFrames}>
          <Audio src={staticFile('timer.mp3')} volume={0.65} />
        </Sequence>
      )}

      {/* Correct answer chime sound */}
      {frame >= timerStartFrame + timerFrames && (
        <Sequence from={timerStartFrame + timerFrames} durationInFrames={30}>
          <Audio src={staticFile('correct.mp3')} volume={0.85} />
        </Sequence>
      )}

      {/* Spoken Answer Announcement Audio (e.g. "A, Bamboo") */}
      {answerAudioUrl && (
        <Sequence from={timerStartFrame + timerFrames} durationInFrames={revealFrames}>
          <Audio src={resolveAudioUrl(answerAudioUrl)} volume={1.0} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

export const Quiz: React.FC<{ data_json: QuizJson, topic: string }> = ({ data_json, topic }) => {
  const { fps } = useVideoConfig();

  const { questions = [], tts_url, tts_urls, answer_tts_urls, bg_music_url, bg_music_volume } = data_json;

  if (!questions || questions.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#111520', justifyContent: 'center', alignItems: 'center', color: 'white', fontFamily: '"Quicksand", sans-serif' }}>
        <h1 style={{ fontFamily: '"Quicksand", sans-serif' }}>No Questions Found</h1>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#111520', fontFamily: '"Quicksand", sans-serif', color: 'white' }}>
      {/* Background Music Track */}
      {bg_music_url && data_json.bg_music_enabled !== false && (
        <Audio src={resolveAudioUrl(bg_music_url)} volume={bg_music_volume ?? 0.15} loop />
      )}

      {/* Single Voiceover Track Fallback */}
      {tts_url && (!tts_urls || tts_urls.length === 0) && <Audio src={tts_url} volume={0.9} />}

      <Series>
        {questions.map((q, idx) => {
          const { totalFrames } = getQuestionTiming(q, fps);
          const answerAudio = q.answer_tts_url || (answer_tts_urls && answer_tts_urls[idx]) || undefined;

          return (
            <Series.Sequence key={idx} durationInFrames={totalFrames}>
              {/* Question Audio */}
              {tts_urls && tts_urls[idx] && <Audio src={resolveAudioUrl(tts_urls[idx])} volume={0.9} />}
              <QuizRound 
                questionData={q} 
                topic={topic} 
                partTitle={data_json.part_title} 
                thinkingGifUrl={data_json.thinking_gif} 
                globalShowImageFirst={data_json.show_image_first}
                answerAudioUrl={answerAudio}
              />
            </Series.Sequence>
          );
        })}
        
        {/* Outro Sequence */}
        {data_json.end_title && data_json.end_title.trim() ? (
          <Series.Sequence durationInFrames={Math.round(2.8 * fps)}>
            {tts_urls && tts_urls[questions.length] && (
              <Audio src={resolveAudioUrl(tts_urls[questions.length])} volume={0.9} />
            )}
            <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 50px', textAlign: 'center' }}>
              <div style={{ 
                fontSize: 74, 
                fontWeight: 900, 
                textShadow: '0px 10px 30px rgba(0,0,0,0.9)',
                color: '#ffffff',
                lineHeight: 1.3,
                maxWidth: '90%',
                fontFamily: '"Quicksand", sans-serif',
              }}>
                <TypewriterText 
                  text={data_json.end_title.trim()} 
                  durationInFrames={Math.round(2.8 * fps)} 
                  delayFrames={4} 
                />
              </div>
            </AbsoluteFill>
          </Series.Sequence>
        ) : null}
      </Series>
    </AbsoluteFill>
  );
};
