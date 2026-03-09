import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { RootStackParamList, Workout, WorkoutExercise, WorkoutSet } from '../types';
import { loadWorkouts, deleteWorkout, updateWorkout } from '../storage/workoutStorage';
import {
  loadRestTime,
  loadAlarmSettings,
  loadExerciseRestTimes,
  AlarmSettings,
  ExerciseRestTimes,
  DEFAULT_ALARM_SETTINGS,
} from '../storage/settingsStorage';
import SetStepper from '../components/SetStepper';
import { useTheme } from '../context/ThemeContext';
import { useWorkout } from '../context/WorkoutContext';

type Route = RouteProp<RootStackParamList, 'WorkoutDetail'>;

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const TIMER_BAR_HEIGHT = 110;

export default function WorkoutDetailScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { workoutId } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Responsive breakpoints
  const isLarge = width >= 600;
  const isMedium = width >= 400;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [editedExercises, setEditedExercises] = useState<WorkoutExercise[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedExId, setSelectedExId] = useState<string | null>(null);

  // Settings
  const [defaultRestTime, setDefaultRestTime] = useState(90);
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [exerciseRestTimes, setExerciseRestTimes] = useState<ExerciseRestTimes>({});

  // Workout context (timer lives here globally)
  const {
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
  } = useWorkout();

  // Load settings
  useEffect(() => {
    Promise.all([loadRestTime(), loadAlarmSettings(), loadExerciseRestTimes()]).then(
      ([restTime, alarm, exTimes]) => {
        setDefaultRestTime(restTime);
        setAlarmSettings(alarm);
        setExerciseRestTimes(exTimes);
      },
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts().then((all) => {
        const found = all.find((w) => w.id === workoutId);
        if (found) {
          setWorkout(found);
          const exs = found.exercises.map((ex) => ({
            ...ex,
            sets: ex.sets.map((s) => ({ ...s })),
          }));
          setEditedExercises(exs);
          setHasChanges(false);
          // Auto-select first exercise on large screens
          if (isLarge && exs.length > 0) {
            setSelectedExId((prev) => prev ?? exs[0].id);
          }
        }
      });
    }, [workoutId, isLarge]),
  );

  // ── Progress ──
  const totalSets = editedExercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const completedSets = editedExercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
    0,
  );
  const progress = totalSets === 0 ? 0 : completedSets / totalSets;

  // Sync to WorkoutContext
  useEffect(() => {
    if (!workout) return;
    initWorkout(
      { workoutId, workoutName: workout.title, completedSets, totalSets },
      alarmSettings,
    );
  }, [workout, completedSets, totalSets, alarmSettings, workoutId, initWorkout]);

  useEffect(() => {
    updateProgress(completedSets, totalSets);
  }, [completedSets, totalSets, updateProgress]);

  // ── Estimated remaining time ──
  const estimatedMinutesRemaining = useMemo(() => {
    let totalSeconds = 0;
    let exercisesWithIncompleteSets = 0;
    for (const ex of editedExercises) {
      const incompleteSets = ex.sets.filter((s) => !s.completed).length;
      if (incompleteSets === 0) continue;
      exercisesWithIncompleteSets++;
      const restTime = exerciseRestTimes[ex.exercise.id] ?? defaultRestTime;
      totalSeconds += incompleteSets * 60; // 세트당 1분
      totalSeconds += incompleteSets * restTime; // 휴식시간
    }
    const transitions = Math.max(0, exercisesWithIncompleteSets - 1);
    totalSeconds += transitions * 120; // 종목 전환 2분
    return Math.ceil(totalSeconds / 60);
  }, [editedExercises, exerciseRestTimes, defaultRestTime]);

  const updateExercises = (updater: (prev: WorkoutExercise[]) => WorkoutExercise[]) => {
    setEditedExercises(updater);
    setHasChanges(true);
  };

  // Auto-save helper
  const autoSave = async (exercises: WorkoutExercise[]) => {
    if (!workout) return;
    try {
      const updated: Workout = { ...workout, exercises };
      await updateWorkout(updated);
      setWorkout(updated);
    } catch {
      // silent fail for auto-save
    }
  };

  // ── Set completion toggle ──
  const toggleCompleted = (
    exId: string,
    setId: string,
    currentCompleted: boolean,
    exerciseId: string,
  ) => {
    if (currentCompleted) {
      showAlert('세트 완료 취소', '이 세트의 완료를 취소하시겠습니까?', [
        { text: '아니요', style: 'cancel' },
        {
          text: '취소',
          style: 'destructive',
          onPress: () => {
            setEditedExercises((prev) => {
              const next = prev.map((ex) => {
                if (ex.id !== exId) return ex;
                return {
                  ...ex,
                  sets: ex.sets.map((s) => (s.id === setId ? { ...s, completed: false } : s)),
                };
              });
              autoSave(next);
              return next;
            });
            setHasChanges(true);
            skipTimer();
          },
        },
      ]);
      return;
    }

    setEditedExercises((prev) => {
      const next = prev.map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, completed: true } : s)),
        };
      });
      autoSave(next);
      return next;
    });
    setHasChanges(true);
    const customTime = exerciseRestTimes[exerciseId];
    startTimer(customTime != null ? customTime : defaultRestTime);
  };

  const updateSetField = (
    exId: string,
    setId: string,
    field: keyof Pick<WorkoutSet, 'weight' | 'reps'>,
    value: number,
  ) => {
    updateExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) =>
            s.id === setId ? { ...s, [field]: Math.max(0, value) } : s,
          ),
        };
      }),
    );
  };

  const addSet = (exId: string) => {
    updateExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        const newSet: WorkoutSet = {
          id: generateId(),
          weight: last?.weight ?? 0,
          reps: last?.reps ?? 0,
          completed: false,
        };
        return { ...ex, sets: [...ex.sets, newSet] };
      }),
    );
  };

  const removeSet = (exId: string, setId: string) => {
    updateExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId || ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.filter((s) => s.id !== setId) };
      }),
    );
  };

  const handleSave = async () => {
    if (!workout) return;
    try {
      const updated: Workout = { ...workout, exercises: editedExercises };
      await updateWorkout(updated);
      setWorkout(updated);
      setHasChanges(false);
      showAlert('저장 완료', '운동 기록이 저장되었습니다.');
    } catch {
      showAlert('오류', '운동 기록 저장에 실패했습니다.');
    }
  };

  const handleDelete = () => {
    if (!workout) return;
    showAlert('운동 삭제', `"${workout.title}"를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkout(workoutId);
            endWorkout();
            navigation.goBack();
          } catch {
            showAlert('오류', '운동 기록 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  if (!workout) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFoundText, { color: colors.textSub }]}>
          운동 기록을 찾을 수 없어요.
        </Text>
      </View>
    );
  }

  const timerProgress = timerDuration > 0 ? timerSeconds / timerDuration : 0;
  const bottomPad = timerActive ? TIMER_BAR_HEIGHT + insets.bottom + 8 : 40;
  const horizontalPad = isLarge ? 24 : isMedium ? 18 : 16;

  // ── Exercise card renderer ──
  const renderExerciseCard = (ex: WorkoutExercise) => {
    const customRestTime = exerciseRestTimes[ex.exercise.id];
    const effectiveRestTime = customRestTime != null ? customRestTime : defaultRestTime;
    const exCompletedSets = ex.sets.filter((s) => s.completed).length;

    return (
      <View key={ex.id} style={[styles.exerciseCard, { backgroundColor: colors.card }]}>
        <View style={styles.exerciseCardHeader}>
          <View style={styles.exerciseCardHeaderLeft}>
            <Text style={[styles.exerciseName, { color: colors.text, fontSize: isLarge ? 18 : 17 }]}>
              {ex.exercise.name}
            </Text>
            <Text style={[styles.muscleGroups, { color: colors.textSub }]}>
              {[ex.exercise.equipment, ex.exercise.description].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              {exCompletedSets}/{ex.sets.length}
            </Text>
            <View style={[styles.restTimeBadge, { backgroundColor: colors.primaryBg }]}>
              <Ionicons name="timer-outline" size={12} color="#4F8EF7" />
              <Text style={styles.restTimeBadgeText}>{effectiveRestTime}초</Text>
            </View>
          </View>
        </View>

        {/* Table header */}
        <View style={[styles.setTableHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.cellNum, styles.headerText, { color: colors.textMuted }]}>세트</Text>
          <Text style={[styles.cellStepper, styles.headerText, { color: colors.textMuted }]}>무게 (kg)</Text>
          <Text style={[styles.cellStepper, styles.headerText, { color: colors.textMuted }]}>횟수</Text>
          <View style={styles.cellDelete} />
          <Text style={[styles.cellComplete, styles.headerText, { color: colors.textMuted }]}>완료</Text>
        </View>

        {/* Set rows */}
        {ex.sets.map((s, idx) => (
          <View key={s.id} style={[styles.setRow, s.completed && styles.setRowCompleted]}>
            <Text style={[styles.cellNum, { color: colors.text }, s.completed && styles.completedText]}>
              {idx + 1}
            </Text>
            <View style={styles.cellStepper}>
              <SetStepper
                value={s.weight}
                onChange={(v) => updateSetField(ex.id, s.id, 'weight', v)}
                step={5}
              />
            </View>
            <View style={styles.cellStepper}>
              <SetStepper
                value={s.reps}
                onChange={(v) => updateSetField(ex.id, s.id, 'reps', v)}
                step={1}
              />
            </View>
            <TouchableOpacity
              style={styles.cellDelete}
              onPress={() => removeSet(ex.id, s.id)}
              disabled={ex.sets.length <= 1}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="remove-circle-outline"
                size={20}
                color={ex.sets.length <= 1 ? '#e0e0e0' : '#FF5C5C'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.cellComplete,
                styles.checkBtn,
                s.completed
                  ? styles.checkBtnDone
                  : { backgroundColor: isDark ? '#3A3A58' : '#E8E8E8' },
              ]}
              onPress={() => toggleCompleted(ex.id, s.id, s.completed, ex.exercise.id)}
            >
              <Ionicons
                name="checkmark"
                size={16}
                color={s.completed ? '#fff' : isDark ? '#7070A0' : '#bbb'}
              />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(ex.id)}>
          <Ionicons name="add-circle-outline" size={16} color="#4F8EF7" />
          <Text style={styles.addSetText}>세트 추가</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Progress card ──
  const progressCard = (
    <View style={[styles.progressCard, { backgroundColor: colors.card }]}>
      <View style={styles.progressHeader}>
        <Text style={[styles.progressLabel, { color: colors.textSub }]}>운동 진행률</Text>
        <Text style={styles.progressCount}>
          {completedSets} / {totalSets} 세트
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      {estimatedMinutesRemaining > 0 && completedSets < totalSets && (
        <View style={styles.estimatedRow}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.estimatedText, { color: colors.textMuted }]}>
            약 {estimatedMinutesRemaining}분 남았어요
          </Text>
        </View>
      )}
      {completedSets === totalSets && totalSets > 0 && (
        <View style={styles.estimatedRow}>
          <Ionicons name="checkmark-circle" size={13} color="#34C759" />
          <Text style={[styles.estimatedText, { color: '#34C759' }]}>모든 세트 완료!</Text>
        </View>
      )}
    </View>
  );

  // ── Header card ──
  const headerCard = (
    <View style={[styles.headerCard, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.text, fontSize: isLarge ? 24 : 22 }]}>
        {workout.title}
      </Text>
      <Text style={[styles.date, { color: colors.textSub }]}>
        {format(new Date(workout.date), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
      </Text>
      <View style={styles.metaRow}>
        {workout.duration && (
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color="#4F8EF7" />
            <Text style={styles.metaText}>{workout.duration}분</Text>
          </View>
        )}
        <View style={styles.metaItem}>
          <Ionicons name="barbell-outline" size={16} color="#4F8EF7" />
          <Text style={styles.metaText}>{workout.exercises.length}종목</Text>
        </View>
      </View>
    </View>
  );

  // ── LARGE SCREEN: 2-column layout ──
  if (isLarge) {
    const selectedEx = editedExercises.find((e) => e.id === selectedExId) ?? editedExercises[0];

    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.largeLayout, { paddingBottom: timerActive ? TIMER_BAR_HEIGHT + insets.bottom + 8 : 16 }]}>
          {/* Left column: exercise list + info */}
          <View style={[styles.leftColumn, { backgroundColor: colors.card, borderRightColor: colors.border }]}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {headerCard}
              {workout.notes && (
                <View style={[styles.notesCard, { backgroundColor: colors.cardAlt }]}>
                  <Ionicons name="document-text-outline" size={16} color={colors.textSub} />
                  <Text style={[styles.notesText, { color: colors.textSub }]}>{workout.notes}</Text>
                </View>
              )}
              {progressCard}

              <Text style={[styles.sidebarSectionLabel, { color: colors.textMuted }]}>운동 종목</Text>
              {editedExercises.map((ex) => {
                const exDone = ex.sets.filter((s) => s.completed).length;
                const isSelected = ex.id === (selectedEx?.id);
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[
                      styles.sidebarItem,
                      { backgroundColor: isSelected ? colors.primaryBg : colors.background, borderColor: isSelected ? '#4F8EF7' : 'transparent' },
                    ]}
                    onPress={() => setSelectedExId(ex.id)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sidebarItemName, { color: isSelected ? '#4F8EF7' : colors.text }]} numberOfLines={1}>
                        {ex.exercise.name}
                      </Text>
                      <Text style={[styles.sidebarItemSets, { color: colors.textSub }]}>
                        {exDone}/{ex.sets.length} 세트
                      </Text>
                    </View>
                    {exDone === ex.sets.length && ex.sets.length > 0 && (
                      <Ionicons name="checkmark-circle" size={18} color="#34C759" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Right column: set editor */}
          <ScrollView
            style={styles.rightColumn}
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          >
            {selectedEx && renderExerciseCard(selectedEx)}

            {hasChanges && (
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>변경사항 저장</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: colors.destructiveBg }]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={18} color="#FF5C5C" />
              <Text style={styles.deleteButtonText}>운동 기록 삭제</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Timer bar */}
        {timerActive && (
          <TimerBar
            timerSeconds={timerSeconds}
            timerProgress={timerProgress}
            timerDuration={timerDuration}
            insets={insets}
            colors={colors}
            onSkip={skipTimer}
            onReset={resetTimer}
            onAdjust={adjustTimerSeconds}
          />
        )}
      </View>
    );
  }

  // ── SMALL/MEDIUM SCREEN: single column ──
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad, paddingHorizontal: horizontalPad }]}
      >
        {progressCard}
        {headerCard}

        {workout.notes && (
          <View style={[styles.notesCard, { backgroundColor: colors.cardAlt }]}>
            <Ionicons name="document-text-outline" size={16} color={colors.textSub} />
            <Text style={[styles.notesText, { color: colors.textSub }]}>{workout.notes}</Text>
          </View>
        )}

        {editedExercises.map(renderExerciseCard)}

        {hasChanges && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>변경사항 저장</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: colors.destructiveBg }]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={18} color="#FF5C5C" />
          <Text style={styles.deleteButtonText}>운동 기록 삭제</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Timer bar */}
      {timerActive && (
        <TimerBar
          timerSeconds={timerSeconds}
          timerProgress={timerProgress}
          timerDuration={timerDuration}
          insets={insets}
          colors={colors}
          onSkip={skipTimer}
          onReset={resetTimer}
          onAdjust={adjustTimerSeconds}
        />
      )}
    </View>
  );
}

// ── Timer bar component ──
function TimerBar({
  timerSeconds,
  timerProgress,
  timerDuration,
  insets,
  colors,
  onSkip,
  onReset,
  onAdjust,
}: {
  timerSeconds: number;
  timerProgress: number;
  timerDuration: number;
  insets: { bottom: number };
  colors: any;
  onSkip: () => void;
  onReset: () => void;
  onAdjust: (delta: number) => void;
}) {
  return (
    <View
      style={[
        styles.timerBar,
        { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: colors.timerBg },
      ]}
    >
      {/* Top row: label + skip + reset */}
      <View style={styles.timerTopRow}>
        <View style={styles.timerLeft}>
          <Ionicons name="timer-outline" size={15} color="rgba(255,255,255,0.7)" />
          <Text style={styles.timerLabel}>휴식 중</Text>
          <Text style={styles.timerDurationHint}>{timerDuration}초</Text>
        </View>
        <View style={styles.timerRight}>
          <TouchableOpacity style={styles.timerBtn} onPress={onSkip}>
            <Text style={styles.timerBtnText}>스킵</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.timerBtn} onPress={onReset}>
            <Ionicons name="refresh-outline" size={15} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Middle row: -10 | countdown | +10 */}
      <View style={styles.timerCountdownRow}>
        <TouchableOpacity
          style={styles.timerAdjustCircle}
          onPress={() => onAdjust(-10)}
        >
          <Text style={styles.timerAdjustCircleText}>−10</Text>
        </TouchableOpacity>

        <Text style={styles.timerCountdown}>{formatTime(timerSeconds)}</Text>

        <TouchableOpacity
          style={styles.timerAdjustCircle}
          onPress={() => onAdjust(10)}
        >
          <Text style={styles.timerAdjustCircleText}>+10</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.timerTrack}>
        <View style={[styles.timerFill, { width: `${timerProgress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1 },
  content: { paddingTop: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 16 },

  // Large screen 2-col layout
  largeLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  leftColumn: {
    width: 280,
    borderRightWidth: 1,
  },
  rightColumn: {
    flex: 1,
  },
  sidebarSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 2,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1.5,
  },
  sidebarItemName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  sidebarItemSets: { fontSize: 12 },

  // Progress card
  progressCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 13, fontWeight: '600' },
  progressCount: { fontSize: 13, fontWeight: '700', color: '#4F8EF7' },
  progressTrack: { height: 8, backgroundColor: '#EEF0F5', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#4F8EF7', borderRadius: 4 },
  estimatedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  estimatedText: { fontSize: 12, fontWeight: '500' },

  // Header card
  headerCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  date: { fontSize: 14, marginBottom: 14 },
  metaRow: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 14, color: '#4F8EF7', fontWeight: '600' },

  notesCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  notesText: { flex: 1, fontSize: 14, lineHeight: 20 },

  // Exercise card
  exerciseCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  exerciseCardHeaderLeft: { flex: 1 },
  exerciseName: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  muscleGroups: { fontSize: 12 },
  restTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  restTimeBadgeText: { fontSize: 11, color: '#4F8EF7', fontWeight: '600' },

  setTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 6,
  },
  headerText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  setRowCompleted: { opacity: 0.5 },
  completedText: { color: '#aaa' },

  cellNum: {
    width: 28,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  cellStepper: { flex: 1, marginHorizontal: 3 },
  cellDelete: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  cellComplete: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  checkBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnDone: { backgroundColor: '#34C759' },

  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  addSetText: { fontSize: 14, color: '#4F8EF7', fontWeight: '600' },

  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F8EF7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonText: { fontSize: 16, color: '#fff', fontWeight: '700' },

  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  deleteButtonText: { fontSize: 15, color: '#FF5C5C', fontWeight: '600' },

  // ── Timer bar ──
  timerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  timerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  timerLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  timerDurationHint: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 4 },
  timerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
  },
  timerBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },

  // -10 | countdown | +10
  timerCountdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 10,
  },
  timerAdjustCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  timerAdjustCircleText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },
  timerCountdown: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
    minWidth: 110,
    textAlign: 'center',
  },

  timerTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  timerFill: { height: 4, backgroundColor: '#4F8EF7', borderRadius: 2 },
});
