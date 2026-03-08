import AsyncStorage from '@react-native-async-storage/async-storage';

const REST_TIME_KEY = '@ptmaster_rest_time';
const ALARM_SETTINGS_KEY = '@ptmaster_alarm_settings';
const EXERCISE_REST_TIMES_KEY = '@ptmaster_exercise_rest_times';

export const DEFAULT_REST_TIME = 90;

// ── 기본 휴식 시간 ──────────────────────────────────────────
export async function loadRestTime(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(REST_TIME_KEY);
    return val ? parseInt(val, 10) : DEFAULT_REST_TIME;
  } catch {
    return DEFAULT_REST_TIME;
  }
}

export async function saveRestTime(seconds: number): Promise<void> {
  await AsyncStorage.setItem(REST_TIME_KEY, String(seconds));
}

// ── 알람 설정 ────────────────────────────────────────────────
export type AlarmType = 'vibration' | 'sound' | 'both' | 'none';
export type VibrationPattern = 'short' | 'medium' | 'long';
export type SoundType = 'beep' | 'bell' | 'chime';

export interface AlarmSettings {
  alarmType: AlarmType;
  vibrationPattern: VibrationPattern;
  soundType: SoundType;
}

export const DEFAULT_ALARM_SETTINGS: AlarmSettings = {
  alarmType: 'vibration',
  vibrationPattern: 'medium',
  soundType: 'bell',
};

export async function loadAlarmSettings(): Promise<AlarmSettings> {
  try {
    const json = await AsyncStorage.getItem(ALARM_SETTINGS_KEY);
    return json
      ? { ...DEFAULT_ALARM_SETTINGS, ...JSON.parse(json) }
      : DEFAULT_ALARM_SETTINGS;
  } catch {
    return DEFAULT_ALARM_SETTINGS;
  }
}

export async function saveAlarmSettings(settings: AlarmSettings): Promise<void> {
  await AsyncStorage.setItem(ALARM_SETTINGS_KEY, JSON.stringify(settings));
}

// ── 운동별 개별 휴식 시간 ─────────────────────────────────────
// null = 기본값 사용, number = 해당 운동 전용 시간(초)
export type ExerciseRestTimes = Record<string, number | null>;

export async function loadExerciseRestTimes(): Promise<ExerciseRestTimes> {
  try {
    const json = await AsyncStorage.getItem(EXERCISE_REST_TIMES_KEY);
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

export async function saveExerciseRestTime(
  exerciseId: string,
  seconds: number | null,
): Promise<void> {
  const times = await loadExerciseRestTimes();
  if (seconds === null) {
    delete times[exerciseId];
  } else {
    times[exerciseId] = seconds;
  }
  await AsyncStorage.setItem(EXERCISE_REST_TIMES_KEY, JSON.stringify(times));
}
