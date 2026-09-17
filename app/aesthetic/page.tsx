'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AestheticPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Step 1 State
  const [topic, setTopic] = useState('');

  // Step 2 State
  const [draftJson, setDraftJson] = useState('');
  const [requiredImages, setRequiredImages] = useState<{keyword: string, file: string | null, status: 'pending' | 'generating' | 'done' | 'error'}[]>([]);
  const [generatingImages, setGeneratingImages] = useState(false);

  // Parse draftJson for unique image keywords
  useEffect(() => {
    if (!draftJson || step !== 2 || generatingImages) return;
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
          return { 
            keyword: kw, 
            file: existing?.file || null,
            status: existing?.status || 'pending'
          };
        });
      });
    } catch (e) {
      // invalid json, ignore
    }
  }, [draftJson, step, generatingImages]);

  const handleGenerateDraft = async () => {
    if (!topic.trim()) {
      setMessage({ type: 'error', text: 'Please enter a theme.' });
      return;
    }
    setLoading(true);
    setMessage(null);
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
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to generate draft.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Unexpected error generating draft.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImages = async () => {
    setGeneratingImages(true);
    setMessage(null);

    let currentJson;
    try {
      currentJson = JSON.parse(draftJson);
    } catch (e) {
      setMessage({ type: 'error', text: 'Invalid JSON format.' });
      setGeneratingImages(false);
      return;
    }

    const updatedImages = [...requiredImages];
    let allSuccess = true;

    for (let i = 0; i < updatedImages.length; i++) {
      if (updatedImages[i].status === 'done') continue; // Skip already generated

      updatedImages[i].status = 'generating';
      setRequiredImages([...updatedImages]);

      try {
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: updatedImages[i].keyword })
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
          updatedImages[i].file = data.url;
          updatedImages[i].status = 'done';
          
          // Update JSON immediately
          if (currentJson.scenes) {
            currentJson.scenes.forEach((s: any) => {
              if (s.image_keyword === updatedImages[i].keyword) {
                s.image_url = data.url;
              }
            });
          }
          setDraftJson(JSON.stringify(currentJson, null, 2));
        } else {
          updatedImages[i].status = 'error';
          allSuccess = false;
        }
      } catch (err) {
        updatedImages[i].status = 'error';
        allSuccess = false;
      }
      setRequiredImages([...updatedImages]);
    }

    setGeneratingImages(false);
    if (!allSuccess) {
      setMessage({ type: 'error', text: 'Some images failed to generate. You can click Generate Images again to retry them.' });
    } else {
      setMessage({ type: 'success', text: 'All images generated successfully! You can now queue the video.' });
    }
  };

  const handleQueueVideo = async () => {
    setLoading(true);
    setMessage(null);
    try {
      let parsedJson;
      try {
        parsedJson = JSON.parse(draftJson);
      } catch (e) {
        throw new Error('Invalid JSON format. Please check your syntax.');
      }

      // Check if all images are generated
      const missingImages = requiredImages.some(img => !img.file);
      if (missingImages) {
        throw new Error('Please generate all images before queueing the video.');
      }

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
          <div className="flex gap-4">
            <Link href="/" className="px-6 py-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-all text-center">
              Main Dashboard
            </Link>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        {/* --- STEP 1: Settings & Topic Input --- */}
        {step === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Step 1: Setup Theme</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Aesthetic Theme</label>
              <input 
                type="text" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Cherry blossom forest, Liminal pool rooms..."
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={handleGenerateDraft}
                disabled={loading}
                className={`px-8 py-3 rounded-xl text-white font-bold transition-all ${
                  loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg active:scale-95'
                }`}
              >
                {loading ? 'Generating Scenes...' : 'Next: Review Scenes →'}
              </button>
            </div>
          </div>
        )}

        {/* --- STEP 2: Script Generation & Editing --- */}
        {step === 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Step 2: Review & Generate Images</h2>
            <p className="text-gray-500">Review the generated prompts, then generate the images using Gemini Imagen 3.</p>
            
            <textarea
              value={draftJson}
              onChange={(e) => setDraftJson(e.target.value)}
              disabled={generatingImages}
              className={`w-full h-[300px] font-mono text-sm px-4 py-4 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-200 resize-none focus:ring-2 focus:ring-blue-500 ${generatingImages ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70' : 'bg-gray-50 dark:bg-gray-900'}`}
            />

            {requiredImages.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100">AI Images</h3>
                  <button
                    onClick={handleGenerateImages}
                    disabled={generatingImages || requiredImages.every(img => img.status === 'done')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold text-white transition-all ${
                      generatingImages || requiredImages.every(img => img.status === 'done') ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 shadow'
                    }`}
                  >
                    {generatingImages ? 'Generating...' : 'Generate Images'}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {requiredImages.map((req, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col items-center text-center gap-3">
                      <span className="font-bold text-gray-800 dark:text-gray-200 text-sm line-clamp-2">
                        {req.keyword}
                      </span>
                      
                      {req.file ? (
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-green-500">
                          <img src={req.file} alt={req.keyword} className="w-full h-full object-cover" />
                          <div className="absolute top-0 right-0 bg-green-500 text-white rounded-bl-lg p-1 text-xs">
                            ✓
                          </div>
                        </div>
                      ) : (
                        <div className={`w-24 h-24 rounded-lg border-2 flex items-center justify-center text-xs font-medium ${
                          req.status === 'generating' ? 'border-purple-400 bg-purple-50 text-purple-600 animate-pulse' :
                          req.status === 'error' ? 'border-red-400 bg-red-50 text-red-600' :
                          'border-dashed border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-400'
                        }`}>
                          {req.status === 'generating' ? 'Generating...' : req.status === 'error' ? 'Error' : 'Pending'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-4">
              <button 
                onClick={() => setStep(1)}
                disabled={generatingImages}
                className={`px-6 py-3 rounded-xl font-medium transition-colors ${
                  generatingImages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
                }`}
              >
                ← Back
              </button>
              <button
                onClick={handleQueueVideo}
                disabled={loading || generatingImages || requiredImages.some(img => img.status !== 'done')}
                className={`px-8 py-3 rounded-xl text-white font-bold transition-all ${
                  loading || generatingImages || requiredImages.some(img => img.status !== 'done') 
                    ? 'bg-green-400 cursor-not-allowed opacity-70' 
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
