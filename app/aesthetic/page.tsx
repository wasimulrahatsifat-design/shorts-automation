'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

type ProcessState = 'idle' | 'drafting' | 'generating_images' | 'queueing' | 'done' | 'error';

export default function AestheticPage() {
  const [processState, setProcessState] = useState<ProcessState>('idle');
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  
  const [requiredImages, setRequiredImages] = useState<{keyword: string, file: string | null, status: 'pending' | 'generating' | 'done' | 'error'}[]>([]);

  const handleStartProcess = async () => {
    if (!topic.trim()) {
      setMessage({ type: 'error', text: 'Please enter a theme.' });
      return;
    }

    setProcessState('drafting');
    setMessage({ type: 'info', text: 'Drafting aesthetic scenes...' });
    setRequiredImages([]);

    let draftJsonStr = '';

    // Step 1: Draft the scenes
    try {
      const response = await fetch('/api/draft-aesthetic', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        draftJsonStr = JSON.stringify(data.data, null, 2);
      } else {
        throw new Error(data.error || 'Failed to generate draft.');
      }
    } catch (error: any) {
      setProcessState('error');
      setMessage({ type: 'error', text: error.message || 'Unexpected error generating draft.' });
      return;
    }

    // Parse the draft to get image keywords
    let currentJson;
    try {
      currentJson = JSON.parse(draftJsonStr);
      const keywords = new Set<string>();
      
      if (currentJson.scenes) {
        currentJson.scenes.forEach((s: any) => {
          if (s.image_keyword) keywords.add(s.image_keyword);
        });
      }

      setRequiredImages(Array.from(keywords).map(kw => ({
        keyword: kw, 
        file: null,
        status: 'pending'
      })));
    } catch (e) {
      setProcessState('error');
      setMessage({ type: 'error', text: 'Invalid JSON format from AI.' });
      return;
    }

    // Step 2: Generate Images
    setProcessState('generating_images');
    setMessage({ type: 'info', text: 'Generating AI images for scenes...' });

    let allImagesSuccess = true;

    for (let i = 0; i < currentJson.scenes.length; i++) {
      const scene = currentJson.scenes[i];
      if (!scene.image_keyword) continue;

      setRequiredImages(prev => prev.map(img => 
        img.keyword === scene.image_keyword ? { ...img, status: 'generating' } : img
      ));

      try {
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: scene.image_keyword })
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
          scene.image_url = data.url; // Update JSON with the image URL
          
          setRequiredImages(prev => prev.map(img => 
            img.keyword === scene.image_keyword ? { ...img, status: 'done', file: data.url } : img
          ));
        } else {
          allImagesSuccess = false;
          setRequiredImages(prev => prev.map(img => 
            img.keyword === scene.image_keyword ? { ...img, status: 'error' } : img
          ));
          break; // Stop on first error
        }
      } catch (err) {
        allImagesSuccess = false;
        setRequiredImages(prev => prev.map(img => 
          img.keyword === scene.image_keyword ? { ...img, status: 'error' } : img
        ));
        break; // Stop on first error
      }
    }

    if (!allImagesSuccess) {
      setProcessState('error');
      setMessage({ type: 'error', text: 'Failed to generate some images. Process stopped.' });
      return;
    }

    // Step 3: Queue Video
    setProcessState('queueing');
    setMessage({ type: 'info', text: 'Images ready. Queueing video...' });

    try {
      let totalFrames = 0;
      if (currentJson.scenes) {
        for (const s of currentJson.scenes) {
          totalFrames += s.duration || 150;
        }
      }
      const durationSeconds = Math.round(totalFrames / 30);

      const response = await fetch('/api/queue-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data_json: currentJson, 
          showSubtitles: false,
          duration: durationSeconds 
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setProcessState('done');
        setMessage({ type: 'success', text: 'Video queued successfully! Check the main dashboard for rendering progress.' });
      } else {
        throw new Error(data.error || 'Failed to queue video.');
      }
    } catch (error: any) {
      setProcessState('error');
      setMessage({ type: 'error', text: error.message || 'Unexpected error queueing video.' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Aesthetic Video Generator</h1>
            <p className="text-gray-500 dark:text-gray-400">Automated 3-Step Process</p>
          </div>
          <div className="flex gap-4">
            <Link href="/" className="px-6 py-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-all text-center">
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

        {/* Input & Action */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Aesthetic Theme</label>
            <input 
              type="text" 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={processState !== 'idle' && processState !== 'error' && processState !== 'done'}
              placeholder="e.g., Cherry blossom forest, Liminal pool rooms..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white disabled:opacity-50"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleStartProcess}
              disabled={processState !== 'idle' && processState !== 'error' && processState !== 'done'}
              className={`px-8 py-3 rounded-xl text-white font-bold transition-all ${
                processState !== 'idle' && processState !== 'error' && processState !== 'done'
                  ? 'bg-blue-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-lg active:scale-95'
              }`}
            >
              {processState === 'idle' || processState === 'error' || processState === 'done' 
                ? 'Generate Video Automatically' 
                : 'Processing...'}
            </button>
          </div>
        </div>

        {/* Live Progress / Thumbnails */}
        {(requiredImages.length > 0 || processState !== 'idle') && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 space-y-6">
            <h3 className="font-bold text-xl text-gray-900 dark:text-white">Process Progress</h3>
            
            <div className="flex gap-4 mb-6 text-sm">
              <span className={`px-3 py-1 rounded-full font-medium ${processState === 'drafting' ? 'bg-blue-100 text-blue-700' : (processState === 'idle' ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700')}`}>
                1. Drafting Scenes
              </span>
              <span className={`px-3 py-1 rounded-full font-medium ${processState === 'generating_images' ? 'bg-blue-100 text-blue-700 animate-pulse' : (processState === 'queueing' || processState === 'done' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}`}>
                2. Generating Images
              </span>
              <span className={`px-3 py-1 rounded-full font-medium ${processState === 'queueing' ? 'bg-blue-100 text-blue-700 animate-pulse' : (processState === 'done' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}`}>
                3. Queueing Video
              </span>
            </div>

            {requiredImages.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2">Image Generation Status</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {requiredImages.map((req, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col items-center text-center gap-3">
                      <span className="font-bold text-gray-800 dark:text-gray-200 text-xs line-clamp-2" title={req.keyword}>
                        {req.keyword}
                      </span>
                      
                      {req.file ? (
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-green-500">
                          <img src={req.file} alt="Generated" className="w-full h-full object-cover" />
                          <div className="absolute top-0 right-0 bg-green-500 text-white rounded-bl-lg p-1 text-xs">
                            ✓
                          </div>
                        </div>
                      ) : (
                        <div className={`w-24 h-24 rounded-lg border-2 flex flex-col items-center justify-center text-xs font-medium ${
                          req.status === 'generating' ? 'border-purple-400 bg-purple-50 text-purple-600 animate-pulse' :
                          req.status === 'error' ? 'border-red-400 bg-red-50 text-red-600' :
                          'border-dashed border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-400'
                        }`}>
                          {req.status === 'generating' ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-600 mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Generating...
                            </>
                          ) : req.status === 'error' ? 'Error' : 'Pending'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
