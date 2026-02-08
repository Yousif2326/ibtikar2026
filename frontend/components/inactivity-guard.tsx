'use client';

import * as React from 'react';

interface InactivityGuardProps {
  /** Minutes of inactivity before triggering timeout */
  timeoutMinutes: number;
  /** Callback when timeout fires (should sign user out) */
  onTimeout: () => void;
  children: React.ReactNode;
}

/**
 * HIPAA-compliant inactivity auto-logout.
 * Monitors mouse, keyboard, touch, and scroll events.
 * After `timeoutMinutes` of no activity, calls `onTimeout` (signs the user out).
 * Shows a warning banner 2 minutes before timeout.
 */
export function InactivityGuard({
  timeoutMinutes,
  onTimeout,
  children,
}: InactivityGuardProps) {
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = Math.max(timeoutMs - 2 * 60 * 1000, timeoutMs * 0.5);

  const [showWarning, setShowWarning] = React.useState(false);
  const [remainingSeconds, setRemainingSeconds] = React.useState(0);

  const lastActivityRef = React.useRef(Date.now());
  const timeoutIdRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const warningIdRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const countdownIdRef = React.useRef<ReturnType<typeof setInterval>>(undefined);

  const resetTimer = React.useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);

    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    if (warningIdRef.current) clearTimeout(warningIdRef.current);
    if (countdownIdRef.current) clearInterval(countdownIdRef.current);

    warningIdRef.current = setTimeout(() => {
      setShowWarning(true);
      const endTime = lastActivityRef.current + timeoutMs;
      countdownIdRef.current = setInterval(() => {
        const left = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        setRemainingSeconds(left);
        if (left <= 0) {
          clearInterval(countdownIdRef.current);
        }
      }, 1000);
    }, warningMs);

    timeoutIdRef.current = setTimeout(() => {
      onTimeout();
    }, timeoutMs);
  }, [timeoutMs, warningMs, onTimeout]);

  React.useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    const handler = () => resetTimer();

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      if (warningIdRef.current) clearTimeout(warningIdRef.current);
      if (countdownIdRef.current) clearInterval(countdownIdRef.current);
    };
  }, [resetTimer]);

  return (
    <>
      {showWarning && (
        <div className="fixed inset-x-0 top-0 z-50 bg-destructive/90 px-4 py-2 text-center text-sm text-white">
          Session will expire due to inactivity in{' '}
          <strong>{remainingSeconds}s</strong>. Move your mouse or press a key
          to stay signed in.
        </div>
      )}
      {children}
    </>
  );
}
