import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { storageGet, storageSet } from '../utils/storage';

// ── 타입 ────────────────────────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeColors {
  background: string;
  card: string;
  cardAlt: string;
  text: string;
  textSub: string;
  textMuted: string;
  border: string;
  inputBg: string;
  primary: string;
  primaryBg: string;
  destructive: string;
  destructiveBg: string;
  success: string;
  timerBg: string;
  segmentBg: string;
  chipBg: string;
}

export interface ThemeSettings {
  mode: ThemeMode;
  dayStartHour: number;   // 주간 시작 (기본 6)
  nightStartHour: number; // 야간 시작 (기본 22)
}

// ── 색상 팔레트 ───────────────────────────────────────────────
const LIGHT: ThemeColors = {
  background: '#F5F6FA',
  card: '#FFFFFF',
  cardAlt: '#F8FAFF',
  text: '#1A1A2E',
  textSub: '#888888',
  textMuted: '#BBBBBB',
  border: '#F0F0F0',
  inputBg: '#F5F6FA',
  primary: '#4F8EF7',
  primaryBg: '#EEF4FF',
  destructive: '#FF5C5C',
  destructiveBg: '#FFF0F0',
  success: '#34C759',
  timerBg: '#2C3E50',
  segmentBg: '#E8EAF0',
  chipBg: '#F0F2F5',
};

const DARK: ThemeColors = {
  background: '#0D0D1A',
  card: '#1A1A2E',
  cardAlt: '#1E2038',
  text: '#E8E8FF',
  textSub: '#9090B0',
  textMuted: '#555575',
  border: '#2A2A45',
  inputBg: '#1E1E35',
  primary: '#4F8EF7',
  primaryBg: '#1A2040',
  destructive: '#FF6B6B',
  destructiveBg: '#2A1525',
  success: '#34C759',
  timerBg: '#080814',
  segmentBg: '#1A1A30',
  chipBg: '#1E1E35',
};

// ── 스토리지 키 ──────────────────────────────────────────────
const THEME_KEY = '@ptmaster_theme_settings';

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  mode: 'light',
  dayStartHour: 6,
  nightStartHour: 22,
};

export async function loadThemeSettings(): Promise<ThemeSettings> {
  try {
    const json = await storageGet(THEME_KEY);
    return json ? { ...DEFAULT_THEME_SETTINGS, ...JSON.parse(json) } : DEFAULT_THEME_SETTINGS;
  } catch {
    return DEFAULT_THEME_SETTINGS;
  }
}

export async function saveThemeSettings(settings: ThemeSettings): Promise<void> {
  await storageSet(THEME_KEY, JSON.stringify(settings));
}

// ── 현재 테마 계산 ────────────────────────────────────────────
function resolveIsDark(settings: ThemeSettings): boolean {
  if (settings.mode === 'dark') return true;
  if (settings.mode === 'light') return false;
  // auto: 현재 시각 기준
  const hour = new Date().getHours();
  const { dayStartHour, nightStartHour } = settings;
  if (dayStartHour < nightStartHour) {
    return hour < dayStartHour || hour >= nightStartHour;
  } else {
    // 야간 시작이 다음날 넘어가는 경우
    return hour >= nightStartHour || hour < dayStartHour;
  }
}

// ── Context ──────────────────────────────────────────────────
interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  settings: ThemeSettings;
  updateSettings: (patch: Partial<ThemeSettings>) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: LIGHT,
  isDark: false,
  settings: DEFAULT_THEME_SETTINGS,
  updateSettings: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_THEME_SETTINGS);
  const [isDark, setIsDark] = useState(false);

  // 초기 로드
  useEffect(() => {
    loadThemeSettings().then((s) => {
      setSettings(s);
      setIsDark(resolveIsDark(s));
    });
  }, []);

  // auto 모드일 때 1분마다 체크
  useEffect(() => {
    if (settings.mode !== 'auto') return;
    const id = setInterval(() => {
      setIsDark(resolveIsDark(settings));
    }, 60_000);
    return () => clearInterval(id);
  }, [settings]);

  const updateSettings = useCallback(async (patch: Partial<ThemeSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setIsDark(resolveIsDark(next));
    await saveThemeSettings(next);
  }, [settings]);

  const colors = isDark ? DARK : LIGHT;

  return (
    <ThemeContext.Provider value={{ colors, isDark, settings, updateSettings }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
