import { useEffect, useRef, useState } from "react";

export function useStudyTimer(isFinished: boolean, initial = 0) {
  const [studyTime, setStudyTime] = useState(initial);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now() - initial * 1000);

  useEffect(() => {
    if (!isFinished && timerRef.current === null) {
      timerRef.current = window.setInterval(() => {
        const diff = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setStudyTime(diff);
      }, 1000);
    }
    if (isFinished && timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current != null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isFinished]);

  function setFromLoaded(time: number, startTime?: number) {
    setStudyTime(time);
    startTimeRef.current = startTime ?? Date.now() - time * 1000;
  }

  return { studyTime, setFromLoaded, startTimeRef } as const;
}
