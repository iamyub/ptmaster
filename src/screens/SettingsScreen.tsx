import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
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
import { formatSeconds } from '../utils/timeFormat';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { authService } from '../services/authService';
import { useWorkout } from '../context/WorkoutContext';

// ── 상수 ────────────────────────────────────────────────────
const REST_SNAP_VALUES = [30, 60, 90, 120, 150, 180];
const EXERCISE_SNAP_VALUES = [30, 60, 90, 120, 150, 180]; // null(기본값)은 별도 토글

const ALARM_TYPE_OPTIONS: { key: AlarmType; label: string; icon: string }[] = [
  { key: 'vibration', label: '진동', icon: 'phone-portrait-outline' },
  { key: 'sound', label: '소리', icon: 'musical-note-outline' },
  { key: 'both', label: '소리+진동', icon: 'volume-high-outline' },
  { key: 'none', label: '없음', icon: 'notifications-off-outline' },
];

const VIBRATION_PATTERN_OPTIONS: { key: VibrationPattern; label: string; desc: string }[] = [
  { key: 'once',   label: '1번', desc: '1회 진동' },
  { key: 'twice',  label: '2번', desc: '2회 진동' },
  { key: 'thrice', label: '3번', desc: '3회 진동' },
];

const SOUND_TYPE_OPTIONS: { key: SoundType; label: string; desc: string }[] = [
  { key: 'beep', label: '삐 (Beep)', desc: '짧은 세 번 삐' },
  { key: 'bell', label: '벨 (Bell)', desc: '잔잔한 벨 소리' },
  { key: 'chime', label: '차임 (Chime)', desc: '리드미컬한 차임' },
];

const THEME_MODE_OPTIONS: { key: ThemeMode; label: string; icon: string; desc: string }[] = [
  { key: 'light', label: '라이트', icon: 'sunny-outline', desc: '항상 밝게' },
  { key: 'dark', label: '다크', icon: 'moon-outline', desc: '항상 어둡게' },
  { key: 'auto', label: '자동', icon: 'time-outline', desc: '시간대별 자동' },
];

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

