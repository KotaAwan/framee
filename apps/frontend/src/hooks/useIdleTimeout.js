import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/auth.store';

/**
 * Hook to detect user inactivity and lock the session.
 * @param {number} timeoutMs - Inactivity duration before locking (default: 5 minutes)
 */
export function useIdleTimeout(timeoutMs = 5 * 60 * 1000) {
  const { isAuthenticated, isLocked, lockSession } = useAuthStore();
  const timeoutRef = useRef(null);

  const handleActivity = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Only reset timer if user is authenticated and not already locked
    if (isAuthenticated && !isLocked) {
      timeoutRef.current = setTimeout(() => {
        lockSession();
      }, timeoutMs);
    }
  }, [isAuthenticated, isLocked, lockSession, timeoutMs]);

  useEffect(() => {
    // Only bind events if user is authenticated and not locked
    if (!isAuthenticated || isLocked) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const events = ['mousemove', 'keydown', 'wheel', 'touchstart', 'click'];
    
    events.forEach((event) => window.addEventListener(event, handleActivity));
    
    // Initial timer start
    handleActivity();

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isAuthenticated, isLocked, timeoutMs]);
}
