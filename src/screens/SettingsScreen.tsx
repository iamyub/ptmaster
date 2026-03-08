import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  loadRestTime,
  saveRestTime,
  loadAlarmSettings,
  saveAlarmSettings,
  loadExerciseRestTimes,
  saveExerciseRestTime,
  AlarmSettings,
  AlarmType,
  VibrationPattern,
  SoundType,
  ExerciseRestTimes,
  DEFAULT_ALARM_SETTINGS,
} from '../storage/settingsStorage';
import { fireAlarm } from '../utils/alarmHelper';
import { DEFAULT_EXERCISES } from '../utils/exercises';

// ── 상수 ─────────────────────────────────────────────────────
const REST_TIME_OPTIONS = [30, 60, 90, 120, 180];
const EXERCISE_REST_OPTIONS: (number | null)[] = [null, 30, 60, 90, 120, 180];

const ALARM_TYPE_OPTIONS: { key: AlarmType; label: string; icon: string }[] = [
  { key: 'vibration', label: '진동', icon: 'phone-portrait-outline' },
  { key: 'sound', label: '소리', icon: 'musical-note-outline' },
  { key: 'both', label: '소리+진동', icon: 'volume-high-outline' },
  { key: 'none', label: '없음', icon: 'notifications-off-outline' },
];

const VIBRATION_PATTERN_OPTIONS: { key: VibrationPattern; label: string; desc: string }[] = [
  { key: 'short', label: '짧게', desc: '한 번 짧게' },
  { key: 'medium', label: '보통', desc: '두 번 연속' },
  { key: 'long', label: '길게', desc: '강하게 두 번' },
];

const SOUND_TYPE_OPTIONS: { key: SoundType; label: string; desc: string }[] = [
  { key: 'beep', label: '삐 (Beep)', desc: '짧은 세 번 삐' },
  { key: 'bell', label: '벨 (Bell)', desc: '잔잔한 벨 소리' },
  { key: 'chime', label: '차임 (Chime)', desc: '리드미컬한 차임' },
];

function formatRestLabel(s: number | null): string {
  if (s === null) return '기본값';
  if (s < 60) return `${s}초`;
  if (s % 60 === 0) return `${s / 60}분`;
  return `${Math.floor(s / 60)}분 ${s % 60}초`;
}

