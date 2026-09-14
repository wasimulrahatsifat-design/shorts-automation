'use client';

import React, { useEffect, useState } from 'react';
import { ScheduleModal } from '@/components/ScheduleModal';

interface VideoItem {
  id: string;
  topic: string;
  video_url: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos/needs-approval');
      const data = await res.json();
      if (data.success) {
        setVideos(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch videos', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Are you sure you want to reject and delete this video?')) return;
    
    // Optimistic UI update
    setVideos(videos.filter(v => v.id !== id));
    
    try {
      await fetch(`/api/videos/${id}/reject`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to reject video', error);
      // Revert on failure
      fetchVideos();
    }
  };

  const handleApproveClick = (id: string) => {
    setSelectedVideoId(id);
    setIsModalOpen(true);
  };

  const handleScheduleSubmit = async (scheduledTime: string) => {
    if (!selectedVideoId) return;

    const id = selectedVideoId;
    setIsModalOpen(false);
    setSelectedVideoId(null);

    // Optimistic UI update
    setVideos(videos.filter(v => v.id !== id));

    try {
      await fetch(`/api/videos/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scheduled_time: scheduledTime }),
      });
    } catch (error) {
      console.error('Failed to approve video', error);
      // Revert on failure
      fetchVideos();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight sm:text-5xl">
            Content Review
          </h1>
          <p className="mt-4 text-xl text-gray-500 dark:text-gray-400">
            Review and schedule your generated videos
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-medium text-gray-900 dark:text-white">All caught up!</h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">There are no videos pending approval at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {videos.map((video) => (
              <div key={video.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 transition-transform hover:scale-[1.02] duration-300">
                <div className="relative aspect-[9/16] bg-black">
                  <video
                    src={video.video_url}
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 line-clamp-2">
                    {video.topic}
                  </h3>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleReject(video.id)}
                      className="flex-1 bg-red-50 text-red-600 hover:bg-red-100 font-semibold py-2.5 px-4 rounded-xl transition-colors border border-red-200"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApproveClick(video.id)}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors shadow-sm"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ScheduleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleScheduleSubmit}
      />
    </div>
  );
}