function RowLabel({
  icon, title, desc, color, subColor,
}: {
  icon: string; title: string; desc?: string; color: string; subColor: string;
}) {
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

// ── 드럼롤 피커 ──────────────────────────────────────────────
const PICKER_ITEM_H = 34;

function DrumRollPicker({
  value,
  onChange,
  snapValues = REST_SNAP_VALUES,
  primaryColor = '#4F8EF7',
  disabled = false,
}: {
  value: number;
  onChange: (v: number) => void;
  snapValues?: number[];
  primaryColor?: string;
  disabled?: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const initialValueRef = useRef(value);

  useEffect(() => {
    const idx = snapValues.indexOf(initialValueRef.current);
    if (idx >= 0) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: idx * PICKER_ITEM_H, animated: false });
      }, 80);
    }
  }, []);

  const handleScrollEnd = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    if (disabled) return;
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / PICKER_ITEM_H);
    const clamped = Math.max(0, Math.min(snapValues.length - 1, idx));
    onChange(snapValues[clamped]);
  };

  return (
    <View style={styles.pickerContainer}>
      {/* 선택 영역 하이라이트 */}
      <View
        style={[styles.pickerHighlight, { borderColor: disabled ? '#ccc' : primaryColor }]}
        pointerEvents="none"
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={PICKER_ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled
        scrollEnabled={!disabled}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        contentContainerStyle={{ paddingVertical: PICKER_ITEM_H }}
        style={{ height: PICKER_ITEM_H * 3 }}
      >
        {snapValues.map((v) => {
          const isSelected = v === value;
          return (
            <View key={v} style={styles.pickerItem}>
              <Text
                style={[
                  styles.pickerItemText,
                  { color: disabled ? '#bbb' : isSelected ? primaryColor : '#bbb' },
                  isSelected && styles.pickerItemTextSelected,
                ]}
              >
                {v < 60 ? `${v}초` : `${v / 60}분`}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── 운동별 휴식시간 피커 ───────────────────────────────────────
function ExerciseRestSlider({
  customTime,
  onSelect,
  primaryColor,
  labelColor,
  chipBg,
  textSub,
  cardColor,
}: {
  customTime: number | null;
  onSelect: (v: number | null) => void;
  primaryColor: string;
  labelColor: string;
  chipBg: string;
  textSub: string;
  cardColor: string;
}) {
  const isDefault = customTime === null;
  const pickerValue = customTime ?? 90;

  return (
    <View style={[styles.exSliderPanel, { backgroundColor: cardColor }]}>
      {/* 기본값 사용 토글 */}
      <TouchableOpacity
        style={[styles.exDefaultToggle, { backgroundColor: isDefault ? '#EEF4FF' : chipBg }]}
        onPress={() => onSelect(null)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isDefault ? 'radio-button-on' : 'radio-button-off'}
          size={16}
          color={isDefault ? primaryColor : labelColor}
        />
        <Text style={[styles.exDefaultToggleText, { color: isDefault ? primaryColor : textSub }]}>
          기본값 사용
        </Text>
      </TouchableOpacity>

      <DrumRollPicker
        value={pickerValue}
        onChange={(v) => onSelect(v)}
        primaryColor={isDefault ? '#aaa' : primaryColor}
      />
    </View>
  );
}

const HOUR_CHIP_WIDTH = 58; // paddingH(20) + minWidth(52) + marginRight(6) ≈ actual rendered width

// ── 메인 화면 ────────────────────────────────────────────────
export default function SettingsScreen() {
  const { colors, settings: themeSettings, updateSettings: updateTheme } = useTheme();
  const { endWorkout } = useWorkout();
  const currentUser = authService.getCurrentUser();

  const dayScrollRef = useRef<ScrollView>(null);
  const nightScrollRef = useRef<ScrollView>(null);

  const [restTime, setRestTime] = useState(90);
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [exerciseRestTimes, setExerciseRestTimes] = useState<ExerciseRestTimes>({});
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [isExRestExpanded, setIsExRestExpanded] = useState(false);

  // 자동 모드 시간 피커 초기 스크롤 위치 설정
  useEffect(() => {
    if (themeSettings.mode === 'auto') {
      const dayOffset = Math.max(0, themeSettings.dayStartHour * HOUR_CHIP_WIDTH - 40);
      const nightOffset = Math.max(0, themeSettings.nightStartHour * HOUR_CHIP_WIDTH - 40);
      setTimeout(() => {
        dayScrollRef.current?.scrollTo({ x: dayOffset, animated: false });
        nightScrollRef.current?.scrollTo({ x: nightOffset, animated: false });
      }, 100);
    }
  }, [themeSettings.mode, themeSettings.dayStartHour, themeSettings.nightStartHour]);

  useFocusEffect(
    useCallback(() => {
      if (!currentUser) return;
      Promise.all([
        loadRestTime(currentUser.uid), 
        loadAlarmSettings(currentUser.uid), 
        loadExerciseRestTimes(currentUser.uid)
      ]).then(
        ([rt, alarm, exTimes]) => {
          setRestTime(rt);
          setAlarmSettings(alarm);
          setExerciseRestTimes(exTimes);
        },
      );
    }, [currentUser]),
  );

  const handleRestTime = async (sec: number) => {
    if (!currentUser) return;
    setRestTime(sec);
    await saveRestTime(currentUser.uid, sec);
  };

  const updateAlarm = async (patch: Partial<AlarmSettings>) => {
    if (!currentUser) return;
    const updated = { ...alarmSettings, ...patch };
    setAlarmSettings(updated);
    await saveAlarmSettings(currentUser.uid, updated);
  };

  const handleVibrationPattern = async (pattern: VibrationPattern) => {
    await updateAlarm({ vibrationPattern: pattern });
    // 선택 즉시 샘플 진동
    fireAlarm({ ...alarmSettings, vibrationPattern: pattern, alarmType: 'vibration' });
  };

  const handleExerciseRestTime = async (exerciseId: string, sec: number | null) => {
    if (!currentUser) return;
    const updated = { ...exerciseRestTimes };
    if (sec === null) {
      delete updated[exerciseId];
    } else {
      updated[exerciseId] = sec;
    }
    setExerciseRestTimes(updated);
    await saveExerciseRestTime(currentUser.uid, exerciseId, sec);
  };

  const handleLogout = () => {
    const user = authService.getCurrentUser();
    const isGuest = user?.isAnonymous;

    const title = '로그아웃';
    const message = isGuest 
      ? '둘러보기 중인 데이터는 사라질 수 있습니다. 로그아웃 하시겠습니까?' 
      : '로그아웃 하시겠습니까?';

    Alert.alert(title, message, [
      { text: '취소', style: 'cancel' },
      { 
        text: '로그아웃', 
        style: 'destructive', 
        onPress: async () => {
          try {
            endWorkout();
            await authService.signOut();
          } catch (error) {
            Alert.alert('오류', '로그아웃 중 문제가 발생했습니다.');
          }
        }
      }
    ]);
  };

  const showVibrationSettings =
    alarmSettings.alarmType === 'vibration' || alarmSettings.alarmType === 'both';
  const showSoundSettings =
    alarmSettings.alarmType === 'sound' || alarmSettings.alarmType === 'both';

  const c = colors;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.background }]}
      contentContainerStyle={styles.content}
    >
      {/* ════ 화면 설정 ════ */}
      <SectionHeader title="화면 설정" color={c.textSub} />
      <View style={[styles.card, { backgroundColor: c.card }]}>
        <RowLabel
          icon="contrast-outline"
          title="화면 모드"
          desc="앱의 전체 색상 테마"
          color={c.text}
          subColor={c.textSub}
        />
        <View style={styles.chips}>
          {THEME_MODE_OPTIONS.map((o) => {
            const active = themeSettings.mode === o.key;
            return (
              <TouchableOpacity
                key={o.key}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? c.primaryBg : c.chipBg,
                    borderColor: active ? c.primary : 'transparent',
                  },
                ]}
                onPress={() => updateTheme({ mode: o.key })}
              >
                <Ionicons name={o.icon as any} size={14} color={active ? c.primary : c.textSub} />
                <View>
                  <Text style={[styles.chipText, { color: active ? c.primary : c.textSub }]}>
                    {o.label}
                  </Text>
                  <Text style={[styles.chipSubText, { color: active ? c.primary : c.textMuted }]}>
                    {o.desc}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

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
            <View style={styles.timeRow}>
              <Ionicons name="sunny" size={16} color="#F5A623" />
              <Text style={[styles.timeLabel, { color: c.text }]}>주간 시작</Text>
              <ScrollView ref={dayScrollRef} horizontal showsHorizontalScrollIndicator={false} style={styles.hourScroll}>
                {HOUR_OPTIONS.map((h) => {
                  const active = themeSettings.dayStartHour === h;
                  return (
                    <TouchableOpacity
                      key={h}
                      style={[styles.hourChip, { backgroundColor: active ? c.primary : c.chipBg }]}
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
            <View style={styles.timeRow}>
              <Ionicons name="moon" size={16} color="#7B6CF6" />
              <Text style={[styles.timeLabel, { color: c.text }]}>야간 시작</Text>
              <ScrollView ref={nightScrollRef} horizontal showsHorizontalScrollIndicator={false} style={styles.hourScroll}>
                {HOUR_OPTIONS.map((h) => {
                  const active = themeSettings.nightStartHour === h;
                  return (
                    <TouchableOpacity
                      key={h}
                      style={[styles.hourChip, { backgroundColor: active ? '#7B6CF6' : c.chipBg }]}
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
                주간: {formatHour(themeSettings.dayStartHour)} ~{' '}
                {formatHour(themeSettings.nightStartHour)} · 야간:{' '}
                {formatHour(themeSettings.nightStartHour)} ~{' '}
                {formatHour(themeSettings.dayStartHour)}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* ════ 휴식 시간 설정 ════ */}
      <SectionHeader title="휴식 시간 설정" color={c.textSub} />
      <View style={[styles.card, { backgroundColor: c.card }]}>
        <RowLabel
          icon="timer-outline"
          title="기본 휴식 시간"
          desc="세트 완료 후 자동으로 시작되는 타이머"
          color={c.text}
          subColor={c.textSub}
        />

        {/* 드럼롤 피커 */}
        <DrumRollPicker
          value={restTime}
          onChange={handleRestTime}
          primaryColor={c.primary}
        />

        <Divider color={c.border} />

        {/* 운동별 휴식 시간 – 접힘/펼침 헤더 */}
        <TouchableOpacity
          style={styles.collapsibleHeader}
          onPress={() => setIsExRestExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <Ionicons name="barbell-outline" size={18} color="#4F8EF7" style={{ marginRight: 10 }} />
          <View style={styles.collapsibleHeaderText}>
            <Text style={[styles.rowTitle, { color: c.text }]}>운동별 휴식 시간</Text>
            <Text style={[styles.rowDesc, { color: c.textSub }]}>
              운동마다 다른 휴식시간을 설정할 수 있어요
            </Text>
          </View>
          <Ionicons
            name={isExRestExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={c.textMuted}
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
                    <View
                      style={[
                        styles.exRestBadge,
                        { backgroundColor: hasCustom ? c.primaryBg : c.chipBg },
                      ]}
                    >
                      <Ionicons
                        name="timer-outline"
                        size={11}
                        color={hasCustom ? c.primary : c.textMuted}
                      />
                      <Text
                        style={[
                          styles.exRestBadgeText,
                          { color: hasCustom ? c.primary : c.textMuted },
                        ]}
                      >
                        {hasCustom ? formatRestLabel(customTime) : '기본값'}
                      </Text>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={11}
                        color={hasCustom ? c.primary : c.textMuted}
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <ExerciseRestSlider
                      customTime={customTime ?? null}
                      onSelect={(v) => handleExerciseRestTime(ex.id, v)}
                      primaryColor={c.primary}
                      labelColor={c.textMuted}
                      chipBg={c.chipBg}
                      textSub={c.textSub}
                      cardColor={c.cardAlt}
                    />
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
        <RowLabel
          icon="notifications-outline"
          title="알람 유형"
          desc="휴식 시간 종료 시 알림 방식"
          color={c.text}
          subColor={c.textSub}
        />
        <View style={styles.chips}>
          {ALARM_TYPE_OPTIONS.map((o) => {
            const active = alarmSettings.alarmType === o.key;
            return (
              <TouchableOpacity
                key={o.key}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? c.primaryBg : c.chipBg,
                    borderColor: active ? c.primary : 'transparent',
                  },
                ]}
                onPress={() => updateAlarm({ alarmType: o.key })}
              >
                <Ionicons name={o.icon as any} size={13} color={active ? c.primary : c.textSub} />
                <Text style={[styles.chipText, { color: active ? c.primary : c.textSub }]}>
                  {o.label}
                </Text>
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
            <RowLabel
              icon="phone-portrait-outline"
              title="진동 패턴"
              desc="선택 즉시 진동을 느껴볼 수 있어요"
              color={c.text}
              subColor={c.textSub}
            />
            <View style={styles.chips}>
              {VIBRATION_PATTERN_OPTIONS.map((o) => {
                const active = alarmSettings.vibrationPattern === o.key;
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[
                      styles.chip,
                      styles.vibrateChip,
                      {
                        backgroundColor: active ? c.primaryBg : c.chipBg,
                        borderColor: active ? c.primary : 'transparent',
                      },
                    ]}
                    onPress={() => handleVibrationPattern(o.key)}
                  >
                    <Ionicons
                      name="pulse-outline"
                      size={13}
                      color={active ? c.primary : c.textSub}
                    />
                    <Text style={[styles.chipText, { color: active ? c.primary : c.textSub }]}>
                      {o.label}
                    </Text>
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
            <RowLabel
              icon="musical-note-outline"
              title="소리 종류"
              desc="알람 벨 종류"
              color={c.text}
              subColor={c.textSub}
            />
            <View style={styles.chips}>
              {SOUND_TYPE_OPTIONS.map((o) => {
                const active = alarmSettings.soundType === o.key;
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? c.primaryBg : c.chipBg,
                        borderColor: active ? c.primary : 'transparent',
                      },
                    ]}
                    onPress={() => updateAlarm({ soundType: o.key })}
                  >
                    <Text style={[styles.chipText, { color: active ? c.primary : c.textSub }]}>
                      {o.label}
                    </Text>
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

      {/* ════ 계정 설정 ════ */}
      <SectionHeader title="계정" color={c.textSub} />
      <TouchableOpacity
        style={[styles.logoutBtn, { backgroundColor: c.card }]}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <Ionicons name="log-out-outline" size={20} color="#FF5C5C" />
        <Text style={styles.logoutBtnText}>로그아웃</Text>
      </TouchableOpacity>
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

  // 접힘/펼침 헤더 – 화살표 카드 내부에
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  collapsibleHeaderText: { flex: 1 },

  // 운동별 휴식시간
  exerciseRestList: { marginTop: 12, gap: 2 },
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
  exRestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  exRestBadgeText: { fontSize: 11, fontWeight: '600' },

  // 운동별 슬라이더 패널
  exSliderPanel: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  exDefaultToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  exDefaultToggleText: { fontSize: 13, fontWeight: '600' },
  exSliderArea: {},

  // 드럼롤 피커
  pickerContainer: {
    height: 34 * 3,
    overflow: 'hidden',
    marginVertical: 8,
    alignSelf: 'center',
    width: '72%',
  },
  pickerHighlight: {
    position: 'absolute',
    top: 34,
    left: 0,
    right: 0,
    height: 34,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    zIndex: 1,
  },
  pickerItem: {
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerItemText: {
    fontSize: 12,
    fontWeight: '400',
  },
  pickerItemTextSelected: {
    fontSize: 20,
    fontWeight: '800',
  },

  // 자동 모드
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
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

  // 계정
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    padding: 18,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF5C5C',
  },
});
