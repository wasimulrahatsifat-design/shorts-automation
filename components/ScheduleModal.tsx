'use client';
import React, { useState } from 'react';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (scheduledTime: string) => void;
  onPublishNow?: () => void;
  title?: string;
  description?: string;
  publishNowLabel?: string;
  submitLabel?: string;
  accentColor?: 'red' | 'blue';
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onPublishNow,
  title = 'Schedule Video',
  description,
  publishNowLabel = '🚀 Publish Immediately',
  submitLabel = 'Schedule Time',
  accentColor = 'blue'
}) => {
  const [scheduledTime, setScheduledTime] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scheduledTime) {
      // scheduledTime format: YYYY-MM-DDTHH:mm
      const [datePart, timePart] = scheduledTime.split('T');
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePart.split(':');
      const dateObj = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
      
      const isoString = dateObj.toISOString();
      onSubmit(isoString);
    }
  };

  const isRed = accentColor === 'red';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all border border-gray-100 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>{isRed ? '🔴' : '🔵'}</span>
            <span>{title}</span>
          </h3>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {description}
            </p>
          )}
        </div>

        <div className="p-6 space-y-6">
          {onPublishNow && (
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                Option 1: Publish Right Away
              </span>
              <button
                type="button"
                onClick={onPublishNow}
                className={`w-full py-2.5 px-4 rounded-xl text-white font-bold text-sm shadow-md transition-all active:scale-95 ${
                  isRed
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                }`}
              >
                {publishNowLabel}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="datetime" className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                {onPublishNow ? 'Option 2: Select Date & Time (Schedule for Later)' : 'Select Date & Time'}
              </label>
              <input
                type="datetime-local"
                id="datetime"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-5 py-2 text-sm font-bold text-white rounded-xl shadow transition-colors ${
                  isRed
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
