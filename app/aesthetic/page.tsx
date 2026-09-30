'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface SceneItem {
  camera_angle?: string;
  camera_motion?: string;
  image_keyword: string;
  image_url?: string;
  duration: number;
}

const PRESET_THEMES = [
  {
    title: '🌸 Cherry Blossom Dream Meadow',
    desc: 'Like the public sample video: ethereal meadow, blooming white & pink cherry trees, pastel sky',
    prompt: 'Ethereal dreamcore meadow with blooming white and pink cherry blossom trees under a soft pastel lavender sky'
  },
  {
    title: '🏊 Liminal Pool Rooms',
    desc: 'Surreal infinite indoor pool rooms, calm turquoise water, pale ceramic tiles, warm skylight',
    prompt: 'Surreal liminal dreamcore pool room with glowing calm turquoise water, white ceramic tiles, and soft overhead skylight haze'
  },
  {
    title: '🛋️ Nostalgic 90s Empty Mall Atrium',
    desc: 'Dreamcore vaporwave mall, indoor fountain, glass elevators, soft neon glow, vapor mist',
    prompt: 'Nostalgic 1990s empty mall atrium at dawn, indoor palm trees, brass railings, glass elevator, liminal dreamcore haze'
  },
  {
    title: '🌫️ Misty Twilight Forest Gazebo',
    desc: 'Ancient stone gazebo in misty pine woods, glowing moss, surreal floating lanterns',
    prompt: 'Ancient stone gazebo hidden deep inside a misty dreamcore pine forest with ethereal glowing moss and soft volumetric twilight'
  },
  {
    title: '☁️ Infinite Sky Corridor',
    desc: 'Endless white marble arches floating above cotton clouds, golden sunset rays',
    prompt: 'Infinite liminal corridor with white classical arches open to a surreal sea of pastel clouds and warm golden hour sunlight'
  },
  {
    title: '🚪 Solitary Door in Rolling Fields',
    desc: 'Vast golden wheat field with a single glowing door leading into a starry void',
    prompt: 'A solitary vintage wooden door standing in the center of an endless golden wheat field under a twilight dreamcore sky'
  }
];

