import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  format,
  startOfWeek,
  addWeeks,
  subWeeks,
  isSameDay,
  addMonths,
  subMonths,
  startOfMonth,
  getDaysInMonth,
  getDay,
  parseISO,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { RootStackParamList, Workout } from '../types';
import { loadWorkouts, deleteWorkout } from '../storage/workoutStorage';
import { useTheme } from '../context/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ViewMode = 'daily' | 'weekly' | 'monthly';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export default function HistoryScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts().then(setWorkouts);
    }, []),
  );

  const workoutsByDate = useMemo(() => {
    const map: Record<string, Workout[]> = {};
    for (const w of workouts) {
      const key = format(parseISO(w.date), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(w);
    }
    return map;
  }, [workouts]);

  const getDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

  const handleDelete = (id: string, title: string) => {
    showAlert('운동 삭제', `"${title}"를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkout(id);
            setWorkouts((prev) => prev.filter((w) => w.id !== id));
          } catch {
            showAlert('오류', '운동 기록 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  // ── 세그먼트 컨트롤 ──
  const SegmentControl = () => (
    <View style={[styles.segmentWrapper, { backgroundColor: colors.segmentBg }]}>
      {(['daily', 'weekly', 'monthly'] as ViewMode[]).map((mode) => {
        const labels: Record<ViewMode, string> = { daily: '일별', weekly: '주별', monthly: '월별' };
        const active = viewMode === mode;
        return (
          <TouchableOpacity
            key={mode}
            style={[styles.segmentBtn, active && [styles.segmentBtnActive, { backgroundColor: colors.card }]]}
            onPress={() => {
              setViewMode(mode);
              setSelectedDate(null);
            }}
          >
            <Text style={[styles.segmentText, { color: colors.textSub }, active && styles.segmentTextActive]}>
              {labels[mode]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── 운동 카드 ──
  const WorkoutCard = ({ item }: { item: Workout }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.id })}
      onLongPress={() => handleDelete(item.id, item.title)}
      activeOpacity={0.8}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.cardDate, { color: colors.textSub }]}>
          {format(parseISO(item.date), 'M월 d일 (EEE)', { locale: ko })}
        </Text>
      </View>
      <View style={styles.cardBottom}>
        <View style={styles.tag}>
          <Ionicons name="barbell-outline" size={14} color="#4F8EF7" />
          <Text style={styles.tagText}>{item.exercises.length}종목</Text>
        </View>
        {item.duration && (
          <View style={styles.tag}>
            <Ionicons name="time-outline" size={14} color="#4F8EF7" />
            <Text style={styles.tagText}>{item.duration}분</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // ── 선택된 날 운동 목록 ──
  const SelectedDayWorkouts = ({ date }: { date: Date }) => {
    const key = getDateKey(date);
    const dayWorkouts = workoutsByDate[key] ?? [];
    return (
      <View style={styles.selectedSection}>
        <Text style={[styles.selectedTitle, { color: colors.textSub }]}>
          {format(date, 'M월 d일 (EEE)', { locale: ko })}
        </Text>
        {dayWorkouts.length === 0 ? (
          <Text style={[styles.noWorkoutText, { color: colors.textMuted }]}>이 날 운동 기록이 없어요.</Text>
        ) : (
          dayWorkouts.map((w) => <WorkoutCard key={w.id} item={w} />)
        )}
      </View>
    );
  };

  // ── 일별뷰 ──
  const DailyView = () => {
    if (workouts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={60} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSub }]}>운동 기록이 없어요.</Text>
          <Text style={[styles.emptySubText, { color: colors.textMuted }]}>운동을 완료하면 여기에 기록됩니다.</Text>
        </View>
      );
    }
    return (
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={workouts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <WorkoutCard item={item} />}
      />
    );
  };

  // ── 주별뷰 ──
  const WeeklyView = () => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });

    return (
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {/* 주 네비게이션 */}
        <View style={[styles.navRow, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => {
              setWeekStart(subWeeks(weekStart, 1));
              setSelectedDate(null);
            }}
          >
            <Ionicons name="chevron-back" size={22} color="#4F8EF7" />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: colors.text }]}>
            {format(weekStart, 'yyyy년 M월 d일', { locale: ko })} 주
          </Text>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => {
              setWeekStart(addWeeks(weekStart, 1));
              setSelectedDate(null);
            }}
          >
            <Ionicons name="chevron-forward" size={22} color="#4F8EF7" />
          </TouchableOpacity>
        </View>

        {/* 7일 그리드 */}
        <View style={[styles.weekGrid, { backgroundColor: colors.card }]}>
          {days.map((day, i) => {
            const key = getDateKey(day);
            const hasWorkout = !!workoutsByDate[key];
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
            const isToday = isSameDay(day, new Date());
            return (
              <TouchableOpacity
                key={key}
                style={[styles.weekDayCell, isSelected && styles.weekDayCellSelected]}
                onPress={() => setSelectedDate(isSelected ? null : day)}
              >
                <Text style={[styles.weekDayLabel, { color: colors.textSub }, isToday && styles.weekDayLabelToday]}>
                  {DAY_LABELS[i]}
                </Text>
                <Text
                  style={[
                    styles.weekDayNum,
                    { color: colors.text },
                    isToday && styles.weekDayNumToday,
                    isSelected && styles.weekDayNumSelected,
                  ]}
                >
                  {format(day, 'd')}
                </Text>
                {hasWorkout ? (
                  <View style={[styles.dot, isSelected && styles.dotSelected]} />
                ) : (
                  <View style={styles.dotEmpty} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedDate && <SelectedDayWorkouts date={selectedDate} />}
      </ScrollView>
    );
  };

  // ── 월별뷰 ──
  const MonthlyView = () => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = startOfMonth(monthDate);
    let startOffset = getDay(firstDay) - 1;
    if (startOffset < 0) startOffset = 6; // 일요일이면 6 (월요일 시작 기준)

    const daysCount = getDaysInMonth(monthDate);
    const cells: (Date | null)[] = [
      ...Array<null>(startOffset).fill(null),
      ...Array.from({ length: daysCount }, (_, i) => new Date(year, month, i + 1)),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    return (
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {/* 월 네비게이션 */}
        <View style={[styles.navRow, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => {
              setMonthDate(subMonths(monthDate, 1));
              setSelectedDate(null);
            }}
          >
            <Ionicons name="chevron-back" size={22} color="#4F8EF7" />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: colors.text }]}>
            {format(monthDate, 'yyyy년 M월', { locale: ko })}
          </Text>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => {
              setMonthDate(addMonths(monthDate, 1));
              setSelectedDate(null);
            }}
          >
            <Ionicons name="chevron-forward" size={22} color="#4F8EF7" />
          </TouchableOpacity>
        </View>

        {/* 요일 헤더 */}
        <View style={styles.calHeaderRow}>
          {DAY_LABELS.map((d) => (
            <Text key={d} style={[styles.calHeaderCell, { color: colors.textMuted }]}>
              {d}
            </Text>
          ))}
        </View>

        {/* 날짜 그리드 */}
        <View style={[styles.calGrid, { backgroundColor: colors.card }]}>
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.calWeekRow}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={styles.calCell} />;
                const key = getDateKey(day);
                const hasWorkout = !!workoutsByDate[key];
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                const isToday = isSameDay(day, new Date());
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.calCell, isSelected && styles.calCellSelected]}
                    onPress={() => setSelectedDate(isSelected ? null : day)}
                  >
                    <Text
                      style={[
                        styles.calCellText,
                        { color: colors.text },
                        isToday && styles.calCellToday,
                        isSelected && styles.calCellTextSelected,
                      ]}
                    >
                      {format(day, 'd')}
                    </Text>
                    {hasWorkout && (
                      <View style={[styles.dot, isSelected && styles.dotSelected]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {selectedDate && <SelectedDayWorkouts date={selectedDate} />}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SegmentControl />
      {viewMode === 'daily' && <DailyView />}
      {viewMode === 'weekly' && <WeeklyView />}
      {viewMode === 'monthly' && <MonthlyView />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },

  // 세그먼트
  segmentWrapper: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#E8EAF0',
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: { fontSize: 14, fontWeight: '500', color: '#888' },
  segmentTextActive: { color: '#4F8EF7', fontWeight: '700' },

  // 리스트
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },

  // 빈 상태
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: { fontSize: 16, color: '#999', marginTop: 8 },
  emptySubText: { fontSize: 13, color: '#bbb' },

  // 운동 카드
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', flex: 1 },
  cardDate: { fontSize: 13, color: '#999' },
  cardBottom: { flexDirection: 'row', gap: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { fontSize: 13, color: '#4F8EF7', fontWeight: '500' },

  // 네비게이션 (주별/월별)
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  navBtn: { padding: 6 },
  navTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },

  // 주별 그리드
  weekGrid: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  weekDayCellSelected: { backgroundColor: '#EEF4FF' },
  weekDayLabel: { fontSize: 11, color: '#999', fontWeight: '500' },
  weekDayLabelToday: { color: '#4F8EF7' },
  weekDayNum: { fontSize: 16, fontWeight: '600', color: '#333' },
  weekDayNumToday: { color: '#4F8EF7' },
  weekDayNumSelected: {
    color: '#fff',
    backgroundColor: '#4F8EF7',
    borderRadius: 12,
    width: 28,
    height: 28,
    textAlign: 'center',
    lineHeight: 28,
    overflow: 'hidden',
  },

  // 월별 달력
  calHeaderRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calHeaderCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#aaa',
    paddingVertical: 4,
  },
  calGrid: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  calWeekRow: { flexDirection: 'row' },
  calCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    gap: 3,
    borderRadius: 8,
    margin: 1,
  },
  calCellSelected: { backgroundColor: '#EEF4FF' },
  calCellText: { fontSize: 14, color: '#333', fontWeight: '500' },
  calCellToday: { color: '#4F8EF7', fontWeight: '700' },
  calCellTextSelected: { color: '#4F8EF7', fontWeight: '700' },

  // 공통 점
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4F8EF7',
  },
  dotSelected: { backgroundColor: '#4F8EF7' },
  dotEmpty: { width: 6, height: 6 },

  // 선택된 날 섹션
  selectedSection: { marginTop: 4 },
  selectedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555',
    marginBottom: 10,
    marginLeft: 2,
  },
  noWorkoutText: { fontSize: 14, color: '#bbb', textAlign: 'center', paddingVertical: 20 },
});
