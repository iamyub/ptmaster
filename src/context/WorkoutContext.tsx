import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS } from '../storage/settingsStorage';
import { fireAlarm } from '../utils/alarmHelper';

export interface ActiveWorkout {
  workoutId: string;
  workoutName: string;
  completedSets: number;
  totalSets: number;
}

interface WorkoutContextValue {
  activeWorkout: ActiveWorkout | null;
  timerActive: boolean;
  timerSeconds: number;
  timerDuration: number;
  initWorkout: (info: ActiveWorkout, alarmSettings: AlarmSettings) => void;
  updateProgress: (completed: number, total: number) => void;
  startTimer: (duration: number) => void;
  skipTimer: () => void;
  resetTimer: () => void;
  adjustTimerSeconds: (delta: number) => void;
  endWorkout: () => void;
}

const WorkoutContext = createContext<WorkoutContextValue>({
  activeWorkout: null,
  timerActive: false,
  timerSeconds: 0,
  timerDuration: 90,
  initWorkout: () => {},
  updateProgress: () => {},
  startTimer: () => {},
  skipTimer: () => {},
  resetTimer: () => {},
  adjustTimerSeconds: () => {},
  endWorkout: () => {},
});

export const MINI_BAR_HEIGHT = 52;

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerDuration, setTimerDuration] = useState(90);
  const timerDurationRef = useRef(90);
  const alarmRef = useRef<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerDurationRef.current = timerDuration;
  }, [timerDuration]);

  // Global timer tick (runs even when WorkoutDetailScreen is unmounted)
  useEffect(() => {
    if (!timerActive) return;
    timerRef.current = setInterval(() => {
      setTimerSeconds((s) => {
        if (s <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setTimerActive(false);
          fireAlarm(alarmRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timerActive]);

  const initWorkout = useCallback((info: ActiveWorkout, alarmSettings: AlarmSettings) => {
    alarmRef.current = alarmSettings;
    setActiveWorkout((prev) => {
      if (prev?.workoutId === info.workoutId) {
        return { ...prev, completedSets: info.completedSets, totalSets: info.totalSets };
      }
      return info;
    });
  }, []);

  const updateProgress = useCallback((completed: number, total: number) => {
    setActiveWorkout((prev) => (prev ? { ...prev, completedSets: completed, totalSets: total } : null));
  }, []);

  const startTimer = useCallback((duration: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerDuration(duration);
    setTimerSeconds(duration);
    setTimerActive(true);
  }, []);

  const skipTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerActive(false);
    setTimerSeconds(0);
  }, []);

  const resetTimer = useCallback(() => {
    const dur = timerDurationRef.current;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerSeconds(dur);
    setTimerActive(true);
  }, []);

  const adjustTimerSeconds = useCallback((delta: number) => {
    setTimerSeconds((s) => Math.max(0, s + delta));
  }, []);

  const endWorkout = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerActive(false);
    setTimerSeconds(0);
    setTimerDuration(90);
    setActiveWorkout(null);
  }, []);

  return (
    <WorkoutContext.Provider
      value={{
        activeWorkout,
        timerActive,
        timerSeconds,
        timerDuration,
        initWorkout,
        updateProgress,
        startTimer,
        skipTimer,
        resetTimer,
        adjustTimerSeconds,
        endWorkout,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  return useContext(WorkoutContext);
}
