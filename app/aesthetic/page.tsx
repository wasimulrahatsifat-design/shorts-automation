'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AestheticPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  
  const [draftJson, setDraftJson] = useState('');
  const [requiredImages, setRequiredImages] = useState<{keyword: string, file: string | null}[]>([]);

  // Parse draftJson for unique image keywords
  useEffect(() => {
    if (!draftJson || step !== 2) return;
    try {
      const parsed = JSON.parse(draftJson);
      const keywords = new Set<string>();
      
      if (parsed.scenes) {
        parsed.scenes.forEach((s: any) => {
          if (s.image_keyword) keywords.add(s.image_keyword);
        });
      }

      setRequiredImages(prev => {
        return Array.from(keywords).map(kw => {
          const existing = prev.find(r => r.keyword === kw);
          return { keyword: kw, file: existing ? existing.file : null };
        });
      });
    } catch (e) {
      // invalid json, ignore
    }
  }, [draftJson, step]);

  const handleFileUpload = (keyword: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Url = reader.result as string;
      
      setRequiredImages(prev => prev.map(img => img.keyword === keyword ? { ...img, file: base64Url } : img));

      setDraftJson(prevJson => {
        try {
          const parsed = JSON.parse(prevJson);
          if (parsed.scenes) {
            parsed.scenes.forEach((s: any) => { 
              if (s.image_keyword === keyword) s.image_url = base64Url; 
            });
          }
          return JSON.stringify(parsed, null, 2);
        } catch(e) {
          return prevJson;
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateDraft = async () => {
    if (!topic.trim()) {
      setMessage({ type: 'error', text: 'Please enter a theme.' });
      return;
    }

    setLoading(true);
    setMessage({ type: 'info', text: 'Drafting aesthetic scenes...' });
    setRequiredImages([]);

    try {
      const response = await fetch('/api/draft-aesthetic', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        setDraftJson(JSON.stringify(data.data, null, 2));
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
    setMessage({ type: 'info', text: 'Queueing video...' });

    try {
      let parsedJson = JSON.parse(draftJson);
      
      let totalFrames = 0;
      if (parsedJson.scenes) {
        for (const s of parsedJson.scenes) {
          totalFrames += s.duration || 150;
        }
      }
      const durationSeconds = Math.round(totalFrames / 30);

      const response = await fetch('/api/queue-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data_json: parsedJson, 
          showSubtitles: false,
          duration: durationSeconds 
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setMessage({ type: 'success', text: 'Video queued successfully! Check the main dashboard for rendering progress.' });
        // Optionally redirect to dashboard or reset
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to queue video.' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Unexpected error queueing video.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Aesthetic Video Generator</h1>
            <p className="text-gray-500 dark:text-gray-400">Step {step} of 2</p>
          </div>
          <div className="flex gap-3">
            <Link 
              href="/game" 
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 hover:opacity-90 text-white font-bold transition-all text-center shadow-md shadow-red-500/20"
            >
              ⚔️ Arena Game
            </Link>
            <Link href="/" className="px-5 py-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-all text-center">
              Main Dashboard
            </Link>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl text-sm font-medium ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 
            message.type === 'error' ? 'bg-red-50 text-red-700' : 
            'bg-blue-50 text-blue-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Step 1: Input Theme */}
        {step === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Aesthetic Theme</label>
              <input 
                type="text" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
                placeholder="e.g., Cherry blossom forest, Liminal pool rooms..."
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white disabled:opacity-50"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleGenerateDraft}
                disabled={loading}
                className={`px-8 py-3 rounded-xl text-white font-bold transition-all ${
                  loading
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-lg active:scale-95'
                }`}
              >
                {loading ? 'Drafting...' : 'Generate Prompts →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Manual Image Uploads & JSON Edit */}
        {step === 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Step 2: Upload AI Images</h2>
            <p className="text-gray-500">
              Generate images using Midjourney or another tool based on the prompts below, then upload them.
            </p>

            {/* Manual Image Uploads */}
            {requiredImages.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800 space-y-4">
                <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100 mb-2">Generated Image Prompts</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {requiredImages.map((req, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col gap-3">
                      <span className="font-medium text-gray-800 dark:text-gray-200 text-sm italic">
                        "{req.keyword}"
                      </span>
                      
                      <div className="flex items-center gap-4 mt-2">
                        {req.file ? (
                          <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 border-green-500">
                            <img src={req.file} alt={req.keyword} className="w-full h-full object-cover" />
                            <div className="absolute top-0 right-0 bg-green-500 text-white p-0.5 text-xs">
                              ✓
                            </div>
                          </div>
                        ) : (
                          <div className="w-16 h-16 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 text-xs text-center p-1">
                            9:16 Image
                          </div>
                        )}
                        
                        <label className="cursor-pointer bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex-1 text-center">
                          {req.file ? 'Change Image' : 'Upload File'}
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleFileUpload(req.keyword, e)}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-500">Show Advanced JSON Script</summary>
              <textarea
                value={draftJson}
                onChange={(e) => setDraftJson(e.target.value)}
                className="w-full mt-2 h-[200px] font-mono text-xs px-4 py-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none focus:ring-2 focus:ring-blue-500"
              />
            </details>

            <div className="flex justify-between items-center pt-4">
              <button 
                onClick={() => setStep(1)}
                className="px-6 py-3 bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 rounded-xl font-medium transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleQueueVideo}
                disabled={loading || requiredImages.some(img => !img.file)}
                className={`px-8 py-3 rounded-xl text-white font-bold transition-all ${
                  loading || requiredImages.some(img => !img.file)
                    ? 'bg-green-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 shadow-lg active:scale-95'
                }`}
              >
                {loading ? 'Queueing...' : 'Start Rendering Video →'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
