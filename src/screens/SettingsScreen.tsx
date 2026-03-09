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
import { useTheme, ThemeMode } from '../context/ThemeContext';

// ── 상수 ────────────────────────────────────────────────────
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

const THEME_MODE_OPTIONS: { key: ThemeMode; label: string; icon: string; desc: string }[] = [
  { key: 'light', label: '라이트', icon: 'sunny-outline', desc: '항상 밝게' },
  { key: 'dark',  label: '다크',   icon: 'moon-outline',  desc: '항상 어둡게' },
  { key: 'auto',  label: '자동',   icon: 'time-outline',  desc: '시간대별 자동' },
];

// 자동 모드 시간 옵션 (0~23시)
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

function formatRestLabel(s: number | null): string {
  if (s === null) return '기본값';
  if (s < 60) return `${s}초`;
  if (s % 60 === 0) return `${s / 60}분`;
  return `${Math.floor(s / 60)}분 ${s % 60}초`;
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

// ── 공통 컴포넌트 ────────────────────────────────────────────
function SectionHeader({ title, color }: { title: string; color: string }) {
  return <Text style={[styles.sectionHeader, { color }]}>{title}</Text>;
}

function RowLabel({ icon, title, desc, color, subColor }: { icon: string; title: string; desc?: string; color: string; subColor: string }) {
  return (
    <View style={styles.rowLabel}>
      <Ionicons name={icon as any} size={18} color="#4F8EF7" />
      <View style={styles.rowLabelText}>
        <Text style={[styles.rowTitle, { color }]}>{title}</Text>
        {desc ? <Text style={[styles.rowDesc, { color: subColor }]}>{desc}</Text> : null}
      </View>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

// ── 메인 화면 ────────────────────────────────────────────────
export default function SettingsScreen() {
  const { colors, settings: themeSettings, updateSettings: updateTheme } = useTheme();

  const [restTime, setRestTime] = useState(90);
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [exerciseRestTimes, setExerciseRestTimes] = useState<ExerciseRestTimes>({});
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [isExRestExpanded, setIsExRestExpanded] = useState(false);

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

  // 기본 휴식시간
  const handleRestTime = async (sec: number) => {
    setRestTime(sec);
    await saveRestTime(sec);
  };

  // 알람 설정
  const updateAlarm = async (patch: Partial<AlarmSettings>) => {
    const updated = { ...alarmSettings, ...patch };
    setAlarmSettings(updated);
    await saveAlarmSettings(updated);
  };

  const handleVibrationPattern = async (pattern: VibrationPattern) => {
    await updateAlarm({ vibrationPattern: pattern });
    fireAlarm({ ...alarmSettings, vibrationPattern: pattern, alarmType: 'vibration' });
  };

  // 운동별 개별 휴식시간
  const handleExerciseRestTime = async (exerciseId: string, sec: number | null) => {
    const updated = { ...exerciseRestTimes };
    if (sec === null) { delete updated[exerciseId]; } else { updated[exerciseId] = sec; }
    setExerciseRestTimes(updated);
    await saveExerciseRestTime(exerciseId, sec);
    setExpandedExerciseId(null);
  };

  const showVibrationSettings = alarmSettings.alarmType === 'vibration' || alarmSettings.alarmType === 'both';
  const showSoundSettings = alarmSettings.alarmType === 'sound' || alarmSettings.alarmType === 'both';

  const c = colors; // 단축 alias

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.background }]} contentContainerStyle={styles.content}>

      {/* ════ 화면 설정 ════ */}
      <SectionHeader title="화면 설정" color={c.textSub} />
      <View style={[styles.card, { backgroundColor: c.card }]}>
        <RowLabel icon="contrast-outline" title="화면 모드" desc="앱의 전체 색상 테마" color={c.text} subColor={c.textSub} />

        {/* 모드 선택 */}
        <View style={styles.chips}>
          {THEME_MODE_OPTIONS.map((o) => {
            const active = themeSettings.mode === o.key;
            return (
              <TouchableOpacity
                key={o.key}
                style={[
                  styles.chip,
                  { backgroundColor: active ? c.primaryBg : c.chipBg, borderColor: active ? c.primary : 'transparent' },
                ]}
                onPress={() => updateTheme({ mode: o.key })}
              >
                <Ionicons name={o.icon as any} size={14} color={active ? c.primary : c.textSub} />
                <View>
                  <Text style={[styles.chipText, { color: active ? c.primary : c.textSub }]}>{o.label}</Text>
                  <Text style={[styles.chipSubText, { color: active ? c.primary : c.textMuted }]}>{o.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 자동 모드: 시간대 설정 */}
        {themeSettings.mode === 'auto' && (
          <>
            <Divider color={c.border} />
            <RowLabel
              icon="sunny-outline"
              title="주간/야간 전환 시간"
              desc="설정한 시간에 맞춰 자동으로 테마가 전환됩니다"
              color={c.text}
              subColor={c.textSub}
            />

            {/* 주간 시작 */}
            <View style={styles.timeRow}>
              <Ionicons name="sunny" size={16} color="#F5A623" />
              <Text style={[styles.timeLabel, { color: c.text }]}>주간 시작</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourScroll}>
                {HOUR_OPTIONS.map((h) => {
                  const active = themeSettings.dayStartHour === h;
                  return (
                    <TouchableOpacity
                      key={h}
                      style={[
                        styles.hourChip,
                        { backgroundColor: active ? c.primary : c.chipBg },
                      ]}
                      onPress={() => updateTheme({ dayStartHour: h })}
                    >
                      <Text style={[styles.hourChipText, { color: active ? '#fff' : c.textSub }]}>
                        {formatHour(h)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 야간 시작 */}
            <View style={styles.timeRow}>
              <Ionicons name="moon" size={16} color="#7B6CF6" />
              <Text style={[styles.timeLabel, { color: c.text }]}>야간 시작</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourScroll}>
                {HOUR_OPTIONS.map((h) => {
                  const active = themeSettings.nightStartHour === h;
                  return (
                    <TouchableOpacity
                      key={h}
                      style={[
                        styles.hourChip,
                        { backgroundColor: active ? '#7B6CF6' : c.chipBg },
                      ]}
                      onPress={() => updateTheme({ nightStartHour: h })}
                    >
                      <Text style={[styles.hourChipText, { color: active ? '#fff' : c.textSub }]}>
                        {formatHour(h)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={[styles.autoModeInfo, { backgroundColor: c.cardAlt }]}>
              <Ionicons name="information-circle-outline" size={14} color={c.primary} />
              <Text style={[styles.autoModeInfoText, { color: c.textSub }]}>
                주간: {formatHour(themeSettings.dayStartHour)} ~ {formatHour(themeSettings.nightStartHour)}  ·  야간: {formatHour(themeSettings.nightStartHour)} ~ {formatHour(themeSettings.dayStartHour)}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* ════ 휴식 시간 설정 ════ */}
      <SectionHeader title="휴식 시간 설정" color={c.textSub} />
      <View style={[styles.card, { backgroundColor: c.card }]}>
        <RowLabel icon="timer-outline" title="기본 휴식 시간" desc="세트 완료 후 자동으로 시작되는 타이머" color={c.text} subColor={c.textSub} />
        <View style={styles.chips}>
          {REST_TIME_OPTIONS.map((sec) => (
            <TouchableOpacity
              key={sec}
              style={[styles.chip, { backgroundColor: restTime === sec ? c.primaryBg : c.chipBg, borderColor: restTime === sec ? c.primary : 'transparent' }]}
              onPress={() => handleRestTime(sec)}
            >
              <Text style={[styles.chipText, { color: restTime === sec ? c.primary : c.textSub }]}>
                {formatRestLabel(sec)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.currentRow}>
          <Ionicons name="checkmark-circle" size={14} color={c.success} />
          <Text style={[styles.currentText, { color: c.textSub }]}>현재: {formatRestLabel(restTime)} ({restTime}초)</Text>
        </View>

        <Divider color={c.border} />

        <TouchableOpacity
          style={styles.collapsibleHeader}
          onPress={() => setIsExRestExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <RowLabel icon="barbell-outline" title="운동별 개별 휴식 시간" desc="운동마다 다른 휴식시간을 설정할 수 있어요" color={c.text} subColor={c.textSub} />
          <Ionicons
            name={isExRestExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={c.textMuted}
            style={styles.collapsibleArrow}
          />
        </TouchableOpacity>

        {isExRestExpanded && (
        <View style={styles.exerciseRestList}>
          {DEFAULT_EXERCISES.map((ex) => {
            const customTime = exerciseRestTimes[ex.id];
            const hasCustom = customTime != null;
            const isExpanded = expandedExerciseId === ex.id;
            return (
              <View key={ex.id} style={styles.exRestItem}>
                <TouchableOpacity
                  style={[styles.exRestRow, { borderBottomColor: c.border }]}
                  onPress={() => setExpandedExerciseId(isExpanded ? null : ex.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.exRestName, { color: c.text }]}>{ex.name}</Text>
                  <View style={[styles.exRestBadge, { backgroundColor: hasCustom ? c.primaryBg : c.chipBg }]}>
                    <Ionicons name="timer-outline" size={11} color={hasCustom ? c.primary : c.textMuted} />
                    <Text style={[styles.exRestBadgeText, { color: hasCustom ? c.primary : c.textMuted }]}>
                      {hasCustom ? formatRestLabel(customTime) : '기본값'}
                    </Text>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={11} color={hasCustom ? c.primary : c.textMuted} />
                  </View>
                </TouchableOpacity>
                {isExpanded && (
                  <View style={[styles.exRestOptions, { backgroundColor: c.cardAlt, borderBottomColor: c.border }]}>
                    {EXERCISE_REST_OPTIONS.map((sec) => {
                      const isSelected = sec === null ? !hasCustom : exerciseRestTimes[ex.id] === sec;
                      return (
                        <TouchableOpacity
                          key={String(sec)}
                          style={[styles.exRestOptBtn, { backgroundColor: isSelected ? c.primaryBg : c.card, borderColor: isSelected ? c.primary : c.border }]}
                          onPress={() => handleExerciseRestTime(ex.id, sec)}
                        >
                          <Text style={[styles.exRestOptText, { color: isSelected ? c.primary : c.textSub }]}>
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
        )}
      </View>

      {/* ════ 알림 설정 ════ */}
      <SectionHeader title="알림 설정" color={c.textSub} />
      <View style={[styles.card, { backgroundColor: c.card }]}>
        <RowLabel icon="notifications-outline" title="알람 유형" desc="휴식 시간 종료 시 알림 방식" color={c.text} subColor={c.textSub} />
        <View style={styles.chips}>
          {ALARM_TYPE_OPTIONS.map((o) => {
            const active = alarmSettings.alarmType === o.key;
            return (
              <TouchableOpacity
                key={o.key}
                style={[styles.chip, { backgroundColor: active ? c.primaryBg : c.chipBg, borderColor: active ? c.primary : 'transparent' }]}
                onPress={() => updateAlarm({ alarmType: o.key })}
              >
                <Ionicons name={o.icon as any} size={13} color={active ? c.primary : c.textSub} />
                <Text style={[styles.chipText, { color: active ? c.primary : c.textSub }]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {showSoundSettings && (
          <View style={[styles.noticeRow, { backgroundColor: '#FFF8E1' }]}>
            <Ionicons name="information-circle-outline" size={14} color="#F5A623" />
            <Text style={styles.noticeText}>
              소리 기능은 expo-av 설치 후 활성화됩니다. 현재는 패턴별 진동으로 대체됩니다.
            </Text>
          </View>
        )}

        {showVibrationSettings && (
          <>
            <Divider color={c.border} />
            <RowLabel icon="phone-portrait-outline" title="진동 패턴" desc="버튼을 누르면 해당 패턴을 바로 느껴볼 수 있어요" color={c.text} subColor={c.textSub} />
            <View style={styles.chips}>
              {VIBRATION_PATTERN_OPTIONS.map((o) => {
                const active = alarmSettings.vibrationPattern === o.key;
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[styles.chip, styles.vibrateChip, { backgroundColor: active ? c.primaryBg : c.chipBg, borderColor: active ? c.primary : 'transparent' }]}
                    onPress={() => handleVibrationPattern(o.key)}
                  >
                    <Ionicons name="pulse-outline" size={13} color={active ? c.primary : c.textSub} />
                    <Text style={[styles.chipText, { color: active ? c.primary : c.textSub }]}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.patternDesc, { color: c.textSub }]}>
              {VIBRATION_PATTERN_OPTIONS.find((o) => o.key === alarmSettings.vibrationPattern)?.desc}
              {' '}— 버튼을 눌러 진동을 미리 체험해보세요
            </Text>
          </>
        )}

        {showSoundSettings && (
          <>
            <Divider color={c.border} />
            <RowLabel icon="musical-note-outline" title="소리 종류" desc="알람 벨 종류" color={c.text} subColor={c.textSub} />
            <View style={styles.chips}>
              {SOUND_TYPE_OPTIONS.map((o) => {
                const active = alarmSettings.soundType === o.key;
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[styles.chip, { backgroundColor: active ? c.primaryBg : c.chipBg, borderColor: active ? c.primary : 'transparent' }]}
                    onPress={() => updateAlarm({ soundType: o.key })}
                  >
                    <Text style={[styles.chipText, { color: active ? c.primary : c.textSub }]}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.patternDesc, { color: c.textSub }]}>
              {SOUND_TYPE_OPTIONS.find((o) => o.key === alarmSettings.soundType)?.desc}
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },

  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
  },

  card: {
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
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowDesc: { fontSize: 11, marginTop: 2 },

  divider: { height: 1, marginVertical: 16 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  vibrateChip: { paddingHorizontal: 14 },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipSubText: { fontSize: 10, fontWeight: '400' },

  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  currentText: { fontSize: 12 },

  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  noticeText: { flex: 1, fontSize: 11, color: '#886600', lineHeight: 16 },

  patternDesc: { fontSize: 11, marginTop: 2 },

  // 접힘/펼침
  collapsibleHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  collapsibleArrow: { marginTop: 2, marginLeft: 4 },

  // 운동별 휴식시간
  exerciseRestList: { gap: 2 },
  exRestItem: { borderRadius: 8, overflow: 'hidden' },
  exRestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  exRestName: { fontSize: 14, fontWeight: '500', flex: 1 },
  exRestBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  exRestBadgeText: { fontSize: 11, fontWeight: '600' },
  exRestOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10, borderBottomWidth: 1 },
  exRestOptBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5 },
  exRestOptText: { fontSize: 12, fontWeight: '600' },

  // 자동 모드 시간 설정
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  timeLabel: { fontSize: 13, fontWeight: '600', width: 60 },
  hourScroll: { flex: 1 },
  hourChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 6,
    minWidth: 52,
    alignItems: 'center',
  },
  hourChipText: { fontSize: 12, fontWeight: '600' },
  autoModeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  autoModeInfoText: { flex: 1, fontSize: 11, lineHeight: 16 },
});
