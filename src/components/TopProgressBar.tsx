import React, { useEffect, useState } from 'react';

interface TopProgressBarProps {
  isLoading?: boolean;
}

export function TopProgressBar({ isLoading: externalLoading }: TopProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: any;
    let finishTimer: any;

    const handleStart = () => {
      setVisible(true);
      setProgress(15);
      clearInterval(timer);
      timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(timer);
            return 90;
          }
          return prev + Math.random() * 15;
        });
      }, 200);
    };

    const handleDone = () => {
      setProgress(100);
      clearInterval(timer);
      finishTimer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 350);
    };

    // Listen to global trigger events
    window.addEventListener('wayahe_loading_start', handleStart);
    window.addEventListener('wayahe_loading_done', handleDone);

    if (externalLoading) {
      handleStart();
    } else if (visible && !externalLoading) {
      handleDone();
    }

    return () => {
      clearInterval(timer);
      clearTimeout(finishTimer);
      window.removeEventListener('wayahe_loading_start', handleStart);
      window.removeEventListener('wayahe_loading_done', handleDone);
    };
  }, [externalLoading]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none h-[3px] bg-black/20">
      <div
        className="h-full top-progress-bar transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      >
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-white/40 blur-[2px] animate-pulse" />
      </div>
    </div>
  );
}

// Global helpers to trigger the top progress bar easily anywhere in the app
export const triggerTopLoading = {
  start: () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wayahe_loading_start'));
    }
  },
  done: () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wayahe_loading_done'));
    }
  },
};
