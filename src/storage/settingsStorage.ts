import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

export const DEFAULT_REST_TIME = 90;

export type AlarmType = 'vibration' | 'sound' | 'both' | 'none';
export type VibrationPattern = 'once' | 'twice' | 'thrice';
export type SoundType = 'beep' | 'bell' | 'chime';

export interface AlarmSettings {
  alarmType: AlarmType;
  vibrationPattern: VibrationPattern;
  soundType: SoundType;
}

export const DEFAULT_ALARM_SETTINGS: AlarmSettings = {
  alarmType: 'vibration',
  vibrationPattern: 'twice',
  soundType: 'bell',
};

export type ExerciseRestTimes = Record<string, number | null>;
export type CustomAlternatives = Record<string, string[]>;

/**
 * 유저별 설정 문서 참조 반환
 */
function getSettingsRef(uid: string) {
  return doc(db, 'users', uid, 'config', 'settings');
}

// ── 기본 휴식 시간 ──────────────────────────────────────────
export async function loadRestTime(uid: string): Promise<number> {
  if (!uid) return DEFAULT_REST_TIME;
  try {
    const snap = await getDoc(getSettingsRef(uid));
    return snap.exists() ? (snap.data().restTime ?? DEFAULT_REST_TIME) : DEFAULT_REST_TIME;
  } catch (error: any) {
    if (error.code !== 'unavailable' && !error.message.includes('offline')) {
      console.error('Error loading rest time:', error);
    }
    return DEFAULT_REST_TIME;
  }
}

export async function saveRestTime(uid: string, seconds: number): Promise<void> {
  if (!uid) return;
  await setDoc(getSettingsRef(uid), { restTime: seconds }, { merge: true });
}

// ── 알람 설정 ────────────────────────────────────────────────
export async function loadAlarmSettings(uid: string): Promise<AlarmSettings> {
  if (!uid) return DEFAULT_ALARM_SETTINGS;
  try {
    const snap = await getDoc(getSettingsRef(uid));
    return snap.exists() ? { ...DEFAULT_ALARM_SETTINGS, ...snap.data().alarmSettings } : DEFAULT_ALARM_SETTINGS;
  } catch (error: any) {
    if (error.code !== 'unavailable' && !error.message.includes('offline')) {
      console.error('Error loading alarm settings:', error);
    }
    return DEFAULT_ALARM_SETTINGS;
  }
}

export async function saveAlarmSettings(uid: string, settings: AlarmSettings): Promise<void> {
  if (!uid) return;
  await setDoc(getSettingsRef(uid), { alarmSettings: settings }, { merge: true });
}

// ── 운동별 개별 휴식 시간 ─────────────────────────────────────
export async function loadExerciseRestTimes(uid: string): Promise<ExerciseRestTimes> {
  if (!uid) return {};
  try {
    const snap = await getDoc(getSettingsRef(uid));
    return snap.exists() ? (snap.data().exerciseRestTimes ?? {}) : {};
  } catch (error: any) {
    if (error.code !== 'unavailable' && !error.message.includes('offline')) {
      console.error('Error loading exercise rest times:', error);
    }
    return {};
  }
}

export async function saveExerciseRestTime(
  uid: string,
  exerciseId: string,
  seconds: number | null,
): Promise<void> {
  if (!uid) return;
  const times = await loadExerciseRestTimes(uid);
  if (seconds === null) {
    delete times[exerciseId];
  } else {
    times[exerciseId] = seconds;
  }
  await setDoc(getSettingsRef(uid), { exerciseRestTimes: times }, { merge: true });
}

// ── 대체운동 커스터마이징 ──────────────────────────────────────
export async function loadCustomAlternatives(uid: string): Promise<CustomAlternatives> {
  if (!uid) return {};
  try {
    const snap = await getDoc(getSettingsRef(uid));
    return snap.exists() ? (snap.data().customAlternatives ?? {}) : {};
  } catch (error: any) {
    if (error.code !== 'unavailable' && !error.message.includes('offline')) {
      console.error('Error loading custom alternatives:', error);
    }
    return {};
  }
}

export async function saveCustomAlternatives(uid: string, data: CustomAlternatives): Promise<void> {
  if (!uid) return;
  await setDoc(getSettingsRef(uid), { customAlternatives: data }, { merge: true });
}
