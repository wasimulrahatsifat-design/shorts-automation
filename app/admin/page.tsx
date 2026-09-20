'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ScheduleModal } from '@/components/ScheduleModal';

interface VideoItem {
  id: string;
  topic: string;
  video_url: string;
  status: string;
  created_at: string;
  scheduled_time?: string | null;
  data_json?: {
    youtube_status?: string;
    meta_status?: string;
    youtube_id?: string;
    facebook_id?: string;
    instagram_id?: string;
    format?: string;
    description?: string;
    youtube_scheduled_time?: string;
    meta_scheduled_time?: string;
    youtube_uploading_at?: string;
    meta_uploading_at?: string;
  };
}

export function AdminDashboardContent({ initialPlatform }: { initialPlatform?: 'youtube' | 'meta' }) {
  const searchParams = useSearchParams();
  const queryPlatform = searchParams?.get('tab') as 'youtube' | 'meta' | null;

  const [activePlatform, setActivePlatform] = useState<'youtube' | 'meta'>(
    initialPlatform || queryPlatform || 'youtube'
  );
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [counts, setCounts] = useState<{ youtube: number; meta: number }>({ youtube: 0, meta: 0 });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    const target = queryPlatform || initialPlatform;
    if (target && (target === 'youtube' || target === 'meta')) {
      setActivePlatform(target);
    }
  }, [queryPlatform, initialPlatform]);

  useEffect(() => {
    fetchVideos(activePlatform);
  }, [activePlatform]);

  const isCheckingDueRef = useRef(false);
  const activePlatformRef = useRef(activePlatform);

  useEffect(() => {
    activePlatformRef.current = activePlatform;
  }, [activePlatform]);

  useEffect(() => {
    const checkDueScheduler = async () => {
      if (isCheckingDueRef.current) return;
      isCheckingDueRef.current = true;
      try {
        const res = await fetch('/api/videos/publish-due', { method: 'POST' });
        const data = await res.json();
        if (data.triggered > 0) {
          fetchVideos(activePlatformRef.current);
        }
      } catch (e) {
        // silent
      } finally {
        isCheckingDueRef.current = false;
      }
    };
    checkDueScheduler();
    const interval = setInterval(checkDueScheduler, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchVideos = async (platform: 'youtube' | 'meta') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/needs-approval?platform=${platform}`);
      const data = await res.json();
      if (data.success) {
        setVideos(data.data);
        if (data.counts) {
          setCounts(data.counts);
        }
      }
    } catch (error) {
      console.error('Failed to fetch videos', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this video? This will remove it permanently.')) return;
    
    // Instant optimistic UI update
    setVideos((prev) => prev.filter((v) => v.id !== id));
    
    try {
      const res = await fetch(`/api/videos/${id}/delete`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete');
      }
      setActionMessage({ type: 'success', text: 'Video deleted successfully.' });
      fetchVideos(activePlatform);
    } catch (error) {
      console.error('Failed to delete video', error);
      alert('Failed to delete video.');
      fetchVideos(activePlatform);
    }
  };

  // Direct 1-Click Publish Now
  const handlePublishNow = async (id: string, platform: 'youtube' | 'meta') => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));

    try {
      const res = await fetch(`/api/videos/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          platform,
          publish_now: true 
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({
          type: 'success',
          text: platform === 'youtube'
            ? 'Approved! Uploading as Private to YouTube in background...'
            : 'Approved! Publishing live to Facebook Page & Instagram Reels in background...'
        });
        // Optimistic UI removal from current tab after successful approval
        setVideos((prev) => prev.filter((v) => v.id !== id));
        if (platform === 'youtube') {
          setCounts((c) => ({ ...c, youtube: Math.max(0, c.youtube - 1) }));
        } else {
          setCounts((c) => ({ ...c, meta: Math.max(0, c.meta - 1) }));
        }
      } else {
        throw new Error(data.error || 'Failed to approve');
      }
    } catch (error: any) {
      console.error('Failed to approve video', error);
      setActionMessage({ type: 'error', text: error.message || 'Failed to trigger approval.' });
      fetchVideos(activePlatform);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  // Schedule Modal triggers
  const handleOpenScheduleModal = (id: string) => {
    setSelectedVideoId(id);
    setIsModalOpen(true);
  };

  const handleScheduleSubmit = async (scheduledTime: string) => {
    if (!selectedVideoId) return;
    const id = selectedVideoId;
    const platform = activePlatform;

    setIsModalOpen(false);
    setSelectedVideoId(null);
    setActionLoading((prev) => ({ ...prev, [id]: true }));

    try {
      const res = await fetch(`/api/videos/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          platform, 
          scheduled_time: scheduledTime,
          publish_now: false 
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({
          type: 'success',
          text: `Successfully scheduled for ${new Date(scheduledTime).toLocaleString()} on ${platform === 'youtube' ? 'YouTube' : 'Facebook & Instagram'}!`
        });
        // Update local video state with scheduled timestamp
        setVideos((prev) => prev.map((v) => {
          if (v.id !== id) return v;
          const updatedJson = { ...v.data_json };
          if (platform === 'youtube') {
            updatedJson.youtube_status = 'Scheduled';
            updatedJson.youtube_scheduled_time = scheduledTime;
          } else {
            updatedJson.meta_status = 'Scheduled';
            updatedJson.meta_scheduled_time = scheduledTime;
          }
          return { ...v, status: 'Scheduled', scheduled_time: scheduledTime, data_json: updatedJson };
        }));
      } else {
        throw new Error(data.error || 'Failed to schedule');
      }
    } catch (error: any) {
      console.error('Failed to schedule video', error);
      setActionMessage({ type: 'error', text: error.message || 'Failed to schedule video.' });
      fetchVideos(activePlatform);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const isYouTube = activePlatform === 'youtube';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Link 
                href="/" 
                className="text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white flex items-center gap-1 transition"
              >
                ← Back to Creator Studio
              </Link>
            </div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight sm:text-4xl mt-1">
              Content Approval & Publishing
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link 
              href="/"
              className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold shadow-sm transition"
            >
              + Create Video
            </Link>
          </div>
        </div>

        {/* Action Message Banner */}
        {actionMessage && (
          <div className={`p-4 rounded-2xl text-sm font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
            actionMessage.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800' 
              : 'bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
          }`}>
            <span>{actionMessage.text}</span>
            <button 
              onClick={() => setActionMessage(null)}
              className="text-xs font-bold opacity-60 hover:opacity-100 ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Platform Approval Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-2 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="grid grid-cols-2 gap-2 flex-1">
            
            {/* Tab 1: YouTube Shorts */}
            <button
              type="button"
              onClick={() => setActivePlatform('youtube')}
              className={`flex items-center justify-center gap-2.5 py-3 px-5 rounded-xl font-bold text-sm transition-all ${
                isYouTube
                  ? 'bg-red-600 text-white shadow-md shadow-red-500/20 ring-2 ring-red-600'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60'
              }`}
            >
              <span className="text-base">🔴</span>
              <span>YouTube Shorts</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                isYouTube ? 'bg-red-800 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
                {counts.youtube}
              </span>
            </button>

            {/* Tab 2: Facebook & Instagram */}
            <button
              type="button"
              onClick={() => setActivePlatform('meta')}
              className={`flex items-center justify-center gap-2.5 py-3 px-5 rounded-xl font-bold text-sm transition-all ${
                !isYouTube
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-600'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60'
              }`}
            >
              <span className="text-base">🔵</span>
              <span>Facebook & Instagram</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                !isYouTube ? 'bg-blue-800 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
                {counts.meta}
              </span>
            </button>

          </div>
        </div>

        {/* Descriptive Banner per Platform */}
        {isYouTube ? (
          <div className="bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-2xl p-4 text-xs text-red-900 dark:text-red-300 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛡️</span>
              <div>
                <p className="font-bold text-sm">YouTube Private Approval Workflow</p>
                <p className="opacity-90">Videos approved here are uploaded to your YouTube channel as <strong>Private</strong>. You can review them in YouTube Studio and schedule them for public release whenever you wish.</p>
              </div>
            </div>
            <span className="bg-red-200 dark:bg-red-900/80 text-red-800 dark:text-red-200 text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
              YouTube Mode
            </span>
          </div>
        ) : (
          <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-4 text-xs text-blue-900 dark:text-blue-300 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="font-bold text-sm">Meta Direct Public Publishing</p>
                <p className="opacity-90">Videos approved here are published <strong>directly and publicly</strong> to your Facebook Page and Instagram Reels (instant live broadcast).</p>
              </div>
            </div>
            <span className="bg-blue-200 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200 text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
              Facebook & Instagram Mode
            </span>
          </div>
        )}

        {/* Video Grid or Empty State */}
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 gap-3">
            <div className={`animate-spin rounded-full h-10 w-10 border-b-2 ${isYouTube ? 'border-red-600' : 'border-blue-600'}`}></div>
            <span className="text-xs text-gray-500 font-medium">Loading {isYouTube ? 'YouTube' : 'Facebook & Instagram'} queue...</span>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
            <div className="text-4xl">{isYouTube ? '🎉' : '✨'}</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              All Caught Up for {isYouTube ? 'YouTube' : 'Facebook & Instagram'}!
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              There are no videos pending approval for {isYouTube ? 'YouTube' : 'Facebook & Instagram'}. You can switch tabs above or generate a new video.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActivePlatform(isYouTube ? 'meta' : 'youtube')}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition ${
                  isYouTube ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Switch to {isYouTube ? 'Facebook & Instagram Queue →' : 'YouTube Queue →'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {videos.map((video) => {
              const ytStatus = video.data_json?.youtube_status;
              const metaStatus = video.data_json?.meta_status;
              const ytDone = ytStatus === 'Published';
              const metaDone = metaStatus === 'Published';
              const ytScheduled = ytStatus === 'Scheduled';
              const metaScheduled = metaStatus === 'Scheduled';
              const ytUploading = ytStatus === 'Uploading' && (
                !video.data_json?.youtube_uploading_at ||
                (Date.now() - new Date(video.data_json.youtube_uploading_at).getTime() < 3 * 60 * 1000)
              );
              const metaUploading = metaStatus === 'Uploading' && (
                !video.data_json?.meta_uploading_at ||
                (Date.now() - new Date(video.data_json.meta_uploading_at).getTime() < 3 * 60 * 1000)
              );
              const ytScheduledTime = video.data_json?.youtube_scheduled_time || video.scheduled_time;
              const metaScheduledTime = video.data_json?.meta_scheduled_time || video.scheduled_time;
              const isBusy = !!actionLoading[video.id];

              return (
                <div 
                  key={video.id} 
                  className="bg-white dark:bg-gray-800 rounded-3xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col justify-between transition-all hover:shadow-xl"
                >
                  <div>
                    {/* Video Player */}
                    <div className="relative aspect-[9/16] bg-black">
                      <video
                        src={video.video_url}
                        controls
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Metadata & Status */}
                    <div className="p-5 space-y-4">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight">
                          {video.topic}
                        </h3>
                        {video.data_json?.description && (
                          <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1">
                              Description / Caption:
                            </span>
                            <p className="line-clamp-3 whitespace-pre-line leading-relaxed">
                              {video.data_json.description}
                            </p>
                          </div>
                        )}
                        <p className="text-[11px] text-gray-400 mt-1.5">
                          Created {new Date(video.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Status Badges */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {/* YouTube Status Badge */}
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                          ytDone 
                            ? 'bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                            : ytUploading
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 animate-pulse'
                            : ytScheduled
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                        }`}>
                          <span>🔴 YouTube:</span>
                          <span>
                            {ytDone 
                              ? '✓ Uploaded' 
                              : ytUploading
                              ? '🚀 Uploading...'
                              : ytScheduled && ytScheduledTime
                              ? `📅 Scheduled (${new Date(ytScheduledTime).toLocaleDateString([], { month: 'short', day: 'numeric' })} ${new Date(ytScheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                              : '⏳ Pending Approval'}
                          </span>
                        </span>

                        {/* Meta Status Badge */}
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                          metaDone 
                            ? 'bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                            : metaUploading
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 animate-pulse'
                            : metaScheduled
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        }`}>
                          <span>🔵 FB & IG:</span>
                          <span>
                            {metaDone 
                              ? '✓ Published' 
                              : metaUploading
                              ? '🚀 Publishing...'
                              : metaScheduled && metaScheduledTime
                              ? `📅 Scheduled (${new Date(metaScheduledTime).toLocaleDateString([], { month: 'short', day: 'numeric' })} ${new Date(metaScheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                              : '⏳ Pending Approval'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="p-5 pt-0 border-t border-gray-100 dark:border-gray-700/60 flex flex-col gap-2.5">
                    {isYouTube ? (
                      /* YouTube Tab Actions */
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(video.id)}
                          disabled={isBusy}
                          className="px-3.5 py-2.5 bg-gray-100 hover:bg-rose-50 text-gray-600 hover:text-rose-600 dark:bg-gray-700 dark:hover:bg-rose-950/40 rounded-xl font-bold text-xs transition border border-gray-200 dark:border-gray-600 disabled:opacity-50 cursor-pointer"
                          title="Delete video permanently"
                        >
                          🗑️
                        </button>

                        <button
                          onClick={() => handlePublishNow(video.id, 'youtube')}
                          disabled={isBusy || ytDone || ytUploading}
                          className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-2.5 px-3 rounded-xl transition-all shadow-md shadow-red-500/20 text-xs active:scale-95 flex items-center justify-center gap-1.5 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {isBusy || ytUploading ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Uploading to YouTube...</span>
                            </>
                          ) : (
                            <>
                              <span>🔴</span>
                              <span>Upload to YouTube (Private)</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleOpenScheduleModal(video.id)}
                          disabled={isBusy || ytDone || ytUploading}
                          className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs transition border border-gray-200 dark:border-gray-600 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                          title={ytScheduled ? "Change scheduled time" : "Schedule for future date"}
                        >
                          <span>📅</span>
                          <span>{ytScheduled ? 'Reschedule' : ''}</span>
                        </button>
                      </div>
                    ) : (
                      /* Facebook & Instagram Tab Actions */
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(video.id)}
                          disabled={isBusy}
                          className="px-3.5 py-2.5 bg-gray-100 hover:bg-rose-50 text-gray-600 hover:text-rose-600 dark:bg-gray-700 dark:hover:bg-rose-950/40 rounded-xl font-bold text-xs transition border border-gray-200 dark:border-gray-600 disabled:opacity-50 cursor-pointer"
                          title="Delete video permanently"
                        >
                          🗑️
                        </button>

                        <button
                          onClick={() => handlePublishNow(video.id, 'meta')}
                          disabled={isBusy || metaDone || metaUploading}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2.5 px-3 rounded-xl transition-all shadow-md shadow-blue-500/20 text-xs active:scale-95 flex items-center justify-center gap-1.5 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {isBusy || metaUploading ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Publishing to FB & IG...</span>
                            </>
                          ) : (
                            <>
                              <span>🚀</span>
                              <span>Publish to FB & IG (Live)</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleOpenScheduleModal(video.id)}
                          disabled={isBusy || metaDone || metaUploading}
                          className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs transition border border-gray-200 dark:border-gray-600 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                          title={metaScheduled ? "Change scheduled time" : "Schedule FB & IG for future date"}
                        >
                          <span>📅</span>
                          <span>{metaScheduled ? 'Reschedule' : ''}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Reusable Scheduling Modal */}
      <ScheduleModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedVideoId(null); }}
        onSubmit={handleScheduleSubmit}
        onPublishNow={selectedVideoId ? () => {
          const id = selectedVideoId;
          setIsModalOpen(false);
          setSelectedVideoId(null);
          handlePublishNow(id, activePlatform);
        } : undefined}
        title={isYouTube ? 'Schedule YouTube Upload' : 'Schedule Facebook & Instagram'}
        description={
          isYouTube 
            ? 'Set a date and time for the video to be uploaded to YouTube as Private.' 
            : 'Set a date and time for the video to be published live to Facebook Page and Instagram Reels.'
        }
        publishNowLabel={isYouTube ? '🔴 Upload as Private to YouTube Now' : '🚀 Publish Live to FB & IG Now'}
        submitLabel={isYouTube ? 'Schedule YouTube Upload' : 'Schedule FB & IG Publish'}
        accentColor={isYouTube ? 'red' : 'blue'}
      />
    </div>
  );
}

export default function AdminDashboard(props: { initialPlatform?: 'youtube' | 'meta' }) {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mr-3"></div>
        Loading dashboard...
      </div>
    }>
      <AdminDashboardContent {...props} />
    </React.Suspense>
  );
}

