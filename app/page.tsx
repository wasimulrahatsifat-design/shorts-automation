'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type VideoItem = {
  id: string;
  topic: string;
  status: string;
  video_url: string | null;
  data_json: any;
  created_at: string;
};

export default function Home() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Step 1 State
  const [topic, setTopic] = useState('');
  const [videoFormat, setVideoFormat] = useState('Data Comparison');
  const [duration, setDuration] = useState(15);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [filterFormat, setFilterFormat] = useState('All');

  // Step 2 State
  const [draftJson, setDraftJson] = useState('');
  const [magicInstruction, setMagicInstruction] = useState('');
  const [requiredImages, setRequiredImages] = useState<{keyword: string, file: string | null}[]>([]);

  // Parse draftJson for unique image keywords
  useEffect(() => {
    if (!draftJson || step !== 2) return;
    try {
      const parsed = JSON.parse(draftJson);
      const keywords = new Set<string>();
      
      const addKeyword = (kw: string) => { if (kw) keywords.add(kw); }

      if (parsed.questions) parsed.questions.forEach((q: any) => addKeyword(q.image_keyword));
      if (parsed.items) parsed.items.forEach((item: any) => addKeyword(item.image_keyword));
      if (parsed.contestants) parsed.contestants.forEach((c: any) => addKeyword(c.image_keyword));
      if (parsed.scenarios) {
        parsed.scenarios.forEach((s: any) => {
          addKeyword(s.image_keyword_a);
          addKeyword(s.image_keyword_b);
        });
      }

      setRequiredImages(prev => {
        return Array.from(keywords).map(kw => {
          const existing = prev.find(r => r.keyword === kw);
          return { keyword: kw, file: existing?.file || null };
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

      try {
        const parsed = JSON.parse(draftJson);
        
        if (parsed.questions) {
          parsed.questions.forEach((q: any) => { if (q.image_keyword === keyword) q.image_url = base64Url; });
        }
        if (parsed.items) {
          parsed.items.forEach((item: any) => { if (item.image_keyword === keyword) item.image_url = base64Url; });
        }
        if (parsed.contestants) {
          parsed.contestants.forEach((c: any) => { if (c.image_keyword === keyword) c.image_url = base64Url; });
        }
        if (parsed.scenarios) {
          parsed.scenarios.forEach((s: any) => {
            if (s.image_keyword_a === keyword) s.image_url_a = base64Url;
            if (s.image_keyword_b === keyword) s.image_url_b = base64Url;
          });
        }

        setDraftJson(JSON.stringify(parsed, null, 2));
      } catch(e) {}
    };
    reader.readAsDataURL(file);
  };

  // Poll for updates every 5 seconds on Step 3
  useEffect(() => {
    if (step === 3) {
      fetchVideos();
      const interval = setInterval(fetchVideos, 5000);
      return () => clearInterval(interval);
    }
  }, [step]);

  useEffect(() => {
    if (videoFormat === 'Quiz') {
      setDuration(80); // 16 seconds per question * 5 questions = 80s
    }
  }, [videoFormat]);

  const fetchVideos = async () => {
    const { data, error } = await supabase
      .from('shorts_queue')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setVideos(data);
    }
  };

  const handleSuggestTopic = () => {
    const suggestions = [
      "Growth of Tech Companies over 10 years",
      "Most spoken languages over time",
      "Would you rather: Time travel vs Teleportation",
      "Trivia: World Capitals",
      "Population growth of megacities"
    ];
    setTopic(suggestions[Math.floor(Math.random() * suggestions.length)]);
  };

  const handleGenerateDraft = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/draft-script', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, videoFormat })
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

      const response = await fetch('/api/queue-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data_json: parsedJson, 
          showSubtitles, 
          duration 
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setMessage({ type: 'success', text: 'Video queued successfully and rendering started!' });
        setStep(3); // Move to rendering and live progress step
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to queue video.' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Unexpected error queueing video.' });
    } finally {
      setLoading(false);
    }
  };

  const handleMagicEdit = async () => {
    if (!magicInstruction.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/edit-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentScript: draftJson, userInstruction: magicInstruction })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setDraftJson(data.newScript);
        setMagicInstruction('');
        setMessage({ type: 'success', text: 'Script edited magically!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to edit script.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Unexpected error editing script.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this video and its files?')) return;
    try {
      await fetch(`/api/videos/${id}/delete`, { method: 'DELETE' });
      fetchVideos();
    } catch (error) {
      alert('Failed to delete video.');
    }
  };

  const handleRewrite = async (id: string, targetDuration: number) => {
    if (!confirm(`Rewrite script for ${targetDuration} seconds? This will regenerate audio and trigger a new render.`)) return;
    setMessage(null);
    try {
      const response = await fetch('/api/rewrite-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: id, targetDuration })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setMessage({ type: 'success', text: 'Script rewritten and queued for rendering!' });
        fetchVideos();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to rewrite.' });
      }
    } catch (error) {
      alert('Error rewriting script.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Shorts Automation</h1>
            <p className="text-gray-500 dark:text-gray-400">Step {step} of 3</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link 
              href="/game" 
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 hover:opacity-90 text-white font-bold transition-all text-center shadow-md shadow-red-500/20"
            >
              ⚔️ Arena Game
            </Link>
            <Link 
              href="/aesthetic" 
              className="px-5 py-3 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-medium hover:bg-purple-200 dark:hover:bg-purple-800/60 transition-all text-center border border-purple-300 dark:border-purple-700"
            >
              🌸 Aesthetic
            </Link>
            <button 
              onClick={() => { setStep(3); fetchVideos(); }}
              className="px-5 py-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-all text-center"
            >
              Dashboard
            </button>
            <Link href="/admin" className="px-5 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-all text-center">
              Admin View
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Step 1: Setup & Topic</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Video Format</label>
                <select
                  value={videoFormat}
                  onChange={(e) => setVideoFormat(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                >
                  <option value="Data Comparison">Data Comparison</option>
                  <option value="Would You Rather">Would You Rather</option>
                  <option value="Quiz">Quiz</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Duration (Seconds)</label>
                <input 
                  type="number" 
                  value={duration} 
                  onChange={(e) => setDuration(parseInt(e.target.value) || 15)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Topic (Optional)</label>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter a specific topic or leave blank for AI magic..."
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
                <button 
                  onClick={handleSuggestTopic}
                  className="px-6 py-3 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-xl font-medium transition-colors"
                >
                  Suggest Topic
                </button>
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center">
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showSubtitles} 
                  onChange={(e) => setShowSubtitles(e.target.checked)} 
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
                Enable Subtitles
              </label>

              <button
                onClick={handleGenerateDraft}
                disabled={loading}
                className={`px-8 py-3 rounded-xl text-white font-bold transition-all ${
                  loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg active:scale-95'
                }`}
              >
                {loading ? 'Generating Draft...' : 'Next: Generate Script →'}
              </button>
            </div>
          </div>
        )}

        {/* --- STEP 2: Script Generation & Editing --- */}
        {step === 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Step 2: Review & Edit Script</h2>
            <p className="text-gray-500">You can manually tweak the script, labels, or data values before rendering the final video.</p>
            
            <textarea
              value={draftJson}
              onChange={(e) => setDraftJson(e.target.value)}
              className="w-full h-[300px] font-mono text-sm px-4 py-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Manual Image Uploads */}
            {requiredImages.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800 space-y-4">
                <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100 mb-2">Required Images</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                  Please upload an image for each keyword below. You only need to upload it once, and it will be applied automatically everywhere!
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {requiredImages.map((req, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col items-center text-center gap-3">
                      <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">
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
                        <div className="w-24 h-24 rounded-lg bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400">
                          No Image
                        </div>
                      )}
                      
                      <label className="cursor-pointer bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-semibold px-4 py-2 rounded-lg transition-colors w-full">
                        {req.file ? 'Change Image' : 'Upload Image'}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleFileUpload(req.keyword, e)}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 space-y-4">
              <label className="block text-sm font-bold text-indigo-900 dark:text-indigo-200">
                ✨ AI Copilot
              </label>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={magicInstruction}
                  onChange={(e) => setMagicInstruction(e.target.value)}
                  placeholder="Tell AI to change something (e.g., 'Make values higher', 'Add one more item')..."
                  className="flex-1 px-4 py-3 border border-indigo-200 dark:border-indigo-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                />
                <button 
                  onClick={handleMagicEdit}
                  disabled={loading || !magicInstruction.trim()}
                  className={`px-6 py-3 rounded-xl text-white font-bold transition-all whitespace-nowrap ${
                    loading || !magicInstruction.trim() ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md active:scale-95'
                  }`}
                >
                  {loading ? 'Thinking...' : 'Rewrite'}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4">
              <button 
                onClick={() => setStep(1)}
                className="px-6 py-3 bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 rounded-xl font-medium transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleQueueVideo}
                disabled={loading}
                className={`px-8 py-3 rounded-xl text-white font-bold transition-all ${
                  loading ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-lg active:scale-95'
                }`}
              >
                {loading ? 'Queueing...' : 'Start Rendering Video →'}
              </button>
            </div>
          </div>
        )}

        {/* --- STEP 3: Render & Live Progress --- */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Videos Dashboard</h2>
              <div className="flex gap-4 w-full md:w-auto">
                <select
                  value={filterFormat}
                  onChange={(e) => setFilterFormat(e.target.value)}
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
                >
                  <option value="All">All Categories</option>
                  <option value="Data Comparison">Data Comparison</option>
                  <option value="Would You Rather">Would You Rather</option>
                  <option value="Quiz">Quiz</option>
                  <option value="Arena Clash">Arena Clash</option>
                </select>
                <button 
                  onClick={() => { setStep(1); setTopic(''); }}
                  className="px-6 py-3 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-xl font-medium transition-colors whitespace-nowrap"
                >
                  + Create Video
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {videos.filter(v => filterFormat === 'All' || v.data_json?.format === filterFormat).map(video => (
                <VideoCard 
                  key={video.id} 
                  video={video} 
                  onDelete={handleDelete} 
                  onRewrite={handleRewrite} 
                />
              ))}
              {videos.filter(v => filterFormat === 'All' || v.data_json?.format === filterFormat).length === 0 && (
                <div className="text-center p-12 text-gray-500 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
                  No videos found for this category.
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function VideoCard({ video, onDelete, onRewrite }: { video: VideoItem, onDelete: (id: string) => void, onRewrite: (id: string, duration: number) => void }) {
  const defaultDuration = video.data_json?.duration_seconds || 15;
  const [duration, setDuration] = useState(defaultDuration);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800 animate-pulse';
      case 'Rendering': return 'bg-blue-100 text-blue-800 animate-pulse';
      case 'Needs_Approval': return 'bg-purple-100 text-purple-800';
      case 'Approved': case 'Published': case 'Completed': return 'bg-green-100 text-green-800';
      case 'Failed': case 'Rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-md p-6 border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-6">
      <div className="flex-1 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 inline-block shadow-sm ${getStatusColor(video.status)}`}>
              {video.status === 'Pending' ? 'Rendering / Pending' : video.status}
            </span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{video.topic || 'Untitled'}</h3>
          </div>
          <button onClick={() => onDelete(video.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl text-sm text-gray-700 dark:text-gray-300">
          <span className="font-semibold block mb-1">Script ({defaultDuration}s):</span>
          {video.data_json?.script || 'No script generated.'}
        </div>

        <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="flex-1">
            <label className="text-xs text-gray-500 font-medium block mb-1">Target Duration: {duration}s</label>
            <input 
              type="range" min="15" max="180" step="5"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
          <button 
            onClick={() => onRewrite(video.id, duration)}
            className="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold rounded-lg text-sm transition-colors"
          >
            Rewrite
          </button>
        </div>
      </div>
      
      {/* Video Preview */}
      <div className="w-full md:w-48 shrink-0 flex items-center justify-center bg-black rounded-xl overflow-hidden aspect-[9/16]">
        {video.video_url ? (
          <video src={video.video_url} controls className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-500 text-sm font-medium flex flex-col items-center">
            {video.status === 'Pending' ? (
              <>
                <svg className="animate-spin h-6 w-6 text-white mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Processing...
              </>
            ) : 'No video yet'}
          </div>
        )}
      </div>
    </div>
  );
}
