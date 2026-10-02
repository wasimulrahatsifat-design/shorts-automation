'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const DEFAULT_TIMELAPSE_MASTER_PROMPT = `You are a world-class AI Video Producer, Creative Director, and Prompt Engineering Master specializing in viral YouTube Shorts, TikToks, and Reels for "Time Lapse" and "Day-by-Day Progression" videos (e.g., 0 to 90 Days Transformations, Plant Growth, Fitness Transformations, Construction, Puppies Growing Up, Aging, Art Creation, Weather Changes, and Science Experiments).

When the user asks for concepts, ideas, or prompts:
1. Provide actionable, high-performing concepts with exact Days breakdown (e.g. Day 0, Day 15, Day 30, Day 60, Day 90).
2. Write exact, hyper-detailed Image/Video generation prompts optimized for Midjourney v6, Kling AI, Luma Dream Machine, Runway Gen-3, Pika, and Hailuo.
3. Suggest punchy, high-CTR titles in clean Quicksand style.
4. Keep answers structured with clear headings, bullet points, and codeblocks for prompts so the user can easily copy them.`;

const DEFAULT_DREAMCORE_MASTER_PROMPT = `You are a cinematic director specializing in viral Liminal Space and Dreamcore aesthetic YouTube Shorts and TikToks.
Help the user create surreal dreamcore concepts, 4 continuous cinematic camera angles (Wide establishing, Low-angle looking up, Medium tracking, Overhead view) of the exact same location, and evocative titles.`;

const INITIAL_CATEGORIES = ['Time lapse', 'Dreamcore'];

export default function VideoFlowPage() {
  // Category management
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string>('Time lapse');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);

  // Master prompt management
  const [masterPrompt, setMasterPrompt] = useState<string>('');
  const [isEditingMasterPrompt, setIsEditingMasterPrompt] = useState(false);
  const [masterPromptSavedNotice, setMasterPromptSavedNotice] = useState(false);

  // Chat management
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Video / Flow settings
  const [videoTitle, setVideoTitle] = useState('90 Days Transformation');
  const [videoUrl, setVideoUrl] = useState('');
  const [startDay, setStartDay] = useState<number>(0);
  const [endDay, setEndDay] = useState<number>(90);
  const [dayPrefix, setDayPrefix] = useState('Day ');
  const [durationSeconds, setDurationSeconds] = useState<number>(15);

  // Upload & Rendering state
  const [isUploading, setIsUploading] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Interactive preview scrub slider
  const [previewProgress, setPreviewProgress] = useState<number>(50); // 0 to 100%

  // 1. Load Categories and Master Prompts from localStorage on mount
  useEffect(() => {
    try {
      const savedCats = localStorage.getItem('videoflow_categories');
      if (savedCats) {
        const parsed = JSON.parse(savedCats);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategories(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // 2. Load / Update Master Prompt when category changes
  useEffect(() => {
    try {
      const storageKey = `videoflow_master_prompt_${selectedCategory.toLowerCase().replace(/\s+/g, '_')}`;
      const savedPrompt = localStorage.getItem(storageKey);
      if (savedPrompt) {
        setMasterPrompt(savedPrompt);
      } else {
        // Fallback to default
        if (selectedCategory === 'Time lapse') {
          setMasterPrompt(DEFAULT_TIMELAPSE_MASTER_PROMPT);
          localStorage.setItem(storageKey, DEFAULT_TIMELAPSE_MASTER_PROMPT);
        } else if (selectedCategory === 'Dreamcore') {
          setMasterPrompt(DEFAULT_DREAMCORE_MASTER_PROMPT);
          localStorage.setItem(storageKey, DEFAULT_DREAMCORE_MASTER_PROMPT);
        } else {
          const customPrompt = `You are a creative director and prompt engineering expert specializing in viral video shorts for "${selectedCategory}". Help the user brainstorm ideas, script outlines, and AI generation prompts.`;
          setMasterPrompt(customPrompt);
          localStorage.setItem(storageKey, customPrompt);
        }
      }
    } catch {
      // ignore
    }
  }, [selectedCategory]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatLoading]);

  // Save Master Prompt to localStorage permanently
  const handleSaveMasterPrompt = () => {
    try {
      const storageKey = `videoflow_master_prompt_${selectedCategory.toLowerCase().replace(/\s+/g, '_')}`;
      localStorage.setItem(storageKey, masterPrompt);
      setMasterPromptSavedNotice(true);
      setIsEditingMasterPrompt(false);
      setTimeout(() => setMasterPromptSavedNotice(false), 3000);
    } catch (e: any) {
      console.error('Failed to save master prompt:', e);
    }
  };

  // Add new Category
  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (!categories.includes(trimmed)) {
      const updated = [...categories, trimmed];
      setCategories(updated);
      try {
        localStorage.setItem('videoflow_categories', JSON.stringify(updated));
      } catch {}
      setSelectedCategory(trimmed);
    }
    setNewCategoryName('');
    setShowAddCategoryModal(false);
  };

  // Send message to Gemini chat
  const handleSendMessage = async (msgToSend?: string) => {
    const text = (msgToSend || inputMessage).trim();
    if (!text || isChatLoading) return;

    const newHistory: ChatMessage[] = [...messages, { role: 'user', text }];
    setMessages(newHistory);
    setInputMessage('');
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages,
          masterPrompt,
          category: selectedCategory,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.reply) {
        setMessages([...newHistory, { role: 'model', text: data.reply }]);
      } else {
        setMessages([
          ...newHistory,
          { role: 'model', text: `⚠️ Error: ${data.error || 'Failed to get response from Gemini.'}` },
        ]);
      }
    } catch (err: any) {
      setMessages([
        ...newHistory,
        { role: 'model', text: `⚠️ Network error: ${err.message || 'Could not connect.'}` },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Handle Video Upload directly to Supabase Storage
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setNotification({ type: 'info', text: 'Uploading video to cloud storage...' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload-media', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error || 'Failed to upload video.');
      }

      setVideoUrl(data.url);
      setNotification({ type: 'success', text: 'Video uploaded successfully! Preview updated below.' });
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', text: err.message || 'Error uploading video file.' });
    } finally {
      setIsUploading(false);
    }
  };

  // Queue Video for Remotion Rendering
  const handleQueueRender = async () => {
    if (!videoUrl) {
      setNotification({ type: 'error', text: 'Please upload a video first.' });
      return;
    }

    setIsQueueing(true);
    setNotification({ type: 'info', text: 'Queueing video for rendering...' });

    try {
      const payload = {
        data_json: {
          format: 'TimeLapseVideo',
          topic: videoTitle || `${selectedCategory} Video`,
          title: videoTitle,
          video_url: videoUrl,
          start_day: Number(startDay) || 0,
          end_day: Number(endDay) || 90,
          day_prefix: dayPrefix,
          duration_seconds: Number(durationSeconds) || 15,
        },
        duration: Number(durationSeconds) || 15,
        showSubtitles: false,
      };

      const res = await fetch('/api/queue-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({
          type: 'success',
          text: '🎉 Video queued successfully! Check Main Dashboard for render progress.',
        });
      } else {
        setNotification({ type: 'error', text: data.error || 'Failed to queue video.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Error queueing video.' });
    } finally {
      setIsQueueing(false);
    }
  };

  // Calculated current day for interactive preview
  const previewCurrentDay = Math.round(startDay + (endDay - startDay) * (previewProgress / 100));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans selection:bg-cyan-500 selection:text-black">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Navigation & Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl shadow-2xl">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎬</span>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-sky-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                Video Flow
              </h1>
              <span className="text-xs uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2.5 py-0.5 rounded-full font-bold">
                Studio
              </span>
            </div>
            <p className="text-sm text-slate-400">
              AI-powered Time Lapse & Video Generator with customizable overlays and Quicksand typography.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Link
              href="/"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-all border border-slate-700 hover:border-slate-600 shadow-sm"
            >
              📊 Main Dashboard
            </Link>
            <Link
              href="/game"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 hover:opacity-90 text-white text-sm font-bold transition-all shadow-md shadow-red-500/20"
            >
              ⚔️ Arena Game
            </Link>
          </div>
        </header>

        {/* Notification Banner */}
        {notification && (
          <div
            className={`p-4 rounded-2xl text-sm font-semibold border flex items-center justify-between transition-all ${
              notification.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : notification.type === 'error'
                ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                : 'bg-sky-950/60 border-sky-500/40 text-sky-300'
            }`}
          >
            <span>{notification.text}</span>
            <button onClick={() => setNotification(null)} className="text-xs opacity-70 hover:opacity-100 ml-4">
              ✕
            </button>
          </div>
        )}

        {/* 1. Category Selection Bar (Time lapse, Dreamcore, + Add Category) */}
        <section className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-3xl space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span>🏷️ Select Video Flow Category</span>
            </label>
            <span className="text-xs text-slate-500">Click to switch master prompt and workflow</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white border-sky-400 shadow-lg shadow-sky-500/25 scale-[1.02]'
                      : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-750 hover:border-slate-600'
                  }`}
                >
                  <span>{cat === 'Time lapse' ? '⏱️' : cat === 'Dreamcore' ? '🌌' : '📁'}</span>
                  <span>{cat}</span>
                </button>
              );
            })}

            <button
              onClick={() => setShowAddCategoryModal(true)}
              className="px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800 border border-dashed border-slate-700 hover:border-slate-500 transition-all flex items-center gap-1.5"
            >
              <span>+</span>
              <span>Add Category</span>
            </button>
          </div>

          {/* Add Category Modal/Popup */}
          {showAddCategoryModal && (
            <div className="mt-4 p-4 rounded-2xl bg-slate-850 border border-slate-700 flex flex-col md:flex-row items-center gap-3">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter new category name (e.g., Fitness Transformation)..."
                className="w-full md:flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-sky-500"
              />
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <button
                  onClick={() => setShowAddCategoryModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCategory}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  Save Category
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 2. Persistent Master Prompt Box */}
        <section className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden transition-all">
          <div className="p-5 flex items-center justify-between border-b border-slate-800/60">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚙️</span>
              <div>
                <h3 className="text-sm font-bold text-slate-200">
                  Master Prompt for <span className="text-sky-400">"{selectedCategory}"</span>
                </h3>
                <p className="text-xs text-slate-500">
                  This system instruction is saved permanently in your browser and guides every AI reply.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {masterPromptSavedNotice && (
                <span className="text-xs text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full animate-fade-in">
                  ✓ Saved Permanently
                </span>
              )}
              <button
                onClick={() => {
                  if (isEditingMasterPrompt) {
                    handleSaveMasterPrompt();
                  } else {
                    setIsEditingMasterPrompt(true);
                  }
                }}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isEditingMasterPrompt
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {isEditingMasterPrompt ? '💾 Save Master Prompt' : '✏️ Edit Master Prompt'}
              </button>
            </div>
          </div>

          {isEditingMasterPrompt ? (
            <div className="p-5 space-y-3 bg-slate-950/40">
              <textarea
                value={masterPrompt}
                onChange={(e) => setMasterPrompt(e.target.value)}
                rows={7}
                className="w-full p-4 bg-slate-900 border border-slate-700 rounded-2xl text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 leading-relaxed resize-y"
                placeholder="Enter master prompt / system instructions..."
              />
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>Tip: Specify days format, title format, and Midjourney/Kling video prompt constraints.</span>
                <button
                  onClick={handleSaveMasterPrompt}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md"
                >
                  Save Changes Forever
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 text-xs text-slate-400 font-mono line-clamp-2 hover:line-clamp-none transition-all cursor-pointer bg-slate-950/20"
                 onClick={() => setIsEditingMasterPrompt(true)}>
              {masterPrompt}
            </div>
          )}
        </section>

        {/* Main Grid: Left = AI Chat, Right = Video Customizer & Live 9:16 Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Gemini AI Chat Box (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-5 shadow-2xl flex flex-col h-[740px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Gemini AI Assistant</span>
                  <span className="text-xs text-slate-500 font-normal">({selectedCategory} Mode)</span>
                </h2>
              </div>
              <button
                onClick={() => setMessages([])}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                title="Clear Chat History"
              >
                Clear Chat
              </button>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                '🌱 Plant Growth 0-90 Days Prompts',
                '🏋️ Weight Loss 0-90 Days Prompts',
                '🐶 Puppy Growth 0-90 Days Prompts',
                '💡 5 Viral Time Lapse Titles',
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(chip)}
                  disabled={isChatLoading}
                  className="text-xs bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 hover:border-sky-500 text-slate-300 px-3 py-1.5 rounded-full transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-3">
                  <span className="text-4xl opacity-50">✨</span>
                  <p className="text-sm font-medium">
                    Ask Gemini to generate your 0–90 Day Time Lapse progression prompts, image keywords, or video titles!
                  </p>
                  <p className="text-xs text-slate-600">
                    Replies are tailored automatically by the persistent Master Prompt.
                  </p>
                </div>
              ) : (
                messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] p-4 rounded-2xl text-xs md:text-sm leading-relaxed whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-tr-none shadow-md'
                          : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-tl-none shadow-sm'
                      }`}
                    >
                      {m.text}
                    </div>
                    {m.role === 'model' && (
                      <button
                        onClick={() => navigator.clipboard.writeText(m.text)}
                        className="text-[11px] text-slate-500 hover:text-sky-400 mt-1 ml-1 flex items-center gap-1 transition-colors"
                      >
                        📋 Copy Reply
                      </button>
                    )}
                  </div>
                ))
              )}

              {isChatLoading && (
                <div className="flex items-center gap-2 text-xs text-sky-400 bg-slate-850 p-3 rounded-2xl w-fit border border-slate-700 animate-pulse">
                  <span>✨ Gemini is thinking & crafting prompts...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="pt-2 flex items-center gap-2 border-t border-slate-800"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={`Ask Gemini for ${selectedCategory} prompts or day breakdowns...`}
                disabled={isChatLoading}
                className="flex-1 px-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={isChatLoading || !inputMessage.trim()}
                className={`px-5 py-3 rounded-2xl font-bold text-sm text-white transition-all shadow-md ${
                  isChatLoading || !inputMessage.trim()
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 active:scale-95'
                }`}
              >
                Send →
              </button>
            </form>
          </div>

          {/* RIGHT COLUMN: Video Upload, Day Setup & Live 9:16 Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Customization Settings Card */}
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-5 shadow-2xl">
              <h2 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                <span>📹 Video Customizer</span>
                <span className="text-xs text-sky-400 font-mono font-normal">(Font: Quicksand)</span>
              </h2>

              {/* 1. Title Input (Quicksand font) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Top Video Title
                </label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="e.g., 90 Days Plant Growth"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-sky-500"
                  style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700 }}
                />
              </div>

              {/* 2. Video Upload Box */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Upload Timelapse Video
                </label>
                <div className="relative border-2 border-dashed border-slate-700 hover:border-sky-500 bg-slate-950/60 rounded-2xl p-4 text-center transition-all">
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,image/*"
                    onChange={handleVideoUpload}
                    disabled={isUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <span className="text-2xl">{isUploading ? '⏳' : videoUrl ? '✅' : '📤'}</span>
                    <span className="text-xs font-bold text-slate-200">
                      {isUploading
                        ? 'Uploading media to cloud storage...'
                        : videoUrl
                        ? 'Video Uploaded! Click to replace'
                        : 'Choose or drag & drop video file'}
                    </span>
                    <span className="text-[11px] text-slate-500">Supports .mp4, .webm (Vertical 9:16 recommended)</span>
                  </div>
                </div>
              </div>

              {/* 3. Day Settings (0 to 90) */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Start Day</label>
                  <input
                    type="number"
                    value={startDay}
                    onChange={(e) => setStartDay(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white text-center font-bold focus:outline-none focus:border-sky-500"
                    style={{ fontFamily: 'Quicksand, sans-serif' }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">End Day</label>
                  <input
                    type="number"
                    value={endDay}
                    onChange={(e) => setEndDay(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white text-center font-bold focus:outline-none focus:border-sky-500"
                    style={{ fontFamily: 'Quicksand, sans-serif' }}
                  />
                </div>
              </div>

              {/* Day Prefix & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Day Label / Prefix</label>
                  <input
                    type="text"
                    value={dayPrefix}
                    onChange={(e) => setDayPrefix(e.target.value)}
                    placeholder="Day "
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white text-center focus:outline-none focus:border-sky-500"
                    style={{ fontFamily: 'Quicksand, sans-serif' }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Video Duration (Sec)</label>
                  <input
                    type="number"
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(Number(e.target.value))}
                    min={5}
                    max={60}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white text-center font-bold focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Start Rendering Button */}
              <div className="pt-2">
                <button
                  onClick={handleQueueRender}
                  disabled={isQueueing || isUploading || !videoUrl}
                  className={`w-full py-4 rounded-2xl font-bold text-sm text-white transition-all shadow-xl flex items-center justify-center gap-2 ${
                    isQueueing || isUploading || !videoUrl
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-600 hover:from-emerald-400 hover:to-sky-500 shadow-emerald-500/25 active:scale-95'
                  }`}
                >
                  <span>{isQueueing ? '⏳ Queueing Render...' : '🚀 Start Rendering Video'}</span>
                </button>
              </div>
            </div>

            {/* LIVE 9:16 VERTICAL PREVIEW MOCKUP */}
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-2xl flex flex-col items-center">
              <div className="w-full flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  📱 Live 9:16 Preview
                </span>
                <span className="text-xs text-sky-400 font-mono">
                  Quicksand Font Active
                </span>
              </div>

              {/* Mockup Frame (9:16 Aspect Ratio) */}
              <div className="relative w-[280px] h-[498px] bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-700 flex flex-col justify-between">
                
                {/* Background Video or Placeholder */}
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-500">
                    <span className="text-4xl mb-2 opacity-40">🎬</span>
                    <span className="text-xs">Upload video above to preview live overlay</span>
                  </div>
                )}

                {/* Top Overlay Gradient */}
                <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-10" />

                {/* Bottom Overlay Gradient */}
                <div className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-black/90 to-transparent pointer-events-none z-10" />

                {/* Top Title in Quicksand Font */}
                <div className="relative z-20 pt-8 px-4 text-center">
                  {videoTitle && (
                    <div
                      className="inline-block px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white text-xs font-extrabold shadow-lg"
                      style={{ fontFamily: 'Quicksand, sans-serif' }}
                    >
                      {videoTitle}
                    </div>
                  )}
                </div>

                {/* Bottom Day Counter in Quicksand Font */}
                <div className="relative z-20 pb-10 flex flex-col items-center gap-2">
                  <div
                    className="px-5 py-2 rounded-full bg-slate-900/80 backdrop-blur-md border-2 border-white/30 text-white text-lg font-extrabold shadow-2xl"
                    style={{ fontFamily: 'Quicksand, sans-serif', letterSpacing: '0.5px' }}
                  >
                    {dayPrefix}{previewCurrentDay}
                  </div>
                  {/* Progress bar */}
                  <div className="w-24 h-1 bg-white/25 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full"
                      style={{ width: `${previewProgress}%` }}
                    />
                  </div>
                </div>

              </div>

              {/* Interactive Scrub Slider for Day Testing */}
              <div className="w-full space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Scrub Day Progress:</span>
                  <span className="font-bold text-sky-400" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                    {dayPrefix}{previewCurrentDay} ({previewProgress}%)
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={previewProgress}
                  onChange={(e) => setPreviewProgress(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
