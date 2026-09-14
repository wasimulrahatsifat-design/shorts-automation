'use client';
import React, { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/generate-topic', {
        method: 'POST',
      });
      
      const data = await response.json();

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: 'Video topic successfully generated and queued!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to generate topic.' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="px-8 pt-10 pb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Shorts Automation
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Control Panel
          </p>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className={`w-full py-4 px-6 rounded-xl text-white font-semibold shadow-md transition-all ${
              loading
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-95'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </span>
            ) : (
              'Generate New Video Topic'
            )}
          </button>

          {message && (
            <div className={`mt-6 p-4 rounded-lg text-sm font-medium ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 p-6 flex justify-center">
          <Link 
            href="/admin" 
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-2"
          >
            Go to Admin Dashboard
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
