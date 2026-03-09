import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Workout, WorkoutExercise, WorkoutSet, Exercise } from '../types';
import { EXERCISES } from '../utils/exercises';
import { loadWorkouts, deleteWorkout, updateWorkout } from '../storage/workoutStorage';
import {
  loadRestTime,
  loadAlarmSettings,
  loadExerciseRestTimes,
  loadCustomAlternatives,
  AlarmSettings,
  ExerciseRestTimes,
  CustomAlternatives,
  DEFAULT_ALARM_SETTINGS,
} from '../storage/settingsStorage';
import { formatSeconds } from '../utils/timeFormat';
import SetStepper from '../components/SetStepper';
import { useTheme } from '../context/ThemeContext';
import { useWorkout } from '../context/WorkoutContext';

type Route = RouteProp<RootStackParamList, 'WorkoutDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function displayName(ex: Exercise): string {
  return ex.description ? `${ex.name} - ${ex.description}` : ex.name;
}

const TIMER_BAR_HEIGHT = 110;

export default function WorkoutDetailScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { workoutId } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isLarge = width >= 600;
  const isMedium = width >= 400;

  // ── State ──
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [editedExercises, setEditedExercises] = useState<WorkoutExercise[]>([]);
  const [isWorkoutPaused, setIsWorkoutPaused] = useState(false);
  const [selectedExId, setSelectedExId] = useState<string | null>(null);
  const [changeTargetExId, setChangeTargetExId] = useState<string | null>(null);
  const [showAddExModal, setShowAddExModal] = useState(false);
  const [addExSearch, setAddExSearch] = useState('');

  // Settings
  const [defaultRestTime, setDefaultRestTime] = useState(90);
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [exerciseRestTimes, setExerciseRestTimes] = useState<ExerciseRestTimes>({});
  const [customAlternatives, setCustomAlternatives] = useState<CustomAlternatives>({});

  // ── Refs ──
  const workoutRef = useRef<Workout | null>(null);
  const isInitializedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoFinishedRef = useRef(false);

  useEffect(() => {
    workoutRef.current = workout;
  }, [workout]);

  // ── Workout context ──
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

  // ── Load settings ──
  useEffect(() => {
    Promise.all([
      loadRestTime(),
      loadAlarmSettings(),
      loadExerciseRestTimes(),
      loadCustomAlternatives(),
    ]).then(([restTime, alarm, exTimes, customAlts]) => {
      setDefaultRestTime(restTime);
      setAlarmSettings(alarm);
      setExerciseRestTimes(exTimes);
      setCustomAlternatives(customAlts);
    });
  }, []);

  // ── Load workout ──
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
          if (isLarge && exs.length > 0) {
            setSelectedExId((prev) => prev ?? exs[0].id);
          }
          // Mark as initialized after state settles
          setTimeout(() => {
            isInitializedRef.current = true;
          }, 100);
        }
      });
    }, [workoutId, isLarge]),
  );

  // ── Debounced auto-save ──
  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (!workoutRef.current) return;
      try {
        const updated: Workout = { ...workoutRef.current, exercises: editedExercises };
        await updateWorkout(updated);
        setWorkout(updated);
      } catch {
        // silent fail
      }
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [editedExercises]);

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

  // ── Auto-complete: all sets done → pause + alert ──
  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (totalSets > 0 && completedSets === totalSets && !autoFinishedRef.current) {
      autoFinishedRef.current = true;
      setTimeout(() => {
        skipTimer();
        setIsWorkoutPaused(true);
        showAlert('운동 완료! 🎉', '모든 세트를 완료했습니다! 수고하셨습니다.', [
          {
            text: '메인화면',
            onPress: () => {
              endWorkout();
              navigation.goBack();
            },
          },
          {
            text: '계속하기',
            style: 'cancel',
            onPress: () => {
              setIsWorkoutPaused(false);
              autoFinishedRef.current = false;
            },
          },
        ]);
      }, 400);
    } else if (completedSets < totalSets) {
      autoFinishedRef.current = false;
    }
  }, [completedSets, totalSets]);

  // ── Estimated remaining time ──
  const estimatedMinutesRemaining = useMemo(() => {
    let totalSec = 0;
    let exercisesWithIncompleteSets = 0;
    for (const ex of editedExercises) {
      const incompleteSets = ex.sets.filter((s) => !s.completed).length;
      if (incompleteSets === 0) continue;
      exercisesWithIncompleteSets++;
      const restTime = exerciseRestTimes[ex.exercise.id] ?? defaultRestTime;
      totalSec += incompleteSets * 60;
      totalSec += incompleteSets * restTime;
    }
    totalSec += Math.max(0, exercisesWithIncompleteSets - 1) * 120;
    return Math.ceil(totalSec / 60);
  }, [editedExercises, exerciseRestTimes, defaultRestTime]);

  // ── Handlers ──

  const handlePauseWorkout = () => {
    skipTimer();
    setIsWorkoutPaused(true);
  };

  const handleResumeWorkout = () => {
    setIsWorkoutPaused(false);
  };

  const handleGoToMain = () => {
    endWorkout();
    navigation.goBack();
  };

  const toggleCompleted = (
    exId: string,
    setId: string,
    currentCompleted: boolean,
    exerciseId: string,
  ) => {
    if (isWorkoutPaused) return;
    if (currentCompleted) {
      showAlert('세트 완료 취소', '이 세트의 완료를 취소하시겠습니까?', [
        { text: '아니요', style: 'cancel' },
        {
          text: '취소',
          style: 'destructive',
          onPress: () => {
            setEditedExercises((prev) =>
              prev.map((ex) => {
                if (ex.id !== exId) return ex;
                return {
                  ...ex,
                  sets: ex.sets.map((s) => (s.id === setId ? { ...s, completed: false } : s)),
                };
              }),
            );
            skipTimer();
          },
        },
      ]);
      return;
    }
    setEditedExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, completed: true } : s)),
        };
      }),
    );
    const customTime = exerciseRestTimes[exerciseId];
    startTimer(customTime != null ? customTime : defaultRestTime);
  };

  const updateSetField = (
    exId: string,
    setId: string,
    field: keyof Pick<WorkoutSet, 'weight' | 'reps'>,
    value: number,
  ) => {
    setEditedExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        const setIdx = ex.sets.findIndex((s) => s.id === setId);
        return {
          ...ex,
          sets: ex.sets.map((s, idx) => {
            if (s.id === setId) return { ...s, [field]: Math.max(0, value) };
            if (idx > setIdx && s[field] === 0) return { ...s, [field]: Math.max(0, value) };
            return s;
          }),
        };
      }),
    );
  };

  const addSet = (exId: string) => {
    setEditedExercises((prev) =>
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
    setEditedExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId || ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.filter((s) => s.id !== setId) };
      }),
    );
  };

  // #2: 운동 변경 - 세트/무게/횟수 원래대로 유지
  const handleChangeExercise = (targetWexId: string, newExerciseId: string) => {
    const newEx = EXERCISES.find((e) => e.id === newExerciseId);
    if (!newEx) return;
    showAlert(
      '운동 변경',
      `"${displayName(newEx)}"으로 변경합니다.\n기존 세트 기록은 유지됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '변경',
          onPress: () => {
            setChangeTargetExId(null);
            setEditedExercises((prev) =>
              prev.map((ex) => {
                if (ex.id !== targetWexId) return ex;
                return { ...ex, exercise: newEx }; // 세트/무게/횟수 유지
              }),
            );
          },
        },
      ],
    );
  };

  // #1: 운동 추가
  const handleAddExercise = (exerciseId: string) => {
    const ex = EXERCISES.find((e) => e.id === exerciseId);
    if (!ex) return;
    const newWex: WorkoutExercise = {
      id: generateId(),
      exercise: ex,
      sets: [{ id: generateId(), weight: 0, reps: 0, completed: false }],
    };
    setEditedExercises((prev) => [...prev, newWex]);
    if (isLarge) setSelectedExId(newWex.id);
    setShowAddExModal(false);
    setAddExSearch('');
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
              {displayName(ex.exercise)}
            </Text>
            <Text style={[styles.muscleGroups, { color: colors.textSub }]}>
              {ex.exercise.equipment}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              {exCompletedSets}/{ex.sets.length}
            </Text>
            <View style={[styles.restTimeBadge, { backgroundColor: colors.primaryBg }]}>
              <Ionicons name="timer-outline" size={12} color="#4F8EF7" />
              <Text style={styles.restTimeBadgeText}>{formatSeconds(effectiveRestTime)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.changeExBtn, { backgroundColor: colors.chipBg }]}
              onPress={() => setChangeTargetExId(ex.id)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Ionicons name="swap-horizontal-outline" size={13} color={colors.primary} />
              <Text style={[styles.changeExBtnText, { color: colors.primary }]}>변경</Text>
            </TouchableOpacity>
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
            {/* #4: 완료 버튼 - 운동 종료 상태일 때 비활성화 */}
            <TouchableOpacity
              style={[
                styles.cellComplete,
                styles.checkBtn,
                s.completed
                  ? styles.checkBtnDone
                  : { backgroundColor: isDark ? '#3A3A58' : '#E8E8E8' },
                isWorkoutPaused && styles.checkBtnDisabled,
              ]}
              onPress={() => toggleCompleted(ex.id, s.id, s.completed, ex.exercise.id)}
              disabled={isWorkoutPaused}
            >
              <Ionicons
                name="checkmark"
                size={16}
                color={
                  isWorkoutPaused
                    ? (isDark ? '#555' : '#ccc')
                    : s.completed
                    ? '#fff'
                    : isDark
                    ? '#7070A0'
                    : '#bbb'
                }
              />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={styles.addSetBtn}
          onPress={() => addSet(ex.id)}
          disabled={isWorkoutPaused}
        >
          <Ionicons name="add-circle-outline" size={16} color={isWorkoutPaused ? '#ccc' : '#4F8EF7'} />
          <Text style={[styles.addSetText, isWorkoutPaused && { color: '#ccc' }]}>세트 추가</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Action buttons ──
  const actionButtons = (
    <View style={styles.actionButtonsWrap}>
      {/* #1: 운동 추가 버튼 */}
      <TouchableOpacity
        style={[styles.addExerciseButton, { borderColor: colors.primary }]}
        onPress={() => setShowAddExModal(true)}
        disabled={isWorkoutPaused}
      >
        <Ionicons name="add-circle-outline" size={18} color={isWorkoutPaused ? '#ccc' : colors.primary} />
        <Text style={[styles.addExerciseButtonText, { color: isWorkoutPaused ? '#ccc' : colors.primary }]}>
          운동 추가
        </Text>
      </TouchableOpacity>

      {/* #3/#5: 종료/재개/메인화면 */}
      {isWorkoutPaused ? (
        <>
          <TouchableOpacity style={styles.resumeWorkoutButton} onPress={handleResumeWorkout}>
            <Ionicons name="play-circle-outline" size={18} color="#fff" />
            <Text style={styles.resumeWorkoutButtonText}>운동 재개</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.goMainButton} onPress={handleGoToMain}>
            <Ionicons name="home-outline" size={16} color={colors.primary} />
            <Text style={[styles.goMainButtonText, { color: colors.primary }]}>메인화면으로</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.endWorkoutButton} onPress={handlePauseWorkout}>
          <Ionicons name="stop-circle-outline" size={18} color="#fff" />
          <Text style={styles.endWorkoutButtonText}>운동 종료</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.deleteButton, { backgroundColor: colors.destructiveBg }]}
        onPress={handleDelete}
      >
        <Ionicons name="trash-outline" size={18} color="#FF5C5C" />
        <Text style={styles.deleteButtonText}>운동 기록 삭제</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Progress card ──
  const progressCard = (
    <View style={[styles.progressCard, { backgroundColor: colors.card }]}>
      <View style={styles.progressHeader}>
        <Text style={[styles.progressLabel, { color: colors.textSub }]}>운동 진행률</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {isWorkoutPaused && (
            <View style={[styles.pausedBadge, { backgroundColor: '#FF8C0020' }]}>
              <Ionicons name="pause-circle-outline" size={12} color="#FF8C00" />
              <Text style={styles.pausedBadgeText}>종료됨</Text>
            </View>
          )}
          <Text style={styles.progressCount}>
            {completedSets} / {totalSets} 세트
          </Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      {estimatedMinutesRemaining > 0 && completedSets < totalSets && !isWorkoutPaused && (
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
          <Text style={styles.metaText}>{editedExercises.length}종목</Text>
        </View>
      </View>
    </View>
  );

  // ── Add exercise candidates ──
  const addExCandidates = EXERCISES.filter(
    (e) =>
      addExSearch === '' ||
      e.name.includes(addExSearch) ||
      e.category.includes(addExSearch) ||
      (e.description ?? '').includes(addExSearch),
  );

  // ── LARGE SCREEN: 2-column ──
  if (isLarge) {
    const selectedEx = editedExercises.find((e) => e.id === selectedExId) ?? editedExercises[0];

    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.largeLayout,
            { paddingBottom: timerActive ? TIMER_BAR_HEIGHT + insets.bottom + 8 : 16 },
          ]}
        >
          {/* Left column */}
          <View
            style={[styles.leftColumn, { backgroundColor: colors.card, borderRightColor: colors.border }]}
          >
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
                const isSelected = ex.id === selectedEx?.id;
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[
                      styles.sidebarItem,
                      {
                        backgroundColor: isSelected ? colors.primaryBg : colors.background,
                        borderColor: isSelected ? '#4F8EF7' : 'transparent',
                      },
                    ]}
                    onPress={() => setSelectedExId(ex.id)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.sidebarItemName, { color: isSelected ? '#4F8EF7' : colors.text }]}
                        numberOfLines={1}
                      >
                        {displayName(ex.exercise)}
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

          {/* Right column */}
          <ScrollView style={styles.rightColumn} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            {selectedEx && renderExerciseCard(selectedEx)}
            {actionButtons}
          </ScrollView>
        </View>

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

        {changeTargetExId && (
          <ExerciseChangeModal
            targetWexId={changeTargetExId}
            editedExercises={editedExercises}
            customAlternatives={customAlternatives}
            onClose={() => setChangeTargetExId(null)}
            onConfirm={handleChangeExercise}
            colors={colors}
          />
        )}

        {showAddExModal && (
          <AddExerciseModal
            search={addExSearch}
            onSearchChange={setAddExSearch}
            candidates={addExCandidates}
            onSelect={handleAddExercise}
            onClose={() => { setShowAddExModal(false); setAddExSearch(''); }}
            colors={colors}
          />
        )}
      </View>
    );
  }

  // ── SMALL/MEDIUM SCREEN ──
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: horizontalPad, paddingTop: 12, backgroundColor: colors.background }}>
        {progressCard}
      </View>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad, paddingHorizontal: horizontalPad },
        ]}
      >
        {headerCard}

        {workout.notes && (
          <View style={[styles.notesCard, { backgroundColor: colors.cardAlt }]}>
            <Ionicons name="document-text-outline" size={16} color={colors.textSub} />
            <Text style={[styles.notesText, { color: colors.textSub }]}>{workout.notes}</Text>
          </View>
        )}

        {editedExercises.map(renderExerciseCard)}
        {actionButtons}
      </ScrollView>

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

      {changeTargetExId && (
        <ExerciseChangeModal
          targetWexId={changeTargetExId}
          editedExercises={editedExercises}
          customAlternatives={customAlternatives}
          onClose={() => setChangeTargetExId(null)}
          onConfirm={handleChangeExercise}
          colors={colors}
        />
      )}

      {showAddExModal && (
        <AddExerciseModal
          search={addExSearch}
          onSearchChange={setAddExSearch}
          candidates={addExCandidates}
          onSelect={handleAddExercise}
          onClose={() => { setShowAddExModal(false); setAddExSearch(''); }}
          colors={colors}
        />
      )}
    </View>
  );
}

// ── Add Exercise Modal ────────────────────────────────────────
function AddExerciseModal({
  search,
  onSearchChange,
  candidates,
  onSelect,
  onClose,
  colors,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  candidates: Exercise[];
  onSelect: (id: string) => void;
  onClose: () => void;
  colors: any;
}) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={addExStyles.overlay}>
        <View style={[addExStyles.sheet, { backgroundColor: colors.card }]}>
          <View style={addExStyles.header}>
            <Text style={[addExStyles.title, { color: colors.text }]}>운동 추가</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSub} />
            </TouchableOpacity>
          </View>
          <View style={[addExStyles.searchBox, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={onSearchChange}
              placeholder="운동 검색..."
              placeholderTextColor={colors.textMuted}
              style={[addExStyles.searchInput, { color: colors.text }]}
              autoFocus
            />
          </View>
          <FlatList
            data={candidates}
            keyExtractor={(e) => e.id}
            style={addExStyles.list}
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: colors.border }} />
            )}
            ListEmptyComponent={
              <Text style={[addExStyles.empty, { color: colors.textMuted }]}>
                검색 결과가 없습니다.
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={addExStyles.item}
                onPress={() => onSelect(item.id)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[addExStyles.itemName, { color: colors.text }]}>
                    {displayName(item)}
                  </Text>
                  <Text style={[addExStyles.itemSub, { color: colors.textSub }]}>
                    {item.category} · {item.equipment}
                  </Text>
                </View>
                <View style={[addExStyles.categoryBadge, { backgroundColor: colors.primaryBg }]}>
                  <Text style={addExStyles.categoryBadgeText}>{item.category}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Helpers ──────────────────────────────────────────────────

// ── Exercise change modal ──────────────────────────────────────
type ListItem =
  | { _type: 'header'; id: string; title: string }
  | (Exercise & { _type: 'exercise' });

function ExerciseChangeModal({
  targetWexId,
  editedExercises,
  customAlternatives,
  onClose,
  onConfirm,
  colors,
}: {
  targetWexId: string;
  editedExercises: WorkoutExercise[];
  customAlternatives: CustomAlternatives;
  onClose: () => void;
  onConfirm: (targetWexId: string, newExId: string) => void;
  colors: any;
}) {
  const target = editedExercises.find((ex) => ex.id === targetWexId);
  if (!target) return null;

  const currentCategory = target.exercise.category;

  const altIds =
    customAlternatives[target.exercise.id] !== undefined
      ? customAlternatives[target.exercise.id]
      : (target.exercise.alternativeExercises ?? []);

  const altSet = new Set(altIds);
  const altExercises = altIds
    .map((id) => EXERCISES.find((e) => e.id === id))
    .filter((e): e is Exercise => !!e && e.id !== target.exercise.id);

  const categoryOthers = EXERCISES.filter(
    (e) => e.category === currentCategory && e.id !== target.exercise.id && !altSet.has(e.id),
  );

  const listData: ListItem[] = [];
  if (altExercises.length > 0) {
    listData.push({ _type: 'header', id: '__header_alt', title: '⭐ 대체 운동' });
    altExercises.forEach((e) => listData.push({ ...e, _type: 'exercise' }));
  }
  if (categoryOthers.length > 0) {
    listData.push({ _type: 'header', id: '__header_cat', title: `같은 카테고리 (${currentCategory})` });
    categoryOthers.forEach((e) => listData.push({ ...e, _type: 'exercise' }));
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={exChangeStyles.overlay}>
        <View style={[exChangeStyles.sheet, { backgroundColor: colors.card }]}>
          <View style={exChangeStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[exChangeStyles.title, { color: colors.text }]}>운동 변경</Text>
              <Text style={[exChangeStyles.subtitle, { color: colors.textSub }]}>
                현재: {displayName(target.exercise)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textSub} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={listData}
            keyExtractor={(item) => item.id}
            style={exChangeStyles.list}
            ListEmptyComponent={
              <Text style={[exChangeStyles.empty, { color: colors.textMuted }]}>
                변경 가능한 운동이 없습니다.
              </Text>
            }
            renderItem={({ item }) => {
              if (item._type === 'header') {
                return (
                  <View style={[exChangeStyles.sectionHeader, { backgroundColor: colors.cardAlt }]}>
                    <Text style={[exChangeStyles.sectionHeaderText, { color: colors.textSub }]}>
                      {item.title}
                    </Text>
                  </View>
                );
              }
              return (
                <TouchableOpacity
                  style={[exChangeStyles.item, { borderBottomColor: colors.border }]}
                  onPress={() => onConfirm(targetWexId, item.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[exChangeStyles.itemName, { color: colors.text }]}>
                      {displayName(item)}
                    </Text>
                    <Text style={[exChangeStyles.itemSub, { color: colors.textSub }]}>
                      {item.equipment}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Timer bar ─────────────────────────────────────────────────
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
      <View style={styles.timerTopRow}>
        <View style={styles.timerLeft}>
          <Ionicons name="timer-outline" size={15} color="rgba(255,255,255,0.7)" />
          <Text style={styles.timerLabel}>휴식 중</Text>
          <Text style={styles.timerDurationHint}>{formatSeconds(timerDuration)}</Text>
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

      <View style={styles.timerCountdownRow}>
        <TouchableOpacity style={styles.timerAdjustCircle} onPress={() => onAdjust(-10)}>
          <Text style={styles.timerAdjustCircleText}>−10</Text>
        </TouchableOpacity>
        <Text style={styles.timerCountdown}>{formatTime(timerSeconds)}</Text>
        <TouchableOpacity style={styles.timerAdjustCircle} onPress={() => onAdjust(10)}>
          <Text style={styles.timerAdjustCircleText}>+10</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.timerTrack}>
        <View style={[styles.timerFill, { width: `${timerProgress * 100}%` }]} />
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const addExStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%', paddingTop: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  title: { fontSize: 18, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 2 },
  list: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  itemName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  itemSub: { fontSize: 12 },
  categoryBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  categoryBadgeText: { fontSize: 11, color: '#4F8EF7', fontWeight: '600' },
  empty: { textAlign: 'center', padding: 32, fontSize: 14 },
});

const exChangeStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingTop: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 3 },
  subtitle: { fontSize: 12 },
  list: { flex: 1 },
  sectionHeader: { paddingHorizontal: 20, paddingVertical: 8 },
  sectionHeaderText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  itemName: { fontSize: 15, fontWeight: '600', marginBottom: 3 },
  itemSub: { fontSize: 12 },
  empty: { textAlign: 'center', padding: 32, fontSize: 14 },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1 },
  content: { paddingTop: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 16 },

  largeLayout: { flex: 1, flexDirection: 'row' },
  leftColumn: { width: 280, borderRightWidth: 1 },
  rightColumn: { flex: 1 },
  sidebarSectionLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 12, marginBottom: 8, marginLeft: 2,
  },
  sidebarItem: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6, borderWidth: 1.5,
  },
  sidebarItemName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  sidebarItemSets: { fontSize: 12 },

  progressCard: {
    borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 13, fontWeight: '600' },
  progressCount: { fontSize: 13, fontWeight: '700', color: '#4F8EF7' },
  progressTrack: { height: 8, backgroundColor: '#EEF0F5', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#4F8EF7', borderRadius: 4 },
  estimatedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  estimatedText: { fontSize: 12, fontWeight: '500' },
  pausedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },
  pausedBadgeText: { fontSize: 10, fontWeight: '700', color: '#FF8C00' },

  headerCard: {
    borderRadius: 16, padding: 20, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  date: { fontSize: 14, marginBottom: 14 },
  metaRow: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 14, color: '#4F8EF7', fontWeight: '600' },

  notesCard: {
    flexDirection: 'row', borderRadius: 12, padding: 14,
    marginBottom: 12, gap: 8, alignItems: 'flex-start',
  },
  notesText: { flex: 1, fontSize: 14, lineHeight: 20 },

  exerciseCard: {
    borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  exerciseCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  exerciseCardHeaderLeft: { flex: 1 },
  exerciseName: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  muscleGroups: { fontSize: 12 },
  changeExBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8,
  },
  changeExBtnText: { fontSize: 11, fontWeight: '600' },
  restTimeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  restTimeBadgeText: { fontSize: 11, color: '#4F8EF7', fontWeight: '600' },

  setTableHeader: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, paddingBottom: 8, marginBottom: 6,
  },
  headerText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  setRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 4, borderRadius: 8, marginBottom: 4,
  },
  setRowCompleted: { opacity: 0.5 },
  completedText: { color: '#aaa' },
  cellNum: { width: 28, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  cellStepper: { flex: 1, marginHorizontal: 3 },
  cellDelete: { width: 28, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  cellComplete: { width: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  checkBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  checkBtnDone: { backgroundColor: '#34C759' },
  checkBtnDisabled: { opacity: 0.4 },
  addSetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, paddingVertical: 6, alignSelf: 'flex-start',
  },
  addSetText: { fontSize: 14, color: '#4F8EF7', fontWeight: '600' },

  actionButtonsWrap: { marginTop: 4 },
  addExerciseButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 10,
  },
  addExerciseButtonText: { fontSize: 15, fontWeight: '600' },
  endWorkoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FF8C00', borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: '#FF8C00', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  endWorkoutButtonText: { fontSize: 16, color: '#fff', fontWeight: '700' },
  resumeWorkoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#34C759', borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: '#34C759', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  resumeWorkoutButtonText: { fontSize: 16, color: '#fff', fontWeight: '700' },
  goMainButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 10,
    borderColor: '#4F8EF7',
  },
  goMainButtonText: { fontSize: 15, fontWeight: '600' },
  deleteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 12, padding: 14, marginTop: 4,
  },
  deleteButtonText: { fontSize: 15, color: '#FF5C5C', fontWeight: '600' },

  timerBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 10,
  },
  timerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  timerLeft: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  timerLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  timerDurationHint: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 4 },
  timerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timerBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8,
  },
  timerBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  timerCountdownRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 16, marginBottom: 10,
  },
  timerAdjustCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  timerAdjustCircleText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },
  timerCountdown: {
    fontSize: 36, fontWeight: '800', color: '#fff',
    letterSpacing: 2, minWidth: 110, textAlign: 'center',
  },
  timerTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  timerFill: { height: 4, backgroundColor: '#4F8EF7', borderRadius: 2 },
});