// ── 공통 컴포넌트 ─────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function RowLabel({ icon, title, desc }: { icon: string; title: string; desc?: string }) {
  return (
    <View style={styles.rowLabel}>
      <Ionicons name={icon as any} size={18} color="#4F8EF7" />
      <View style={styles.rowLabelText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {desc ? <Text style={styles.rowDesc}>{desc}</Text> : null}
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

// ── 메인 화면 ─────────────────────────────────────────────────
export default function SettingsScreen() {
  const [restTime, setRestTime] = useState(90);
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [exerciseRestTimes, setExerciseRestTimes] = useState<ExerciseRestTimes>({});
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        loadRestTime(),
        loadAlarmSettings(),
        loadExerciseRestTimes(),
      ]).then(([rt, alarm, exTimes]) => {
        setRestTime(rt);
        setAlarmSettings(alarm);
        setExerciseRestTimes(exTimes);
      });
    }, []),
  );

  // ── 기본 휴식시간 ──
  const handleRestTime = async (sec: number) => {
    setRestTime(sec);
    await saveRestTime(sec);
  };

  // ── 알람 설정 ──
  const updateAlarm = async (patch: Partial<AlarmSettings>) => {
    const updated = { ...alarmSettings, ...patch };
    setAlarmSettings(updated);
    await saveAlarmSettings(updated);
  };

  // 진동 패턴 선택 + 즉시 진동 미리보기
  const handleVibrationPattern = async (pattern: VibrationPattern) => {
    await updateAlarm({ vibrationPattern: pattern });
    fireAlarm({ ...alarmSettings, vibrationPattern: pattern, alarmType: 'vibration' });
  };

  // ── 운동별 개별 휴식시간 ──
  const handleExerciseRestTime = async (exerciseId: string, sec: number | null) => {
    const updated = { ...exerciseRestTimes };
    if (sec === null) {
      delete updated[exerciseId];
    } else {
      updated[exerciseId] = sec;
    }
    setExerciseRestTimes(updated);
    await saveExerciseRestTime(exerciseId, sec);
    setExpandedExerciseId(null);
  };

  const showVibrationSettings =
    alarmSettings.alarmType === 'vibration' || alarmSettings.alarmType === 'both';
  const showSoundSettings =
    alarmSettings.alarmType === 'sound' || alarmSettings.alarmType === 'both';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ════════════════ 휴식 시간 설정 ════════════════ */}
      <SectionHeader title="휴식 시간 설정" />
      <View style={styles.card}>

        {/* 기본 휴식시간 */}
        <RowLabel
          icon="timer-outline"
          title="기본 휴식 시간"
          desc="세트 완료 후 자동으로 시작되는 타이머"
        />
        <View style={styles.chips}>
          {REST_TIME_OPTIONS.map((sec) => (
            <TouchableOpacity
              key={sec}
              style={[styles.chip, restTime === sec && styles.chipActive]}
              onPress={() => handleRestTime(sec)}
            >
              <Text style={[styles.chipText, restTime === sec && styles.chipTextActive]}>
                {formatRestLabel(sec)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.currentRow}>
          <Ionicons name="checkmark-circle" size={14} color="#34C759" />
          <Text style={styles.currentText}>현재: {formatRestLabel(restTime)} ({restTime}초)</Text>
        </View>

        <Divider />

        {/* 운동별 개별 휴식시간 */}
        <RowLabel
          icon="barbell-outline"
          title="운동별 개별 휴식 시간"
          desc="운동마다 다른 휴식시간을 설정할 수 있어요"
        />
        <View style={styles.exerciseRestList}>
          {DEFAULT_EXERCISES.map((ex) => {
            const customTime = exerciseRestTimes[ex.id];
            const hasCustom = customTime != null;
            const isExpanded = expandedExerciseId === ex.id;

            return (
              <View key={ex.id} style={styles.exRestItem}>
                <TouchableOpacity
                  style={styles.exRestRow}
                  onPress={() => setExpandedExerciseId(isExpanded ? null : ex.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.exRestName}>{ex.name}</Text>
                  <View style={[styles.exRestBadge, hasCustom && styles.exRestBadgeActive]}>
                    <Ionicons
                      name="timer-outline"
                      size={11}
                      color={hasCustom ? '#4F8EF7' : '#bbb'}
                    />
                    <Text style={[styles.exRestBadgeText, hasCustom && styles.exRestBadgeTextActive]}>
                      {hasCustom ? formatRestLabel(customTime) : '기본값'}
                    </Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={11}
                      color={hasCustom ? '#4F8EF7' : '#bbb'}
                    />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.exRestOptions}>
                    {EXERCISE_REST_OPTIONS.map((sec) => {
                      const isSelected =
                        sec === null ? !hasCustom : exerciseRestTimes[ex.id] === sec;
                      return (
                        <TouchableOpacity
                          key={String(sec)}
                          style={[styles.exRestOptBtn, isSelected && styles.exRestOptBtnActive]}
                          onPress={() => handleExerciseRestTime(ex.id, sec)}
                        >
                          <Text
                            style={[
                              styles.exRestOptText,
                              isSelected && styles.exRestOptTextActive,
                            ]}
                          >
                            {formatRestLabel(sec)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* ════════════════ 알림 설정 ════════════════ */}
      <SectionHeader title="알림 설정" />
      <View style={styles.card}>

        {/* 알람 유형 */}
        <RowLabel
          icon="notifications-outline"
          title="알람 유형"
          desc="휴식 시간 종료 시 알림 방식"
        />
        <View style={styles.chips}>
          {ALARM_TYPE_OPTIONS.map((o) => (
            <TouchableOpacity
              key={o.key}
              style={[styles.chip, alarmSettings.alarmType === o.key && styles.chipActive]}
              onPress={() => updateAlarm({ alarmType: o.key })}
            >
              <Ionicons
                name={o.icon as any}
                size={13}
                color={alarmSettings.alarmType === o.key ? '#4F8EF7' : '#888'}
              />
              <Text
                style={[
                  styles.chipText,
                  alarmSettings.alarmType === o.key && styles.chipTextActive,
                ]}
              >
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 소리 안내 */}
        {showSoundSettings && (
          <View style={styles.noticeRow}>
            <Ionicons name="information-circle-outline" size={14} color="#F5A623" />
            <Text style={styles.noticeText}>
              소리 기능은 expo-av 설치 후 활성화됩니다. 현재는 패턴별 진동으로 대체됩니다.
            </Text>
          </View>
        )}

        {/* 진동 패턴 */}
        {showVibrationSettings && (
          <>
            <Divider />
            <RowLabel
              icon="phone-portrait-outline"
              title="진동 패턴"
              desc="버튼을 누르면 해당 패턴을 바로 느껴볼 수 있어요"
            />
            <View style={styles.chips}>
              {VIBRATION_PATTERN_OPTIONS.map((o) => {
                const isActive = alarmSettings.vibrationPattern === o.key;
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[styles.chip, styles.vibrateChip, isActive && styles.chipActive]}
                    onPress={() => handleVibrationPattern(o.key)}
                  >
                    <Ionicons
                      name="pulse-outline"
                      size={13}
                      color={isActive ? '#4F8EF7' : '#888'}
                    />
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.patternDesc}>
              {
                VIBRATION_PATTERN_OPTIONS.find(
                  (o) => o.key === alarmSettings.vibrationPattern,
                )?.desc
              }
              {' '}— 버튼을 눌러 진동을 미리 체험해보세요
            </Text>
          </>
        )}

        {/* 소리 종류 */}
        {showSoundSettings && (
          <>
            <Divider />
            <RowLabel icon="musical-note-outline" title="소리 종류" desc="알람 벨 종류" />
            <View style={styles.chips}>
              {SOUND_TYPE_OPTIONS.map((o) => (
                <TouchableOpacity
                  key={o.key}
                  style={[
                    styles.chip,
                    alarmSettings.soundType === o.key && styles.chipActive,
                  ]}
                  onPress={() => updateAlarm({ soundType: o.key })}
                >
                  <Text
                    style={[
                      styles.chipText,
                      alarmSettings.soundType === o.key && styles.chipTextActive,
                    ]}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.patternDesc}>
              {SOUND_TYPE_OPTIONS.find((o) => o.key === alarmSettings.soundType)?.desc}
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { padding: 16, paddingBottom: 48 },

  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },

  rowLabel: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  rowLabelText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  rowDesc: { fontSize: 11, color: '#999', marginTop: 2 },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 16 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F0F2F5',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  vibrateChip: { paddingHorizontal: 16 },
  chipActive: { backgroundColor: '#EEF4FF', borderColor: '#4F8EF7' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#888' },
  chipTextActive: { color: '#4F8EF7' },

  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  currentText: { fontSize: 12, color: '#666' },

  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  noticeText: { flex: 1, fontSize: 11, color: '#886600', lineHeight: 16 },

  patternDesc: { fontSize: 11, color: '#999', marginTop: 2 },

  // 운동별 개별 휴식시간 목록
  exerciseRestList: { gap: 2 },
  exRestItem: { borderRadius: 8, overflow: 'hidden' },
  exRestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F6FA',
  },
  exRestName: { fontSize: 14, color: '#333', fontWeight: '500', flex: 1 },
  exRestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F0F2F5',
  },
  exRestBadgeActive: { backgroundColor: '#EEF4FF' },
  exRestBadgeText: { fontSize: 11, color: '#bbb', fontWeight: '600' },
  exRestBadgeTextActive: { color: '#4F8EF7' },
  exRestOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 10,
    backgroundColor: '#F8FAFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  exRestOptBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  exRestOptBtnActive: { backgroundColor: '#EEF4FF', borderColor: '#4F8EF7' },
  exRestOptText: { fontSize: 12, fontWeight: '600', color: '#888' },
  exRestOptTextActive: { color: '#4F8EF7' },
});
