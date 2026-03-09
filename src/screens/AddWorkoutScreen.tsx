import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { RootStackParamList, Workout, WorkoutExercise, WorkoutSet } from '../types';
import { DEFAULT_EXERCISES } from '../utils/exercises';
import { addWorkout, loadWorkouts } from '../storage/workoutStorage';
import SetStepper from '../components/SetStepper';
import { useTheme } from '../context/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'AddWorkout'>;

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function createDefaultSet(weight = 0, reps = 0): WorkoutSet {
  return { id: generateId(), weight, reps, completed: false };
}

function findLastSets(workouts: Workout[], exerciseId: string): { weight: number; reps: number }[] {
  for (const w of workouts) {
    const found = w.exercises.find((e) => e.exercise.id === exerciseId);
    if (found) return found.sets.map((s) => ({ weight: s.weight, reps: s.reps }));
  }
  return [];
}

export default function AddWorkoutScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const routineExercises = route.params?.routineExercises;
  const routineName = route.params?.routineName;

  const defaultTitle = routineName
    ? `${format(new Date(), 'M월 d일', { locale: ko })} - ${routineName}`
    : format(new Date(), 'M월 d일 운동', { locale: ko });

  const [title, setTitle] = useState(defaultTitle);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pastWorkouts, setPastWorkouts] = useState<Workout[]>([]);

  // 과거 운동 기록 로드
  useEffect(() => {
    loadWorkouts().then(setPastWorkouts);
  }, []);

  // 루틴에서 진입: 루틴 preset 세트로 즉시 초기화 (history 불필요)
  useEffect(() => {
    if (!routineExercises || routineExercises.length === 0) return;
    const preloaded = routineExercises
      .map((re) => {
        const exercise = DEFAULT_EXERCISES.find((e) => e.id === re.exerciseId);
        if (!exercise) return null;
        const sets =
          re.sets.length > 0
            ? re.sets.map((s) => createDefaultSet(s.weight, s.reps))
            : [createDefaultSet()];
        return { id: generateId(), exercise, sets } as WorkoutExercise;
      })
      .filter(Boolean) as WorkoutExercise[];
    setExercises(preloaded);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addExercise = (exerciseId: string) => {
    const found = DEFAULT_EXERCISES.find((e) => e.id === exerciseId);
    if (!found) return;
    const lastSets = findLastSets(pastWorkouts, exerciseId);
    const sets =
      lastSets.length > 0
        ? lastSets.map((s) => createDefaultSet(s.weight, s.reps))
        : [createDefaultSet()];
    setExercises((prev) => [...prev, { id: generateId(), exercise: found, sets }]);
    setShowExercisePicker(false);
  };

  const addSet = (exIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [...ex.sets, createDefaultSet(last?.weight ?? 0, last?.reps ?? 0)],
        };
      }),
    );
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx || ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) };
      }),
    );
  };

  const updateSetField = (
    exIdx: number,
    setIdx: number,
    field: 'weight' | 'reps',
    value: number,
  ) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIdx
          ? {
              ...ex,
              sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: value } : s)),
            }
          : ex,
      ),
    );
  };

  const removeExercise = (exIdx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== exIdx));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showAlert('알림', '운동 제목을 입력해주세요.');
      return;
    }
    if (exercises.length === 0) {
      showAlert('알림', '최소 하나의 운동을 추가해주세요.');
      return;
    }
    setSaving(true);
    try {
      const workout: Workout = {
        id: generateId(),
        title: title.trim(),
        date: new Date().toISOString(),
        duration: duration ? Number(duration) : undefined,
        exercises,
        notes: notes.trim() || undefined,
      };
      await addWorkout(workout);
      navigation.goBack();
    } catch {
      showAlert('오류', '운동 기록 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          style={[styles.titleInput, { backgroundColor: colors.card, color: colors.text }]}
          value={title}
          onChangeText={setTitle}
          placeholder="운동 제목"
          placeholderTextColor={colors.textMuted}
        />

        <View style={[styles.row, { backgroundColor: colors.card }]}>
          <Ionicons name="time-outline" size={18} color={colors.textSub} />
          <TextInput
            style={[styles.durationInput, { color: colors.text }]}
            value={duration}
            onChangeText={setDuration}
            placeholder="운동 시간 (분)"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />
        </View>

        {exercises.map((ex, exIdx) => {
          const lastSets = findLastSets(pastWorkouts, ex.exercise.id);
          const hasPrev = lastSets.length > 0 && !routineExercises;
          return (
            <View key={ex.id} style={[styles.exerciseBlock, { backgroundColor: colors.card }]}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseTitleArea}>
                  <Text style={[styles.exerciseName, { color: colors.text }]}>{ex.exercise.name}</Text>
                  {hasPrev && (
                    <Text style={styles.prevHint}>
                      이전: {lastSets[0].weight}kg × {lastSets[0].reps}회
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => removeExercise(exIdx)}>
                  <Ionicons name="trash-outline" size={20} color="#FF5C5C" />
                </TouchableOpacity>
              </View>

              {/* 세트 헤더 */}
              <View style={styles.setHeader}>
                <Text style={[styles.setHeaderNum, { color: colors.textMuted }]}>세트</Text>
                <Text style={[styles.setHeaderLabel, { color: colors.textMuted }]}>무게 (kg)</Text>
                <View style={styles.setHeaderSep} />
                <Text style={[styles.setHeaderLabel, { color: colors.textMuted }]}>횟수</Text>
                <View style={{ width: 28 }} />
              </View>

              {ex.sets.map((s, setIdx) => (
                <View key={s.id} style={styles.setRow}>
                  <Text style={[styles.setNumber, { color: colors.textSub }]}>{setIdx + 1}</Text>
                  <SetStepper
                    value={s.weight}
                    onChange={(v) => updateSetField(exIdx, setIdx, 'weight', v)}
                    step={5}
                  />
                  <View style={styles.setColGap} />
                  <SetStepper
                    value={s.reps}
                    onChange={(v) => updateSetField(exIdx, setIdx, 'reps', v)}
                    step={1}
                  />
                  <TouchableOpacity
                    style={styles.setDeleteBtn}
                    onPress={() => removeSet(exIdx, setIdx)}
                    disabled={ex.sets.length <= 1}
                  >
                    <Ionicons
                      name="remove-circle-outline"
                      size={20}
                      color={ex.sets.length <= 1 ? '#ddd' : '#FF5C5C'}
                    />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exIdx)}>
                <Ionicons name="add" size={16} color="#4F8EF7" />
                <Text style={styles.addSetText}>세트 추가</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.addExerciseBtn}
          onPress={() => setShowExercisePicker(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color="#4F8EF7" />
          <Text style={styles.addExerciseBtnText}>운동 추가</Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.notesInput, { backgroundColor: colors.card, color: colors.text }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="메모 (선택)"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
        />
      </ScrollView>

      {showExercisePicker && (
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>운동 선택</Text>
              <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
                <Ionicons name="close" size={22} color={colors.textSub} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {DEFAULT_EXERCISES.map((e) => {
                const last = findLastSets(pastWorkouts, e.id);
                return (
                  <TouchableOpacity
                    key={e.id}
                    style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                    onPress={() => addExercise(e.id)}
                  >
                    <Text style={[styles.pickerItemName, { color: colors.text }]}>{e.name}</Text>
                    <Text style={[styles.pickerItemMuscles, { color: colors.textSub }]}>
                      {[e.equipment, e.description].filter(Boolean).join(' · ')}
                      {last.length > 0
                        ? `  ·  최근 ${last[0].weight}kg × ${last[0].reps}회`
                        : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveButton, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>저장하기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { padding: 16, paddingBottom: 100 },
  titleInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  durationInput: { flex: 1, fontSize: 15, color: '#333' },
  exerciseBlock: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  exerciseTitleArea: { flex: 1, marginRight: 8 },
  exerciseName: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  prevHint: { fontSize: 12, color: '#4F8EF7', marginTop: 2 },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  setHeaderNum: { width: 28, fontSize: 11, color: '#bbb', textAlign: 'center' },
  setHeaderLabel: { flex: 1, fontSize: 11, color: '#bbb', textAlign: 'center' },
  setHeaderSep: { width: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 0 },
  setNumber: {
    width: 28,
    textAlign: 'center',
    fontSize: 13,
    color: '#888',
    fontWeight: '700',
  },
  setColGap: { width: 8 },
  setDeleteBtn: { width: 28, alignItems: 'center', marginLeft: 4 },
  addSetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  addSetText: { fontSize: 14, color: '#4F8EF7', fontWeight: '500' },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#4F8EF7',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  addExerciseBtnText: { fontSize: 15, color: '#4F8EF7', fontWeight: '600' },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
    minHeight: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    padding: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  pickerList: {},
  pickerItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pickerItemName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  pickerItemMuscles: { fontSize: 12, color: '#999', marginTop: 2 },
  saveButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#4F8EF7',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
});
