'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import {
  findImageInLibrary,
  saveImageToLibrary,
  syncImagesFromSupabase,
} from '../lib/image-library';
import { POPULAR_VOICES, VoiceOption } from '../lib/voices';

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
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('pNInz6obpgDQGcFmaJgB');
  const [customVoiceId, setCustomVoiceId] = useState<string>('');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Background Music State
  const [bgMusicUrl, setBgMusicUrl] = useState<string>('');
  const [bgMusicVolume, setBgMusicVolume] = useState<number>(0.15); // default 15%
  const [bgMusicUploading, setBgMusicUploading] = useState<boolean>(false);
  const [isPlayingMusicPreview, setIsPlayingMusicPreview] = useState<boolean>(false);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);

  // Step 2 State
  const [draftJson, setDraftJson] = useState('');
  const [magicInstruction, setMagicInstruction] = useState('');
  const [requiredImages, setRequiredImages] = useState<{keyword: string, file: string | null}[]>([]);
  const [imageLibrary, setImageLibrary] = useState<Record<string, string>>({});

  // Image Crop & Frame Modal State
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropTargetKeyword, setCropTargetKeyword] = useState<string | null>(null);
  const [rawCropImageSrc, setRawCropImageSrc] = useState<string | null>(null);
  const [rawCropImgSize, setRawCropImgSize] = useState<{ width: number; height: number }>({ width: 300, height: 300 });
  const [cropScale, setCropScale] = useState<number>(1);
  const [cropPan, setCropPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Sync past uploaded images from Supabase on mount
  useEffect(() => {
    syncImagesFromSupabase(supabase).then((lib) => {
      setImageLibrary(lib);
    });
  }, []);

  // Stop audio preview on unmount
  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current = null;
      }
    };
  }, []);

  const toggleMusicPreview = () => {
    if (!bgMusicUrl) return;
    if (isPlayingMusicPreview) {
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current = null;
      }
      setIsPlayingMusicPreview(false);
      return;
    }
    try {
      const audio = new Audio(bgMusicUrl);
      audio.volume = Math.min(1, Math.max(0, bgMusicVolume));
      musicAudioRef.current = audio;
      setIsPlayingMusicPreview(true);
      audio.play().catch(() => setIsPlayingMusicPreview(false));
      audio.onended = () => {
        setIsPlayingMusicPreview(false);
        musicAudioRef.current = null;
      };
      audio.onerror = () => {
        setIsPlayingMusicPreview(false);
        musicAudioRef.current = null;
      };
    } catch {
      setIsPlayingMusicPreview(false);
    }
  };

  const handleBgMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgMusicUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'mp3';
      const fileName = `bgm_${crypto.randomUUID()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('shorts').upload(fileName, file, {
        contentType: file.type || 'audio/mpeg',
        upsert: true
      });
      if (error) throw error;
      const { data: publicData } = supabase.storage.from('shorts').getPublicUrl(fileName);
      setBgMusicUrl(publicData.publicUrl);
      setMessage({ type: 'success', text: 'Background music uploaded successfully!' });
    } catch (err: any) {
      console.error('Error uploading background music:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to upload background music.' });
    } finally {
      setBgMusicUploading(false);
      e.target.value = '';
    }
  };

  const togglePlayVoicePreview = (voice: VoiceOption) => {
    if (playingVoiceId === voice.id) {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
      setPlayingVoiceId(null);
      return;
    }

    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }

    try {
      const audio = new Audio(voice.previewUrl);
      audioPreviewRef.current = audio;
      setPlayingVoiceId(voice.id);
      audio.play().catch(() => setPlayingVoiceId(null));
      audio.onended = () => {
        setPlayingVoiceId(null);
        audioPreviewRef.current = null;
      };
      audio.onerror = () => {
        setPlayingVoiceId(null);
        audioPreviewRef.current = null;
      };
    } catch (e) {
      setPlayingVoiceId(null);
    }
  };

  // Parse draftJson for unique image keywords & Auto-Match from persistent Image Library!
  useEffect(() => {
    if (!draftJson || step !== 2) return;
    try {
      const parsed = JSON.parse(draftJson);
      const keywords = new Set<string>();
      
      const addKeyword = (kw: string) => { if (kw) keywords.add(kw); };

      if (parsed.questions) parsed.questions.forEach((q: any) => addKeyword(q.image_keyword));
      if (parsed.items) parsed.items.forEach((item: any) => addKeyword(item.image_keyword));
      if (parsed.contestants) parsed.contestants.forEach((c: any) => addKeyword(c.image_keyword));
      if (parsed.scenarios) {
        parsed.scenarios.forEach((s: any) => {
          addKeyword(s.image_keyword_a);
          addKeyword(s.image_keyword_b);
        });
      }

      let draftUpdated = false;

      const updatedList = Array.from(keywords).map((kw) => {
        // 1. Check if draftJson already has an image for this keyword
        let existingUrl: string | null = null;
        if (parsed.questions) {
          const found = parsed.questions.find((q: any) => q.image_keyword === kw && q.image_url);
          if (found) existingUrl = found.image_url;
        }
        if (!existingUrl && parsed.items) {
          const found = parsed.items.find((it: any) => it.image_keyword === kw && it.image_url);
          if (found) existingUrl = found.image_url;
        }
        if (!existingUrl && parsed.contestants) {
          const found = parsed.contestants.find((c: any) => c.image_keyword === kw && c.image_url);
          if (found) existingUrl = found.image_url;
        }
        if (!existingUrl && parsed.scenarios) {
          const found = parsed.scenarios.find((s: any) => (s.image_keyword_a === kw && s.image_url_a) || (s.image_keyword_b === kw && s.image_url_b));
          if (found) existingUrl = found.image_keyword_a === kw ? found.image_url_a : found.image_url_b;
        }

        // 2. If not yet attached, auto-match from persistent Image Library (e.g. Giraffe, Bat, Lion, etc.)!
        if (!existingUrl) {
          existingUrl = findImageInLibrary(kw, imageLibrary);
          if (existingUrl) {
            if (parsed.questions) {
              parsed.questions.forEach((q: any) => { if (q.image_keyword === kw) q.image_url = existingUrl; });
            }
            if (parsed.items) {
              parsed.items.forEach((it: any) => { if (it.image_keyword === kw) it.image_url = existingUrl; });
            }
            if (parsed.contestants) {
              parsed.contestants.forEach((c: any) => { if (c.image_keyword === kw) c.image_url = existingUrl; });
            }
            if (parsed.scenarios) {
              parsed.scenarios.forEach((s: any) => {
                if (s.image_keyword_a === kw) s.image_url_a = existingUrl;
                if (s.image_keyword_b === kw) s.image_url_b = existingUrl;
              });
            }
            draftUpdated = true;
          }
        }

        return { keyword: kw, file: existingUrl };
      });

      setRequiredImages(updatedList);

      if (draftUpdated) {
        setDraftJson(JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      // invalid json, ignore
    }
  }, [draftJson, step, imageLibrary]);

  const openCropModal = (keyword: string, imageSrc: string) => {
    const img = new Image();
    img.onload = () => {
      setRawCropImgSize({ width: img.naturalWidth, height: img.naturalHeight });
      const VIEWPORT_W = 320;
      const VIEWPORT_H = 220;
      // Default to fit entire image cleanly inside box without cutting off!
      const fitScale = Math.min(VIEWPORT_W / img.naturalWidth, VIEWPORT_H / img.naturalHeight);
      setCropScale(Number(Math.max(0.15, fitScale).toFixed(2)));
      setCropPan({ x: 0, y: 0 });
      setCropTargetKeyword(keyword);
      setRawCropImageSrc(imageSrc);
      setCropModalOpen(true);
    };
    img.src = imageSrc;
  };

  const handleFileUpload = (keyword: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Url = reader.result as string;
      openCropModal(keyword, base64Url);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropMouseDown = (e: React.MouseEvent) => {
    setIsDraggingCrop(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...cropPan };
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCrop) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setCropPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy });
  };

  const handleCropMouseUp = () => {
    setIsDraggingCrop(false);
  };

  const handleCropTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDraggingCrop(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { ...cropPan };
    }
  };

  const handleCropTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingCrop || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    setCropPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy });
  };

  const handleCropWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setCropScale((prev) => Math.min(3.5, Math.max(0.1, Number((prev + delta).toFixed(2)))));
  };

  const handleFitCrop = () => {
    const VIEWPORT_W = 320;
    const VIEWPORT_H = 220;
    const fitScale = Math.min(VIEWPORT_W / rawCropImgSize.width, VIEWPORT_H / rawCropImgSize.height);
    setCropScale(Number(fitScale.toFixed(2)));
    setCropPan({ x: 0, y: 0 });
  };

  const handleFillCrop = () => {
    const VIEWPORT_W = 320;
    const VIEWPORT_H = 220;
    const fillScale = Math.max(VIEWPORT_W / rawCropImgSize.width, VIEWPORT_H / rawCropImgSize.height);
    setCropScale(Number(fillScale.toFixed(2)));
    setCropPan({ x: 0, y: 0 });
  };

  const applyCrop = () => {
    if (!cropTargetKeyword || !rawCropImageSrc) return;

    const img = new Image();
    img.onload = () => {
      const VIEWPORT_W = 320;
      const VIEWPORT_H = 220;
      const OUT_W = 640;
      const OUT_H = 440;
      const canvas = document.createElement('canvas');
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dark background so framed letterboxes look sleek
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, OUT_W, OUT_H);

      const ratio = OUT_W / VIEWPORT_W;
      const scaledW = img.naturalWidth * cropScale * ratio;
      const scaledH = img.naturalHeight * cropScale * ratio;
      const posX = OUT_W / 2 + cropPan.x * ratio - scaledW / 2;
      const posY = OUT_H / 2 + cropPan.y * ratio - scaledH / 2;

      ctx.drawImage(img, posX, posY, scaledW, scaledH);

      const croppedUrl = canvas.toDataURL('image/jpeg', 0.92);

      // 1. Save to Persistent Image Library so it is remembered forever!
      saveImageToLibrary(cropTargetKeyword, croppedUrl);
      setImageLibrary((prev) => ({ ...prev, [cropTargetKeyword]: croppedUrl }));

      // 2. Update requiredImages state
      setRequiredImages((prev) =>
        prev.map((imgItem) => (imgItem.keyword === cropTargetKeyword ? { ...imgItem, file: croppedUrl } : imgItem))
      );

      // 3. Inject into draftJson
      try {
        const parsed = JSON.parse(draftJson);
        if (parsed.questions) {
          parsed.questions.forEach((q: any) => { if (q.image_keyword === cropTargetKeyword) q.image_url = croppedUrl; });
        }
        if (parsed.items) {
          parsed.items.forEach((it: any) => { if (it.image_keyword === cropTargetKeyword) it.image_url = croppedUrl; });
        }
        if (parsed.contestants) {
          parsed.contestants.forEach((c: any) => { if (c.image_keyword === cropTargetKeyword) c.image_url = croppedUrl; });
        }
        if (parsed.scenarios) {
          parsed.scenarios.forEach((s: any) => {
            if (s.image_keyword_a === cropTargetKeyword) s.image_url_a = croppedUrl;
            if (s.image_keyword_b === cropTargetKeyword) s.image_url_b = croppedUrl;
          });
        }
        setDraftJson(JSON.stringify(parsed, null, 2));
      } catch (e) {}

      setCropModalOpen(false);
      setRawCropImageSrc(null);
      setCropTargetKeyword(null);
    };
    img.src = rawCropImageSrc;
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
    try {
      const { data, error } = await supabase
        .from('shorts_queue')
        .select('id, topic, status, video_url, created_at, data_json->format, data_json->duration_seconds, data_json->script')
        .order('created_at', { ascending: false });
      if (!error && data) {
        const mapped: VideoItem[] = data.map((item: any) => ({
          id: item.id,
          topic: item.topic,
          status: item.status,
          video_url: item.video_url,
          created_at: item.created_at,
          data_json: {
            format: item.format,
            duration_seconds: item.duration_seconds,
            script: item.script,
          }
        }));
        setVideos(mapped);
      }
    } catch (e) {
      console.error('Failed to fetch videos:', e);
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
        const payload = data.data;
        const finalVoiceId = selectedVoiceId === 'custom' ? customVoiceId.trim() : selectedVoiceId;
        payload.voice_id = finalVoiceId;
        setDraftJson(JSON.stringify(payload, null, 2));
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

      const finalVoiceId = selectedVoiceId === 'custom' ? customVoiceId.trim() : selectedVoiceId;

      const response = await fetch('/api/queue-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data_json: {
            ...parsedJson,
            voice_id: parsedJson.voice_id || finalVoiceId,
            bg_music_url: bgMusicUrl || parsedJson.bg_music_url || undefined,
            bg_music_volume: bgMusicUrl ? bgMusicVolume : parsedJson.bg_music_volume
          }, 
          showSubtitles, 
          duration,
          bg_music_url: bgMusicUrl || undefined,
          bg_music_volume: bgMusicUrl ? bgMusicVolume : undefined
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
    
    // Instant optimistic UI update
    setVideos((prev) => prev.filter((v) => v.id !== id));

    try {
      const res = await fetch(`/api/videos/${id}/delete`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Delete request failed');
      }
    } catch (error) {
      alert('Failed to delete video.');
      fetchVideos();
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

            {/* --- AI Voice Selection --- */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span>🎙️</span>
                    <span>Voiceover Narrator</span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Select a natural AI narrator or preview sample audio for your video.
                  </p>
                </div>
                <span className="text-[11px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800 w-fit">
                  {selectedVoiceId === 'custom'
                    ? '✨ Custom Voice'
                    : `Active: ${POPULAR_VOICES.find((v) => v.id === selectedVoiceId)?.name || 'Adam'}`}
                </span>
              </div>

              {/* Voice Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {POPULAR_VOICES.map((v) => {
                  const isSelected = selectedVoiceId === v.id;
                  const isPlaying = playingVoiceId === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVoiceId(v.id)}
                      className={`cursor-pointer p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/90 dark:bg-blue-950/60 shadow-md ring-2 ring-blue-500/20'
                          : 'border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-800/80 hover:border-blue-300 dark:hover:border-blue-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 dark:text-white">{v.name}</span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              v.gender === 'Female'
                                ? 'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300'
                                : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                            }`}
                          >
                            {v.gender}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="text-xs bg-blue-600 text-white font-black rounded-full px-1.5 py-0.2">✓</span>
                        )}
                      </div>

                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {v.description}
                      </p>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlayVoicePreview(v);
                        }}
                        className={`text-xs font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                          isPlaying
                            ? 'bg-red-500 text-white shadow animate-pulse'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                        }`}
                        title="Preview Voice Sample"
                      >
                        <span>{isPlaying ? '⏹ Stop' : '▶ Preview'}</span>
                      </button>
                    </div>
                  );
                })}

                {/* Custom Voice Card */}
                <div
                  onClick={() => setSelectedVoiceId('custom')}
                  className={`cursor-pointer p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                    selectedVoiceId === 'custom'
                      ? 'border-blue-500 bg-blue-50/90 dark:bg-blue-950/60 shadow-md ring-2 ring-blue-500/20'
                      : 'border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-800/80 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">✨ Custom Voice ID</span>
                    {selectedVoiceId === 'custom' && (
                      <span className="text-xs bg-blue-600 text-white font-black rounded-full px-1.5 py-0.2">✓</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Use any cloned or favorite ElevenLabs Voice ID directly.
                  </p>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 py-1">
                    Set Custom ID ✎
                  </span>
                </div>
              </div>

              {selectedVoiceId === 'custom' && (
                <div className="pt-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Paste ElevenLabs Voice ID:
                  </label>
                  <input
                    type="text"
                    value={customVoiceId}
                    onChange={(e) => setCustomVoiceId(e.target.value)}
                    placeholder="e.g., pNInz6obpgDQGcFmaJgB or your cloned voice ID"
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {/* --- Background Music & Volume --- */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span>🎵</span>
                    <span>Background Music (Optional)</span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Upload your own music track and configure background audio volume.
                  </p>
                </div>
                {bgMusicUrl && (
                  <span className="text-[11px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800 w-fit flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Music Active ({Math.round(bgMusicVolume * 100)}%)</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Audio Upload */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    Audio Track (.mp3, .wav)
                  </label>
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-blue-500 text-gray-700 dark:text-gray-200 text-xs font-semibold py-2.5 px-3.5 rounded-xl transition flex items-center justify-between shadow-sm">
                      <span className="truncate">
                        {bgMusicUploading 
                          ? 'Uploading audio...' 
                          : bgMusicUrl 
                            ? '✓ Music File Attached' 
                            : 'Upload Music File...'}
                      </span>
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-xs ml-2">Browse</span>
                      <input 
                        type="file" 
                        accept="audio/*" 
                        className="hidden" 
                        onChange={handleBgMusicUpload}
                        disabled={bgMusicUploading} 
                      />
                    </label>

                    {bgMusicUrl && (
                      <>
                        <button
                          type="button"
                          onClick={toggleMusicPreview}
                          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            isPlayingMusicPreview
                              ? 'bg-red-500 text-white shadow animate-pulse'
                              : 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          }`}
                          title="Preview background music"
                        >
                          <span>{isPlayingMusicPreview ? '⏹ Stop' : '▶ Preview'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (musicAudioRef.current) {
                              musicAudioRef.current.pause();
                              musicAudioRef.current = null;
                            }
                            setIsPlayingMusicPreview(false);
                            setBgMusicUrl('');
                          }}
                          className="px-2.5 py-2.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 transition"
                          title="Remove music"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Volume Slider */}
                <div className="space-y-1.5 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col justify-center">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-700 dark:text-gray-300">
                    <span>Music Volume</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">{Math.round(bgMusicVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={bgMusicVolume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setBgMusicVolume(v);
                      if (musicAudioRef.current) {
                        musicAudioRef.current.volume = v;
                      }
                    }}
                    className="w-full accent-blue-600 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-gray-400">Recommended: 10%–20% for balanced voiceover</span>
                </div>
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
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Step 2: Review & Edit Script</h2>
                <p className="text-gray-500 text-sm">You can manually tweak the script, labels, or data values before rendering the final video.</p>
              </div>
              <span className="text-xs bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold px-3.5 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 w-fit">
                <span>🎙️</span>
                <span>Voice: {POPULAR_VOICES.find((v) => v.id === selectedVoiceId)?.name || (selectedVoiceId === 'custom' ? 'Custom Voice' : 'Adam')}</span>
              </span>
            </div>
            
            <textarea
              value={draftJson}
              onChange={(e) => setDraftJson(e.target.value)}
              className="w-full h-[300px] font-mono text-sm px-4 py-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Manual Image Uploads & Auto-Memory */}
            {requiredImages.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100 flex items-center gap-2">
                    <span>🖼️</span>
                    <span>Required Visual Assets</span>
                  </h3>
                  <span className="text-[11px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 w-fit">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Smart Memory Active</span>
                  </span>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Uploaded images are automatically remembered for future videos. Click <strong>✂️ Crop</strong> to adjust framing and center key subjects.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {requiredImages.map((req, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col items-center text-center gap-3">
                      <span className="font-black text-gray-800 dark:text-gray-100 text-sm">
                        {req.keyword}
                      </span>
                      
                      {req.file ? (
                        <div className="relative w-32 h-24 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-md bg-slate-950 flex items-center justify-center">
                          <img src={req.file} alt={req.keyword} className="w-full h-full object-contain" />
                          <div className="absolute top-0 right-0 bg-emerald-500 text-white rounded-bl-lg px-2 py-0.5 text-[9px] font-black tracking-wider">
                            ✓ Saved
                          </div>
                        </div>
                      ) : (
                        <div className="w-32 h-24 rounded-xl bg-gray-100 dark:bg-gray-700/60 border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center text-gray-400 text-xs gap-1 font-semibold">
                          <span>📷</span>
                          <span>Image Required</span>
                        </div>
                      )}
                      
                      <div className="flex gap-2 w-full pt-1">
                        <label className="flex-1 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition-all shadow flex items-center justify-center gap-1.5">
                          <span>{req.file ? '🔄 Replace' : '📷 Upload'}</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleFileUpload(req.keyword, e)} 
                          />
                        </label>
                        {req.file && (
                          <button
                            type="button"
                            onClick={() => openCropModal(req.keyword, req.file!)}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl transition border border-slate-300 dark:border-slate-600 flex items-center gap-1"
                            title="Drag and zoom to position subject"
                          >
                            <span>✂️</span>
                            <span>Crop</span>
                          </button>
                        )}
                      </div>
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

        {/* --- Image Crop & Frame Modal --- */}
        {cropModalOpen && rawCropImageSrc && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>✂️</span>
                    <span>Adjust & Frame Subject</span>
                  </h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                    Target: <span className="underline">{cropTargetKeyword}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setCropModalOpen(false); setRawCropImageSrc(null); }}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center justify-center font-bold text-sm transition"
                >
                  ✕
                </button>
              </div>

              {/* Instructions */}
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <span>💡</span>
                  <span>Framing Guidelines:</span>
                </p>
                <p>
                  Drag the image or use the zoom slider to position the subject. Click <strong>Fit</strong> to display the entire image within frame.
                </p>
              </div>

              {/* Viewport Box (320px x 220px) */}
              <div className="flex flex-col items-center">
                <div
                  className="relative w-[320px] h-[220px] bg-slate-950 rounded-2xl overflow-hidden shadow-inner border-2 border-dashed border-blue-500 select-none cursor-grab active:cursor-grabbing flex items-center justify-center touch-none"
                  onMouseDown={handleCropMouseDown}
                  onMouseMove={handleCropMouseMove}
                  onMouseUp={handleCropMouseUp}
                  onMouseLeave={handleCropMouseUp}
                  onTouchStart={handleCropTouchStart}
                  onTouchMove={handleCropTouchMove}
                  onTouchEnd={handleCropMouseUp}
                  onWheel={handleCropWheel}
                >
                  {/* Visual Center Guides */}
                  <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/10 opacity-30 z-10">
                    <div className="border-r border-b border-white/20"></div>
                    <div className="border-r border-b border-white/20"></div>
                    <div className="border-b border-white/20"></div>
                    <div className="border-r border-b border-white/20"></div>
                    <div className="border-r border-b border-white/20"></div>
                    <div className="border-b border-white/20"></div>
                    <div className="border-r border-white/20"></div>
                    <div className="border-r border-white/20"></div>
                    <div></div>
                  </div>

                  <img
                    src={rawCropImageSrc}
                    alt="To Crop"
                    draggable={false}
                    style={{
                      transform: `translate(${cropPan.x}px, ${cropPan.y}px) scale(${cropScale})`,
                      transformOrigin: 'center center',
                      maxWidth: 'none',
                      userSelect: 'none',
                      pointerEvents: 'none',
                      transition: isDraggingCrop ? 'none' : 'transform 0.05s ease-out'
                    }}
                  />

                  <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-mono px-2 py-0.5 rounded pointer-events-none z-20">
                    {Math.round(cropScale * 100)}%
                  </div>
                </div>
              </div>

              {/* Zoom Controls & Presets */}
              <div className="space-y-3 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    🔍 Zoom:
                  </span>
                  <button
                    type="button"
                    onClick={() => setCropScale((s) => Math.max(0.1, Number((s - 0.1).toFixed(2))))}
                    className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-bold text-xs flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.05"
                    value={cropScale}
                    onChange={(e) => setCropScale(parseFloat(e.target.value))}
                    className="flex-1 accent-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setCropScale((s) => Math.min(3.5, Number((s + 0.1).toFixed(2))))}
                    className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-bold text-xs flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Presets:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleFitCrop}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-950/80 hover:bg-blue-200 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-lg transition border border-blue-200 dark:border-blue-800"
                      title="Keep entire image inside frame"
                    >
                      📐 Fit
                    </button>
                    <button
                      type="button"
                      onClick={handleFillCrop}
                      className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-lg transition"
                      title="Fill entire frame"
                    >
                      🖼️ Fill
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCropPan({ x: 0, y: 0 }); handleFitCrop(); }}
                      className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-lg transition"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setCropModalOpen(false); setRawCropImageSrc(null); }}
                  className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-semibold text-sm rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyCrop}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg transition active:scale-95 flex items-center gap-2"
                >
                  <span>✓</span>
                  <span>Save & Apply</span>
                </button>
              </div>

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
