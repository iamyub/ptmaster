import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useWorkout, MINI_BAR_HEIGHT } from '../context/WorkoutContext';

const GREETINGS = [
  '운동의 절반은 현관문을 열고 나가는 것',
  '운동 안하면 빨리 늙는다',
  '오늘 운동 많이 된다. 잠 잘올꺼야',
  '운동은 하루를 짧게 하지만, 인생을 길게 만든다.',
];

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
  const { activeWorkout } = useWorkout();
  const navigation = useNavigation<Nav>();
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

  const isLarge = width >= 600;
  const isMedium = width >= 400;
  const hPad = isLarge ? 28 : isMedium ? 24 : 20;
  const extraBottomPad = activeWorkout ? MINI_BAR_HEIGHT : 0;

  useFocusEffect(
    useCallback(() => {
      loadWorkouts().then((all) => {
        setTotalWorkouts(all.length);
        setRecentWorkouts(all.slice(0, 5));
      });
      loadRoutines().then(setRoutines);
    }, [isLarge]),
  );

  const today = format(new Date(), 'M월 d일 (EEEE)', { locale: ko });

  const getWeatherIcon = () => {
    const day = new Date().getDate();
    if (day % 4 === 0) return { name: 'sunny', color: '#FFB800' };
    if (day % 4 === 1) return { name: 'cloudy', color: '#90A4AE' };
    if (day % 4 === 2) return { name: 'rainy', color: '#4F8EF7' };
    return { name: 'snow', color: '#B0BEC5' };
  };
  const weather = getWeatherIcon();

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
            setTotalWorkouts((prev) => prev - 1);
          } catch {
            showAlert('오류', '운동 기록 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

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
      navigation.navigate('WorkoutDetail', { workoutId: newWorkout.id, autoStart: true });
    } catch {
      showAlert('오류', '운동 시작에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // Large screen: 2-col grid for recent workouts
  const renderRecentWorkouts = () => {
    if (recentWorkouts.length === 0) {
      return (
        <View style={[styles.emptyBox, { backgroundColor: colors.card }]}>
          <Ionicons name="barbell-outline" size={40} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSub }]}>
            아직 기록된 운동이 없어요.
          </Text>
          <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
            첫 번째 운동을 시작해보세요!
          </Text>
        </View>
      );
    }

    if (isLarge) {
      // 2-column grid
      const rows: Workout[][] = [];
      for (let i = 0; i < recentWorkouts.length; i += 2) {
        rows.push(recentWorkouts.slice(i, i + 2));
      }
      return rows.map((row, ri) => (
        <View key={ri} style={styles.gridRow}>
          {row.map((w) => (
            <TouchableOpacity
              key={w.id}
              style={[styles.gridWorkoutCard, { backgroundColor: colors.card }]}
              onPress={() => navigation.navigate('WorkoutDetail', { workoutId: w.id })}
              onLongPress={() => handleDeleteWorkout(w.id, w.title)}
              activeOpacity={0.8}
            >
              <Text style={[styles.workoutTitle, { color: colors.text }]} numberOfLines={1}>
                {w.title}
              </Text>
              <Text style={[styles.workoutMeta, { color: colors.textSub }]}>
                {format(new Date(w.date), 'M월 d일', { locale: ko })}
                {w.duration ? `  ·  ${w.duration}분` : ''}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                <Ionicons name="barbell-outline" size={14} color="#4F8EF7" />
                <Text style={[styles.workoutExerciseCount, { fontSize: 13 }]}>
                  {w.exercises.length}종목
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {row.length < 2 && <View style={{ flex: 1, margin: 4 }} />}
        </View>
      ));
    }

    return recentWorkouts.map((w) => (
      <SwipeableWorkoutCard
        key={w.id}
        workout={w}
        onPress={() => navigation.navigate('WorkoutDetail', { workoutId: w.id })}
        onDelete={() => handleDeleteWorkout(w.id, w.title)}
      />
    ));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 고정 상단 헤더 */}
      <View style={[styles.stickyHeader, { 
        backgroundColor: colors.background, 
        paddingTop: insets.top + 16,
        paddingHorizontal: hPad,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border + '40'
      }]}>
        <Text style={[styles.greeting, { color: colors.text, fontSize: isLarge ? 28 : 24 }]}>
          {greeting}
        </Text>
        <View style={styles.dateWeatherRow}>
          <Ionicons name={weather.name as any} size={18} color={weather.color} style={{ marginRight: 6 }} />
          <Text style={[styles.date, { color: colors.textSub, fontSize: isLarge ? 15 : 14 }]}>
            {today}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { padding: hPad, paddingTop: 20, paddingBottom: 40 + extraBottomPad }]}
      >
        <View style={styles.startArea}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => navigation.navigate('AddWorkout', {})}
          activeOpacity={0.85}
        >
          <Ionicons name="barbell-outline" size={isLarge ? 48 : 40} color="#fff" />
          <Text style={[styles.startButtonText, { fontSize: isLarge ? 17 : 15 }]}>
            오늘 운동{"\n"}시작하기
          </Text>
        </TouchableOpacity>
      </View>

      {/* 루틴 섹션 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontSize: isLarge ? 20 : 18 }]}>
            내 루틴
          </Text>
          <View style={styles.sectionActions}>
            <TouchableOpacity onPress={() => navigation.navigate('ManageRoutines', {})}>
              <Text style={styles.sectionAction}>관리</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.routineRow}
        >
          <TouchableOpacity
            style={[
              styles.routineCard,
              {
                backgroundColor: colors.card,
                width: isLarge ? 180 : 150,
                borderWidth: 1.5,
                borderColor: '#4F8EF7',
                borderStyle: 'dashed',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 6,
              },
            ]}
            onPress={() => navigation.navigate('ManageRoutines', { openForm: true })}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={28} color="#4F8EF7" />
            <Text style={{ color: '#4F8EF7', fontWeight: '700', fontSize: 13 }}>루틴 추가</Text>
          </TouchableOpacity>
          {routines.map((r) => {
            const names = r.exercises
              .slice(0, 3)
              .map((re) => DEFAULT_EXERCISES.find((e) => e.id === re.exerciseId)?.name)
              .filter(Boolean)
              .join(', ');
            return (
              <TouchableOpacity
                key={r.id}
                style={[
                  styles.routineCard,
                  { backgroundColor: colors.card, width: isLarge ? 180 : 150 },
                ]}
                onPress={() => navigation.navigate('ManageRoutines', { routineId: r.id })}
                activeOpacity={0.9}
              >
                <View style={[styles.routineIconCircle, { backgroundColor: colors.primaryBg }]}>
                  <Ionicons name="barbell-outline" size={isLarge ? 24 : 20} color="#4F8EF7" />
                </View>
                <Text
                  style={[styles.routineCardName, { color: colors.text, fontSize: isLarge ? 15 : 14 }]}
                  numberOfLines={1}
                >
                  {r.name}
                </Text>
                <Text
                  style={[styles.routineCardExercises, { color: colors.textSub }]}
                  numberOfLines={2}
                >
                  {names}
                  {r.exercises.length > 3 ? ` 외 ${r.exercises.length - 3}개` : ''}
                </Text>
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
      </View>

      {/* 최근 운동 섹션 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: isLarge ? 20 : 18, marginBottom: 14 }]}>
          최근 운동
        </Text>
        {renderRecentWorkouts()}
        {totalWorkouts > 5 && (
          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => (navigation as any).navigate('History')}
            activeOpacity={0.7}
          >
            <Text style={[styles.moreButtonText, { color: colors.primary }]}>더보기</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 40 },
  stickyHeader: {
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 3,
  },
  header: { marginBottom: 20 },
  greeting: { fontSize: 26, fontWeight: '800', lineHeight: 34 },
  dateWeatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  date: { fontSize: 14 },
  startArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  startButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#4F8EF7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  startButtonText: {
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionPlusBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionAction: { fontSize: 14, color: '#4F8EF7', fontWeight: '600' },
  emptyRoutineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  routineCardName: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  routineCardExercises: { fontSize: 12, lineHeight: 17, marginBottom: 10, flex: 1 },
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

  // 빈 상태
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    borderRadius: 16,
    gap: 8,
  },
  emptyText: { fontSize: 15, marginTop: 4 },
  emptySubText: { fontSize: 13 },

  // 스와이프 카드
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
    borderRadius: 14,
    padding: 16,
  },
  workoutCardLeft: { flex: 1 },
  workoutTitle: { fontSize: 15, fontWeight: '600' },
  workoutMeta: { fontSize: 13, marginTop: 4 },
  workoutCardRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  workoutExerciseCount: { fontSize: 13, color: '#4F8EF7', fontWeight: '600' },

  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    marginTop: 4,
  },
  moreButtonText: { fontSize: 14, fontWeight: '600' },

  // Large screen 2-col grid
  gridRow: { flexDirection: 'row', marginBottom: 10 },
  gridWorkoutCard: {
    flex: 1,
    margin: 4,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
});
