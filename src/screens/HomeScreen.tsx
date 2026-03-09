import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { RootStackParamList, Routine, Workout, WorkoutExercise, WorkoutSet } from '../types';
import { loadWorkouts, deleteWorkout, addWorkout } from '../storage/workoutStorage';
import { loadRoutines } from '../storage/routineStorage';
import { DEFAULT_EXERCISES } from '../utils/exercises';
import { useTheme } from '../context/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SWIPE_THRESHOLD = 60;
const DELETE_WIDTH = 80;

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function SwipeableWorkoutCard({
  workout,
  onPress,
  onDelete,
}: {
  workout: Workout;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const close = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    isOpen.current = false;
  };

  const open = () => {
    Animated.spring(translateX, {
      toValue: -DELETE_WIDTH,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
    isOpen.current = true;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy),
      onPanResponderMove: (_, { dx }) => {
        const base = isOpen.current ? -DELETE_WIDTH : 0;
        const next = base + dx;
        if (next <= 0 && next >= -DELETE_WIDTH - 10) {
          translateX.setValue(next);
        }
      },
      onPanResponderRelease: (_, { dx }) => {
        if (dx < -SWIPE_THRESHOLD && !isOpen.current) {
          open();
        } else if (dx > SWIPE_THRESHOLD / 2 && isOpen.current) {
          close();
        } else if (isOpen.current) {
          open();
        } else {
          close();
        }
      },
    }),
  ).current;

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.deleteBackground}>
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={() => {
            close();
            onDelete();
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.deleteActionText}>삭제</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity
          style={[styles.workoutCard, { backgroundColor: colors.card }]}
          onPress={() => {
            if (isOpen.current) {
              close();
            } else {
              onPress();
            }
          }}
          activeOpacity={0.8}
        >
          <View style={styles.workoutCardLeft}>
            <Text style={[styles.workoutTitle, { color: colors.text }]}>{workout.title}</Text>
            <Text style={[styles.workoutMeta, { color: colors.textSub }]}>
              {format(new Date(workout.date), 'M월 d일', { locale: ko })}
              {workout.duration ? `  ·  ${workout.duration}분` : ''}
            </Text>
          </View>
          <View style={styles.workoutCardRight}>
            <Text style={styles.workoutExerciseCount}>{workout.exercises.length}종목</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts().then((all) => setRecentWorkouts(all.slice(0, 3)));
      loadRoutines().then(setRoutines);
    }, []),
  );

  const today = format(new Date(), 'M월 d일 (EEEE)', { locale: ko });

  const handleDeleteWorkout = (id: string, title: string) => {
    showAlert('운동 삭제', `"${title}"를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkout(id);
            setRecentWorkouts((prev) => prev.filter((w) => w.id !== id));
          } catch {
            showAlert('오류', '운동 기록 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  // ── 루틴으로 운동 시작: 새 workout 생성 → WorkoutDetail 이동 ──
  const handleStartRoutine = async (routine: Routine) => {
    const exercises: WorkoutExercise[] = routine.exercises
      .map((re): WorkoutExercise | null => {
        const exercise = DEFAULT_EXERCISES.find((e) => e.id === re.exerciseId);
        if (!exercise) return null;
        return {
          id: generateId(),
          exercise,
          sets: re.sets.map((s): WorkoutSet => ({
            id: generateId(),
            weight: s.weight,
            reps: s.reps,
            completed: false,
          })),
        };
      })
      .filter((ex): ex is WorkoutExercise => ex !== null);

    const dateLabel = format(new Date(), 'M월 d일', { locale: ko });
    const newWorkout: Workout = {
      id: generateId(),
      title: `${dateLabel} - ${routine.name}`,
      date: new Date().toISOString(),
      exercises,
    };

    try {
      await addWorkout(newWorkout);
      navigation.navigate('WorkoutDetail', { workoutId: newWorkout.id });
    } catch {
      showAlert('오류', '운동 시작에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: colors.text }]}>안녕하세요!</Text>
        <Text style={[styles.date, { color: colors.textSub }]}>{today}</Text>
      </View>

      <TouchableOpacity
        style={styles.startButton}
        onPress={() => navigation.navigate('AddWorkout', {})}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle-outline" size={28} color="#fff" />
        <Text style={styles.startButtonText}>오늘 운동 시작하기</Text>
      </TouchableOpacity>

      {/* 루틴 섹션 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>내 루틴</Text>
          <View style={styles.sectionActions}>
            <TouchableOpacity
              style={[styles.sectionPlusBtn, { backgroundColor: colors.primaryBg }]}
              onPress={() => navigation.navigate('ManageRoutines', { openForm: true })}
            >
              <Ionicons name="add" size={20} color="#4F8EF7" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('ManageRoutines', {})}>
              <Text style={styles.sectionAction}>관리</Text>
            </TouchableOpacity>
          </View>
        </View>

        {routines.length === 0 ? (
          <TouchableOpacity
            style={[styles.emptyRoutineBox, { backgroundColor: colors.primaryBg }]}
            onPress={() => navigation.navigate('ManageRoutines', { openForm: true })}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={24} color="#4F8EF7" />
            <Text style={styles.emptyRoutineText}>루틴을 추가해 빠르게 시작하세요</Text>
          </TouchableOpacity>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.routineRow}
          >
            {routines.map((r) => {
              const names = r.exercises
                .slice(0, 3)
                .map((re) => DEFAULT_EXERCISES.find((e) => e.id === re.exerciseId)?.name)
                .filter(Boolean)
                .join(', ');
              return (
                /* 카드 탭 → 루틴 편집으로 이동 */
                <TouchableOpacity
                  key={r.id}
                  style={[styles.routineCard, { backgroundColor: colors.card }]}
                  onPress={() => navigation.navigate('ManageRoutines', { routineId: r.id })}
                  activeOpacity={0.9}
                >
                  <View style={[styles.routineIconCircle, { backgroundColor: colors.primaryBg }]}>
                    <Ionicons name="barbell-outline" size={20} color="#4F8EF7" />
                  </View>
                  <Text style={[styles.routineCardName, { color: colors.text }]} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={[styles.routineCardExercises, { color: colors.textSub }]} numberOfLines={2}>
                    {names}
                    {r.exercises.length > 3 ? ` 외 ${r.exercises.length - 3}개` : ''}
                  </Text>

                  {/* 시작하기 → 오늘의 운동 생성 + 상세화면 이동 */}
                  <TouchableOpacity
                    style={styles.routineStartBtn}
                    onPress={() => handleStartRoutine(r)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.routineStartText}>시작하기</Text>
                    <Ionicons name="arrow-forward" size={13} color="#fff" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* 최근 운동 섹션 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>최근 운동</Text>
        {recentWorkouts.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card }]}>
            <Ionicons name="barbell-outline" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSub }]}>아직 기록된 운동이 없어요.</Text>
            <Text style={[styles.emptySubText, { color: colors.textMuted }]}>첫 번째 운동을 시작해보세요!</Text>
          </View>
        ) : (
          recentWorkouts.map((w) => (
            <SwipeableWorkoutCard
              key={w.id}
              workout={w}
              onPress={() => navigation.navigate('WorkoutDetail', { workoutId: w.id })}
              onDelete={() => handleDeleteWorkout(w.id, w.title)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 24 },
  greeting: { fontSize: 26, fontWeight: '700', color: '#1A1A2E' },
  date: { fontSize: 14, color: '#888', marginTop: 4 },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F8EF7',
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
    marginBottom: 32,
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  startButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionPlusBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionAction: { fontSize: 14, color: '#4F8EF7', fontWeight: '600' },
  emptyRoutineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#EEF4FF',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#C8DEFF',
    borderStyle: 'dashed',
  },
  emptyRoutineText: { fontSize: 14, color: '#4F8EF7', fontWeight: '500' },
  routineRow: { gap: 12, paddingRight: 4, paddingBottom: 4 },
  routineCard: {
    width: 150,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  routineIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  routineCardName: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  routineCardExercises: { fontSize: 12, color: '#999', lineHeight: 17, marginBottom: 10, flex: 1 },
  routineStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#4F8EF7',
    borderRadius: 8,
    paddingVertical: 7,
  },
  routineStartText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 16,
    gap: 8,
  },
  emptyText: { fontSize: 15, color: '#999', marginTop: 4 },
  emptySubText: { fontSize: 13, color: '#bbb' },
  swipeContainer: { marginBottom: 10, borderRadius: 14, overflow: 'hidden' },
  deleteBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FF5C5C',
    borderRadius: 14,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  deleteAction: {
    width: DELETE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: '100%',
  },
  deleteActionText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  workoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  workoutCardLeft: { flex: 1 },
  workoutTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  workoutMeta: { fontSize: 13, color: '#999', marginTop: 4 },
  workoutCardRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  workoutExerciseCount: { fontSize: 13, color: '#4F8EF7', fontWeight: '600' },
});
