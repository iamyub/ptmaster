import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
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
import { fireAlarm } from '../utils/alarmHelper';
import SetStepper from '../components/SetStepper';

type Route = RouteProp<RootStackParamList, 'WorkoutDetail'>;

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const TIMER_BAR_HEIGHT = 118;

export default function WorkoutDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { workoutId } = route.params;
  const insets = useSafeAreaInsets();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [editedExercises, setEditedExercises] = useState<WorkoutExercise[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // ── 설정 상태 ──
  const [defaultRestTime, setDefaultRestTime] = useState(90);
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [exerciseRestTimes, setExerciseRestTimes] = useState<ExerciseRestTimes>({});

  // ── 타이머 상태 ──
  const [timerDuration, setTimerDuration] = useState(90);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 설정 로드
  useEffect(() => {
    Promise.all([
      loadRestTime(),
      loadAlarmSettings(),
      loadExerciseRestTimes(),
    ]).then(([restTime, alarm, exTimes]) => {
      setDefaultRestTime(restTime);
      setTimerDuration(restTime);
      setAlarmSettings(alarm);
      setExerciseRestTimes(exTimes);
    });
  }, []);

  // 타이머 틱
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
          fireAlarm(alarmSettings);
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
  }, [timerActive, alarmSettings]);

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

  const resetTimer = () => startTimer(timerDuration);

  const adjustTimerDuration = (delta: number) => {
    const next = Math.max(10, timerDuration + delta);
    setTimerDuration(next);
    if (timerActive) setTimerSeconds((s) => Math.max(1, s + delta));
  };

  useFocusEffect(
    useCallback(() => {
      loadWorkouts().then((all) => {
        const found = all.find((w) => w.id === workoutId);
        if (found) {
          setWorkout(found);
          setEditedExercises(
            found.exercises.map((ex) => ({ ...ex, sets: ex.sets.map((s) => ({ ...s })) })),
          );
          setHasChanges(false);
        }
      });
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }, [workoutId]),
  );

  // ── 진행률 ──
  const totalSets = editedExercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const completedSets = editedExercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
    0,
  );
  const progress = totalSets === 0 ? 0 : completedSets / totalSets;

  const updateExercises = (updater: (prev: WorkoutExercise[]) => WorkoutExercise[]) => {
    setEditedExercises(updater);
    setHasChanges(true);
  };

  // ── 세트 완료 토글 ──
  const toggleCompleted = (
    exId: string,
    setId: string,
    currentCompleted: boolean,
    exerciseId: string,
  ) => {
    if (currentCompleted) {
      // 완료 → 미완료: 확인 다이얼로그
      Alert.alert('세트 완료 취소', '이 세트의 완료를 취소하시겠습니까?', [
        { text: '아니요', style: 'cancel' },
        {
          text: '취소',
          style: 'destructive',
          onPress: () => {
            updateExercises((prev) =>
              prev.map((ex) => {
                if (ex.id !== exId) return ex;
                return {
                  ...ex,
                  sets: ex.sets.map((s) =>
                    s.id === setId ? { ...s, completed: false } : s,
                  ),
                };
              }),
            );
            skipTimer();
          },
        },
      ]);
      return;
    }

    // 미완료 → 완료
    updateExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, completed: true } : s)),
        };
      }),
    );
    // 운동별 개별 휴식시간 우선, 없으면 기본값
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
    const updated: Workout = { ...workout, exercises: editedExercises };
    await updateWorkout(updated);
    setWorkout(updated);
    setHasChanges(false);
    Alert.alert('저장 완료', '운동 기록이 저장되었습니다.');
  };

  const handleDelete = () => {
    if (!workout) return;
    Alert.alert('운동 삭제', `"${workout.title}"를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkout(workoutId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (!workout) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>운동 기록을 찾을 수 없어요.</Text>
      </View>
    );
  }

  const timerProgress = timerDuration > 0 ? timerSeconds / timerDuration : 0;
  const bottomPad = timerActive ? TIMER_BAR_HEIGHT + insets.bottom + 8 : 40;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
        {/* 진행률 바 */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>세트 진행률</Text>
            <Text style={styles.progressCount}>{completedSets} / {totalSets} 세트</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* 헤더 카드 */}
        <View style={styles.headerCard}>
          <Text style={styles.title}>{workout.title}</Text>
          <Text style={styles.date}>
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

        {workout.notes && (
          <View style={styles.notesCard}>
            <Ionicons name="document-text-outline" size={16} color="#888" />
            <Text style={styles.notesText}>{workout.notes}</Text>
          </View>
        )}

        {/* 운동별 세트 편집 */}
        {editedExercises.map((ex) => {
          const customRestTime = exerciseRestTimes[ex.exercise.id];
          const effectiveRestTime = customRestTime != null ? customRestTime : defaultRestTime;

          return (
            <View key={ex.id} style={styles.exerciseCard}>
              <View style={styles.exerciseCardHeader}>
                <View style={styles.exerciseCardHeaderLeft}>
                  <Text style={styles.exerciseName}>{ex.exercise.name}</Text>
                  <Text style={styles.muscleGroups}>{ex.exercise.muscleGroups.join(' · ')}</Text>
                </View>
                <View style={styles.restTimeBadge}>
                  <Ionicons name="timer-outline" size={12} color="#4F8EF7" />
                  <Text style={styles.restTimeBadgeText}>{effectiveRestTime}초</Text>
                </View>
              </View>

              {/* 테이블 헤더 */}
              <View style={styles.setTableHeader}>
                <Text style={[styles.cellNum, styles.headerText]}>세트</Text>
                <Text style={[styles.cellStepper, styles.headerText]}>무게 (kg)</Text>
                <Text style={[styles.cellStepper, styles.headerText]}>횟수</Text>
                <View style={styles.cellDelete} />
                <Text style={[styles.cellComplete, styles.headerText]}>완료</Text>
              </View>

              {/* 세트 행 */}
              {ex.sets.map((s, idx) => (
                <View key={s.id} style={[styles.setRow, s.completed && styles.setRowCompleted]}>
                  <Text style={[styles.cellNum, s.completed && styles.completedText]}>
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

                  {/* 완료 버튼 (20~25% 줄임: 44→34) */}
                  <TouchableOpacity
                    style={[
                      styles.cellComplete,
                      styles.checkBtn,
                      s.completed && styles.checkBtnDone,
                    ]}
                    onPress={() => toggleCompleted(ex.id, s.id, s.completed, ex.exercise.id)}
                  >
                    <Ionicons name="checkmark" size={16} color={s.completed ? '#fff' : '#bbb'} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* 세트 추가 */}
              <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(ex.id)}>
                <Ionicons name="add-circle-outline" size={16} color="#4F8EF7" />
                <Text style={styles.addSetText}>세트 추가</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {hasChanges && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>변경사항 저장</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color="#FF5C5C" />
          <Text style={styles.deleteButtonText}>운동 기록 삭제</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── 휴식 타이머 바 ── */}
      {timerActive && (
        <View style={[styles.timerBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.timerTopRow}>
            <View style={styles.timerLeft}>
              <Ionicons name="timer-outline" size={15} color="rgba(255,255,255,0.7)" />
              <Text style={styles.timerLabel}>휴식 중</Text>
            </View>
            <Text style={styles.timerCountdown}>{formatTime(timerSeconds)}</Text>
            <View style={styles.timerRight}>
              <TouchableOpacity style={styles.timerBtn} onPress={skipTimer}>
                <Text style={styles.timerBtnText}>스킵</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.timerBtn} onPress={resetTimer}>
                <Ionicons name="refresh-outline" size={15} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.timerTrack}>
            <View style={[styles.timerFill, { width: `${timerProgress * 100}%` }]} />
          </View>

          <View style={styles.timerAdjustRow}>
            <TouchableOpacity style={styles.timerAdjustBtn} onPress={() => adjustTimerDuration(-10)}>
              <Text style={styles.timerAdjustText}>−10초</Text>
            </TouchableOpacity>
            <Text style={styles.timerDurationText}>{timerDuration}초</Text>
            <TouchableOpacity style={styles.timerAdjustBtn} onPress={() => adjustTimerDuration(10)}>
              <Text style={styles.timerAdjustText}>+10초</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F6FA' },
  container: { flex: 1 },
  content: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 16, color: '#999' },

  progressCard: {
    backgroundColor: '#fff',
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
  progressLabel: { fontSize: 13, fontWeight: '600', color: '#888' },
  progressCount: { fontSize: 13, fontWeight: '700', color: '#4F8EF7' },
  progressTrack: { height: 8, backgroundColor: '#EEF0F5', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#4F8EF7', borderRadius: 4 },

  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  date: { fontSize: 14, color: '#999', marginBottom: 14 },
  metaRow: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 14, color: '#4F8EF7', fontWeight: '600' },

  notesCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  notesText: { flex: 1, fontSize: 14, color: '#555', lineHeight: 20 },

  exerciseCard: {
    backgroundColor: '#fff',
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
  exerciseName: { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  muscleGroups: { fontSize: 12, color: '#999' },
  restTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF4FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  restTimeBadgeText: { fontSize: 11, color: '#4F8EF7', fontWeight: '600' },

  setTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 8,
    marginBottom: 6,
  },
  headerText: { fontSize: 11, fontWeight: '700', color: '#aaa', textAlign: 'center' },

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
    color: '#333',
    fontWeight: '600',
  },
  cellStepper: { flex: 1, marginHorizontal: 3 },
  cellDelete: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  // 완료 버튼 셀 (줄인 크기)
  cellComplete: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  // 완료 버튼 (44→34, 약 23% 감소)
  checkBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8E8E8',
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
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  deleteButtonText: { fontSize: 15, color: '#FF5C5C', fontWeight: '600' },

  // ── 타이머 바 ──
  timerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  timerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  timerLeft: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  timerLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  timerCountdown: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
    flex: 1,
    textAlign: 'center',
  },
  timerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' },
  timerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
  },
  timerBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  timerTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  timerFill: { height: 6, backgroundColor: '#4F8EF7', borderRadius: 3 },
  timerAdjustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timerAdjustBtn: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  timerAdjustText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  timerDurationText: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
});
