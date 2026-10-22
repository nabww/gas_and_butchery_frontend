import { useCallback, useEffect, useRef, useState } from 'react';

// Transient message that auto-hides after `duration` ms and also closes on
// any tap/click outside it. Attach `toastRef` to the toast element.
export function useToast(duration = 3000) {
  const [toast, setToast] = useState('');
  const toastRef = useRef(null);
  const timerRef = useRef(null);

  const hideToast = useCallback(() => {
    clearTimeout(timerRef.current);
    setToast('');
  }, []);

  const showToast = useCallback((message) => {
    clearTimeout(timerRef.current);
    setToast(message);
    timerRef.current = setTimeout(() => setToast(''), duration);
  }, [duration]);

  // Listener is attached after render, so the click that raised the toast
  // doesn't immediately dismiss it.
  useEffect(() => {
    if (!toast) return;
    const handlePointerDown = (e) => {
      if (!toastRef.current?.contains(e.target)) hideToast();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [toast, hideToast]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { toast, showToast, hideToast, toastRef };
}