export default function AestheticPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  const [draftJson, setDraftJson] = useState('');
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [locationDescription, setLocationDescription] = useState('');

  // Sync parsed scenes from draftJson
  useEffect(() => {
    if (!draftJson || step !== 2) return;
    try {
      const parsed = JSON.parse(draftJson);
      if (parsed.location_description) {
        setLocationDescription(parsed.location_description);
      }
      if (Array.isArray(parsed.scenes)) {
        setScenes(parsed.scenes);
      }
    } catch {
      // invalid json, ignore
    }
  }, [draftJson, step]);

  const handleFileUpload = (sceneIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Url = reader.result as string;

      setScenes(prev => {
        const next = [...prev];
        if (next[sceneIndex]) {
          next[sceneIndex] = { ...next[sceneIndex], image_url: base64Url };
        }
        return next;
      });

      setDraftJson(prevJson => {
        try {
          const parsed = JSON.parse(prevJson);
          if (parsed.scenes && parsed.scenes[sceneIndex]) {
            parsed.scenes[sceneIndex].image_url = base64Url;
          }
          return JSON.stringify(parsed, null, 2);
        } catch {
          return prevJson;
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const handleCopyPrompt = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  const handleGenerateDraft = async (selectedTopic?: string) => {
    const topicToUse = (selectedTopic || topic).trim();
    if (!topicToUse) {
      setMessage({ type: 'error', text: 'Please enter or select a Dreamcore / Liminal theme.' });
      return;
    }

    setLoading(true);
    setMessage({ type: 'info', text: 'Drafting 4 cinematic shots for the exact same location...' });
    setScenes([]);

    try {
      const response = await fetch('/api/draft-aesthetic', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicToUse })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        setDraftJson(JSON.stringify(data.data, null, 2));
        if (data.data.location_description) {
          setLocationDescription(data.data.location_description);
        }
        if (Array.isArray(data.data.scenes)) {
          setScenes(data.data.scenes);
        }
        setStep(2);
        setMessage(null);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to generate draft.' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Unexpected error generating draft.' });
    } finally {
      setLoading(false);
    }
  };

  const handleQueueVideo = async () => {
    setLoading(true);
    setMessage({ type: 'info', text: 'Queueing Dreamcore video for rendering...' });

    try {
      const parsedJson = JSON.parse(draftJson);
      
      let totalFrames = 0;
      if (parsedJson.scenes) {
        for (let i = 0; i < parsedJson.scenes.length; i++) {
          const dur = parsedJson.scenes[i].duration || 125;
          totalFrames += i === 0 ? dur : (dur - 25);
        }
      }
      const durationSeconds = Math.max(15, Math.round(totalFrames / 30));

      const response = await fetch('/api/queue-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data_json: {
            ...parsedJson,
            bg_music_url: parsedJson.bg_music_url || '/audio/lofi_chill.mp3',
            bg_music_enabled: true
          }, 
          showSubtitles: false,
          duration: durationSeconds 
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setMessage({ 
          type: 'success', 
          text: `🎉 Dreamcore video (~${durationSeconds}s) queued successfully! Check Main Dashboard to view rendering status.` 
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to queue video.' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Unexpected error queueing video.' });
    } finally {
      setLoading(false);
    }
  };

  const allImagesUploaded = scenes.length > 0 && scenes.every(s => Boolean(s.image_url));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-6 md:p-8 border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🌌</span>
              <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">
                Dreamcore & Liminal Shorts Generator
              </h1>
            </div>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              Create cohesive 16–18 second ambient shorts with 4 cinematic angles of the exact same location.
            </p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Link 
              href="/game" 
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 hover:opacity-90 text-white font-bold transition-all text-center shadow-md shadow-red-500/20 text-sm"
            >
              ⚔️ Arena Game
            </Link>
            <Link 
              href="/" 
              className="px-4 py-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-all text-center text-sm"
            >
              Main Dashboard
            </Link>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`p-4 rounded-2xl text-sm font-medium border ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800' : 
            message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800' : 
            'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Step 1: Input Theme */}
        {step === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-6 md:p-8 border border-gray-100 dark:border-gray-700 space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                  Dreamcore / Liminal Space Theme
                </label>
                <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full font-semibold">
                  15–18 Seconds Short
                </span>
              </div>
              <input 
                type="text" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
                placeholder="e.g., Cherry blossom dream meadow, Liminal pool rooms, Nostalgic 90s mall..."
                className="w-full px-4 py-3.5 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white disabled:opacity-50 text-base focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                💡 টিপস: আলাদা আলাদা জায়গার বদলে একই জায়গার ৪টি সিনেমাটিক অ্যাঙ্গেল (Establishing, Low-Angle, Tracking, Overhead) তৈরি হবে।
              </p>
            </div>

            {/* Presets */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Or Pick a Curated Preset (Click to generate instantly)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PRESET_THEMES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTopic(preset.prompt);
                      handleGenerateDraft(preset.prompt);
                    }}
                    disabled={loading}
                    className="p-4 text-left rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 bg-gray-50 dark:bg-gray-750 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-all group"
                  >
                    <div className="font-bold text-sm text-gray-800 dark:text-gray-100 group-hover:text-purple-600 dark:group-hover:text-purple-300">
                      {preset.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {preset.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => handleGenerateDraft()}
                disabled={loading || !topic.trim()}
                className={`px-8 py-3.5 rounded-2xl text-white font-bold transition-all shadow-md ${
                  loading || !topic.trim()
                    ? 'bg-purple-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/25 active:scale-95'
                }`}
              >
                {loading ? 'Generating 4 Cohesive Shots...' : 'Generate 4 Cinematic Shots →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Review Shots & Upload Images */}
        {step === 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-6 md:p-8 border border-gray-100 dark:border-gray-700 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-4">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                  Step 2: Generate & Upload 4 Camera Angles
                </h2>
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Copy each prompt below into Midjourney or Imagen, download the 9:16 images, and upload them here.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-xl text-xs font-semibold">
                <span>🎵 Lofi Chill Music: Active</span>
              </div>
            </div>

            {locationDescription && (
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 text-xs md:text-sm text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
                <span className="text-base shrink-0">📍</span>
                <div>
                  <span className="font-bold">Shared Location: </span>
                  {locationDescription}
                </div>
              </div>
            )}

            {/* Shots Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scenes.map((scene, idx) => (
                <div 
                  key={idx} 
                  className="bg-gray-50 dark:bg-gray-750/70 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="bg-purple-600 text-white text-xs font-extrabold px-2 py-0.5 rounded-lg">
                          Shot {idx + 1}/4
                        </span>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                          {scene.camera_angle || `Angle ${idx + 1}`}
                        </span>
                      </div>
                      <span className="text-[11px] bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md font-mono">
                        🎬 {scene.camera_motion || 'zoom-in'}
                      </span>
                    </div>

                    <div className="relative bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300 font-mono leading-relaxed line-clamp-4 hover:line-clamp-none transition-all">
                      {scene.image_keyword}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(scene.image_keyword, idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        copiedIndex === idx
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-800/60'
                      }`}
                    >
                      {copiedIndex === idx ? '✓ Copied!' : '📋 Copy Prompt'}
                    </button>

                    <div className="flex items-center gap-3">
                      {scene.image_url ? (
                        <div className="relative w-11 h-16 shrink-0 rounded-lg overflow-hidden border-2 border-green-500 shadow-sm bg-black">
                          {scene.image_url.startsWith('data:video/') || scene.image_url.endsWith('.mp4') || scene.image_url.endsWith('.webm') ? (
                            <video src={scene.image_url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                          ) : (
                            <img src={scene.image_url} alt={`Shot ${idx + 1}`} className="w-full h-full object-cover" />
                          )}
                          <div className="absolute top-0 right-0 bg-green-500 text-white px-1 text-[9px] font-bold">
                            ✓
                          </div>
                        </div>
                      ) : (
                        <div className="w-11 h-16 shrink-0 rounded-lg bg-gray-200 dark:bg-gray-700 border border-dashed border-gray-400 dark:border-gray-600 flex items-center justify-center text-[9px] text-gray-500 font-mono text-center">
                          9:16
                        </div>
                      )}

                      <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors text-center shadow-sm">
                        {scene.image_url ? 'Change' : 'Upload Image/Video'}
                        <input 
                          type="file" 
                          accept="image/*,video/mp4,video/webm" 
                          className="hidden" 
                          onChange={(e) => handleFileUpload(idx, e)}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Advanced JSON toggle */}
            <details className="mt-4 pt-2 border-t border-gray-100 dark:border-gray-700">
              <summary className="cursor-pointer text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                ⚙️ Advanced Script JSON (Optional)
              </summary>
              <textarea
                value={draftJson}
                onChange={(e) => setDraftJson(e.target.value)}
                className="w-full mt-2 h-44 font-mono text-xs p-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none focus:ring-2 focus:ring-purple-500"
              />
            </details>

            {/* Actions */}
            <div className="flex justify-between items-center pt-4">
              <button 
                onClick={() => setStep(1)}
                className="px-6 py-3 bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 rounded-2xl font-medium transition-colors text-sm"
              >
                ← Back
              </button>
              <button
                onClick={handleQueueVideo}
                disabled={loading || !allImagesUploaded}
                className={`px-8 py-3.5 rounded-2xl text-white font-bold transition-all shadow-md text-sm ${
                  loading || !allImagesUploaded
                    ? 'bg-emerald-400/60 cursor-not-allowed opacity-75' 
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25 active:scale-95'
                }`}
              >
                {loading ? 'Queueing Video...' : allImagesUploaded ? 'Start Rendering Video →' : 'Upload All 4 Images to Render'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
