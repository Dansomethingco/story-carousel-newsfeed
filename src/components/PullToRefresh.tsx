import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useCapacitor } from '@/hooks/useMobile';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isNative, triggerHaptic } = useCapacitor();

  const threshold = 80;

  const handleTouchStart = (e: TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!containerRef.current) return;
    
    const currentY = e.touches[0].clientY;
    const scrollTop = containerRef.current.scrollTop;
    
    if (scrollTop === 0 && currentY > startY.current) {
      const distance = Math.min(currentY - startY.current, threshold * 1.5);
      setPullDistance(distance);
      setIsPulling(distance > 10);
      
      if (distance > threshold && !isRefreshing) {
        triggerHaptic();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > threshold && !isRefreshing) {
      setIsRefreshing(true);
      triggerHaptic();
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setIsPulling(false);
    setPullDistance(0);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isNative) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, isNative]);

  const refreshIconRotation = isRefreshing ? 360 : pullDistance > threshold ? 180 : 0;

  return (
    <div ref={containerRef} className="relative h-full overflow-auto">
      {/* Pull to refresh indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex justify-center items-center z-10"
        initial={{ opacity: 0, y: -50 }}
        animate={{ 
          opacity: isPulling || isRefreshing ? 1 : 0,
          y: isPulling || isRefreshing ? pullDistance / 2 : -50
        }}
        transition={{ duration: 0.2 }}
      >
        <div className="bg-background/90 backdrop-blur-sm rounded-full p-3 shadow-lg border">
          <motion.div
            animate={{ rotate: refreshIconRotation }}
            transition={{ duration: isRefreshing ? 1 : 0.3, repeat: isRefreshing ? Infinity : 0 }}
          >
            <RefreshCw className="w-5 h-5 text-primary" />
          </motion.div>
        </div>
      </motion.div>

      {/* Content with transform */}
      <motion.div
        animate={{ y: isPulling ? pullDistance * 0.5 : 0 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </div>
  );
};