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
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showSubtitles, setShowSubtitles] = useState(true);

  // Poll for updates every 5 seconds
  useEffect(() => {
    fetchVideos();
    const interval = setInterval(fetchVideos, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchVideos = async () => {
    const { data, error } = await supabase
      .from('shorts_queue')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setVideos(data);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/generate-topic', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showSubtitles })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setMessage({ type: 'success', text: 'Video topic generated and queued!' });
        fetchVideos(); // Instantly update
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to generate.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Unexpected error.' });
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
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Shorts Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400">Control Panel for Video Generation</p>
          </div>
          <div className="flex flex-col md:flex-row gap-4 mt-6 md:mt-0 items-center">
            <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium cursor-pointer">
              <input 
                type="checkbox" 
                checked={showSubtitles} 
                onChange={(e) => setShowSubtitles(e.target.checked)} 
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
              />
              Show Subtitles
            </label>
            <Link href="/admin" className="px-6 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-all text-center">
              Admin View
            </Link>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className={`px-6 py-3 rounded-xl text-white font-semibold transition-all w-full md:w-auto ${
                loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md active:scale-95'
              }`}
            >
              {loading ? 'Generating...' : 'Generate New Topic'}
            </button>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        {/* Video List */}
        <div className="grid grid-cols-1 gap-6">
          {videos.map(video => (
            <VideoCard 
              key={video.id} 
              video={video} 
              onDelete={handleDelete} 
              onRewrite={handleRewrite} 
            />
          ))}
          {videos.length === 0 && (
            <div className="text-center p-12 text-gray-500 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
              No videos yet. Generate one above!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video, onDelete, onRewrite }: { video: VideoItem, onDelete: (id: string) => void, onRewrite: (id: string, duration: number) => void }) {
  const defaultDuration = video.data_json?.duration_seconds || 15;
  const [duration, setDuration] = useState(defaultDuration);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Needs_Approval': return 'bg-blue-100 text-blue-800';
      case 'Approved': case 'Published': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-md p-6 border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-6">
      <div className="flex-1 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 inline-block ${getStatusColor(video.status)}`}>
              {video.status}
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
          <div className="text-gray-500 text-sm font-medium">No video yet</div>
        )}
      </div>
    </div>
  );
}
