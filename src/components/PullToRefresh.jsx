import React, { useState, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

export default function PullToRefresh({ children, onRefresh }) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);

  const handleTouchStart = useCallback((e) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (window.scrollY === 0) {
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 60) setPulling(true);
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (pulling && !refreshing) {
      setRefreshing(true);
      setPulling(false);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
      }
    } else {
      setPulling(false);
    }
  }, [pulling, refreshing, onRefresh]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pulling || refreshing) && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      )}
      {children}
    </div>
  );
}
