/**
 * 알람 실행 헬퍼
 *
 * [소리 지원 안내]
 * 현재 소리 알람은 expo-av 패키지가 필요합니다.
 * 설치: npx expo install expo-av
 * 설치 후 아래 TODO 주석 코드를 활성화하면 실제 소리가 재생됩니다.
 * 설치 전까지는 소리 타입별로 서로 다른 진동 패턴으로 대체됩니다.
 */
import { Vibration, Platform } from 'react-native';
import { AlarmSettings, VibrationPattern, SoundType } from '../storage/settingsStorage';

// ── 진동 패턴 정의 ──────────────────────────────────────────────
// [대기, 진동, 간격, 진동, ...]
const VIBRATION_PATTERNS: Record<VibrationPattern, number[]> = {
  once:   [0, 500],
  twice:  [0, 500, 300, 500],
  thrice: [0, 500, 300, 500, 300, 500],
};

// 소리 타입별 대체 진동 패턴
const SOUND_VIBRATION_SUBS: Record<SoundType, number[]> = {
  beep:  [0, 80, 40, 80, 40, 80],
  bell:  [0, 120, 60, 500],
  chime: [0, 100, 60, 150, 60, 250, 60, 500],
};

function vibrate(pattern: number[]) {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'ios') {
    // iOS는 패턴 진동 미지원 → 단발 Vibration으로 대체
    const vibeCount = Math.floor(pattern.filter((_, i) => i % 2 === 1).length);
    Vibration.vibrate();
    for (let i = 1; i < vibeCount; i++) {
      setTimeout(() => Vibration.vibrate(), i * 800);
    }
  } else {
    Vibration.vibrate(pattern);
  }
}

export function fireAlarm(settings: AlarmSettings): void {
  const { alarmType, vibrationPattern, soundType } = settings;

  if (alarmType === 'none') return;

  if (alarmType === 'vibration') {
    vibrate(VIBRATION_PATTERNS[vibrationPattern]);
    return;
  }

  if (alarmType === 'sound' || alarmType === 'both') {
    // TODO: expo-av 설치 후 아래 코드 활성화
    // ─────────────────────────────────────────────────────────
    // import { Audio } from 'expo-av';
    // const SOUND_FILES = {
    //   beep:  require('../../assets/sounds/beep.mp3'),
    //   bell:  require('../../assets/sounds/bell.mp3'),
    //   chime: require('../../assets/sounds/chime.mp3'),
    // };
    // (async () => {
    //   const { sound } = await Audio.Sound.createAsync(SOUND_FILES[soundType]);
    //   await sound.playAsync();
    //   sound.setOnPlaybackStatusUpdate((s) => { if (s.isLoaded && s.didJustFinish) sound.unloadAsync(); });
    // })();
    // ─────────────────────────────────────────────────────────

    // 현재: 소리 타입별 진동으로 대체
    vibrate(SOUND_VIBRATION_SUBS[soundType]);
  }

  if (alarmType === 'both') {
    // 진동도 함께 (약간 딜레이 후)
    setTimeout(
      () => vibrate(VIBRATION_PATTERNS[vibrationPattern]),
      Platform.OS === 'android' ? 700 : 400,
    );
  }
}
