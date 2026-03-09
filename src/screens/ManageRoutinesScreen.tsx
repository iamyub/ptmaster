import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Routine, RoutineExercise, RoutineSet, RootStackParamList, Exercise, ExerciseCategory } from '../types';
import { loadRoutines, addRoutine, updateRoutine, deleteRoutine } from '../storage/routineStorage';
import { DEFAULT_EXERCISES, CATEGORY_LABELS } from '../utils/exercises';
import SetStepper from '../components/SetStepper';

type Route = RouteProp<RootStackParamList, 'ManageRoutines'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type FormMode = 'add' | 'edit' | null;

// 운동 추가 모달 내부 단계
type PickerStep = 'list' | 'config';

// ── 운동 선택 모달 ──
function ExercisePickerModal({
  visible,
  alreadySelected,
  onAdd,
  onClose,
}: {
  visible: boolean;
  alreadySelected: string[];
  onAdd: (exerciseId: string, sets: RoutineSet[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ExerciseCategory | 'all'>('all');
  const [step, setStep] = useState<PickerStep>('list');
  const [pickedExercise, setPickedExercise] = useState<Exercise | null>(null);
  const [defaultSetCount, setDefaultSetCount] = useState(3);
  const [defaultWeight, setDefaultWeight] = useState(0);
  const [defaultReps, setDefaultReps] = useState(10);

  const categories: Array<{ key: ExerciseCategory | 'all'; label: string }> = [
    { key: 'all', label: '전체' },
    ...Object.entries(CATEGORY_LABELS).map(([k, v]) => ({
      key: k as ExerciseCategory,
      label: v,
    })),
  ];

  const filtered = DEFAULT_EXERCISES.filter((e) => {
    const matchSearch = e.name.includes(search.trim());
    const matchCategory = activeCategory === 'all' || e.category === activeCategory;
    return matchSearch && matchCategory;
  });

  const handlePickExercise = (ex: Exercise) => {
    setPickedExercise(ex);
    setDefaultSetCount(3);
    setDefaultWeight(0);
    setDefaultReps(10);
    setStep('config');
  };

  const handleConfirmAdd = () => {
    if (!pickedExercise) return;
    const sets: RoutineSet[] = Array.from({ length: defaultSetCount }, () => ({
      weight: defaultWeight,
      reps: defaultReps,
    }));
    onAdd(pickedExercise.id, sets);
    setStep('list');
    setPickedExercise(null);
    setSearch('');
  };

  const handleClose = () => {
    setStep('list');
    setPickedExercise(null);
    setSearch('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 모달 헤더 */}
        <View style={styles.modalHeader}>
          {step === 'config' ? (
            <TouchableOpacity onPress={() => setStep('list')} style={styles.modalBackBtn}>
              <Ionicons name="chevron-back" size={22} color="#4F8EF7" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
          <Text style={styles.modalTitle}>
            {step === 'list' ? '운동 선택' : '기본값 설정'}
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
            <Ionicons name="close" size={22} color="#555" />
          </TouchableOpacity>
        </View>

        {step === 'list' ? (
          <>
            {/* 검색 */}
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color="#aaa" />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="운동 이름 검색"
                placeholderTextColor="#bbb"
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color="#bbb" />
                </TouchableOpacity>
              )}
            </View>

            {/* 카테고리 필터 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryScrollContent}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.categoryChip, activeCategory === cat.key && styles.categoryChipActive]}
                  onPress={() => setActiveCategory(cat.key)}
                >
                  <Text
                    style={[styles.categoryChipText, activeCategory === cat.key && styles.categoryChipTextActive]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 운동 목록 */}
            <FlatList
              data={filtered}
              keyExtractor={(e) => e.id}
              contentContainerStyle={styles.pickerList}
              renderItem={({ item }) => {
                const isAlready = alreadySelected.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.pickerRow, isAlready && styles.pickerRowDisabled]}
                    onPress={() => !isAlready && handlePickExercise(item)}
                    activeOpacity={isAlready ? 1 : 0.7}
                  >
                    <View style={styles.pickerRowLeft}>
                      <Text style={[styles.pickerRowName, isAlready && styles.pickerRowNameDisabled]}>
                        {item.name}
                      </Text>
                      <Text style={styles.pickerRowMuscle}>
                        {item.muscleGroups.join(' · ')}
                      </Text>
                    </View>
                    {isAlready ? (
                      <View style={styles.alreadyBadge}>
                        <Text style={styles.alreadyBadgeText}>추가됨</Text>
                      </View>
                    ) : (
                      <Ionicons name="add-circle-outline" size={24} color="#4F8EF7" />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>검색 결과가 없어요.</Text>
              }
            />
          </>
        ) : (
          /* ── 기본값 설정 단계 ── */
          <ScrollView contentContainerStyle={styles.configContent}>
            <View style={styles.configExerciseHeader}>
              <Text style={styles.configExerciseName}>{pickedExercise?.name}</Text>
              <Text style={styles.configExerciseMuscle}>
                {pickedExercise?.muscleGroups.join(' · ')}
              </Text>
            </View>

            <View style={styles.configCard}>
              {/* 세트 수 */}
              <View style={styles.configRow}>
                <Text style={styles.configLabel}>세트 수</Text>
                <View style={styles.configStepper}>
                  <TouchableOpacity
                    style={styles.configStepBtn}
                    onPress={() => setDefaultSetCount((v) => Math.max(1, v - 1))}
                  >
                    <Text style={styles.configStepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.configStepValue}>{defaultSetCount}</Text>
                  <TouchableOpacity
                    style={styles.configStepBtn}
                    onPress={() => setDefaultSetCount((v) => Math.min(10, v + 1))}
                  >
                    <Text style={styles.configStepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 기본 무게 */}
              <View style={styles.configRow}>
                <Text style={styles.configLabel}>기본 무게 (kg)</Text>
                <View style={styles.configStepperWide}>
                  <SetStepper
                    value={defaultWeight}
                    onChange={setDefaultWeight}
                    step={5}
                  />
                </View>
              </View>

              {/* 기본 횟수 */}
              <View style={styles.configRow}>
                <Text style={styles.configLabel}>기본 횟수</Text>
                <View style={styles.configStepperWide}>
                  <SetStepper
                    value={defaultReps}
                    onChange={setDefaultReps}
                    step={1}
                  />
                </View>
              </View>
            </View>

            {/* 미리보기 */}
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>추가될 세트 미리보기</Text>
              {Array.from({ length: defaultSetCount }, (_, i) => (
                <View key={i} style={styles.previewRow}>
                  <Text style={styles.previewSetNum}>{i + 1}세트</Text>
                  <Text style={styles.previewSetInfo}>
                    {defaultWeight}kg × {defaultReps}회
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.confirmAddBtn} onPress={handleConfirmAdd}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.confirmAddBtnText}>루틴에 추가하기</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── 메인 화면 ──
export default function ManageRoutinesScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const paramRoutineId = route.params?.routineId;
  const paramOpenForm = route.params?.openForm;

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [routineName, setRoutineName] = useState('');
  const [formExercises, setFormExercises] = useState<RoutineExercise[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadRoutines().then(setRoutines);
    }, []),
  );

  useEffect(() => {
    if (paramRoutineId && routines.length > 0) {
      const target = routines.find((r) => r.id === paramRoutineId);
      if (target) openEditForm(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramRoutineId, routines]);

  useEffect(() => {
    if (paramOpenForm) openAddForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramOpenForm]);

  const openAddForm = () => {
    setEditingRoutine(null);
    setRoutineName('');
    setFormExercises([]);
    setFormMode('add');
  };

  const openEditForm = (routine: Routine) => {
    setEditingRoutine(routine);
    setRoutineName(routine.name);
    setFormExercises(routine.exercises.map((re) => ({ ...re, sets: re.sets.map((s) => ({ ...s })) })));
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingRoutine(null);
    setRoutineName('');
    setFormExercises([]);
  };

  // 모달에서 운동 추가
  const handleAddExercise = (exerciseId: string, sets: RoutineSet[]) => {
    setFormExercises((prev) => [...prev, { exerciseId, sets }]);
    setPickerVisible(false);
  };

  // 선택된 운동 제거
  const removeExercise = (exerciseId: string) => {
    setFormExercises((prev) => prev.filter((re) => re.exerciseId !== exerciseId));
  };

  // 세트 조작
  const addFormSet = (exerciseId: string) => {
    setFormExercises((prev) =>
      prev.map((re) => {
        if (re.exerciseId !== exerciseId) return re;
        const last = re.sets[re.sets.length - 1] ?? { weight: 0, reps: 0 };
        return { ...re, sets: [...re.sets, { weight: last.weight, reps: last.reps }] };
      }),
    );
  };

  const removeFormSet = (exerciseId: string, setIdx: number) => {
    setFormExercises((prev) =>
      prev.map((re) => {
        if (re.exerciseId !== exerciseId || re.sets.length <= 1) return re;
        return { ...re, sets: re.sets.filter((_, i) => i !== setIdx) };
      }),
    );
  };

  const updateFormSet = (exerciseId: string, setIdx: number, field: keyof RoutineSet, value: number) => {
    setFormExercises((prev) =>
      prev.map((re) => {
        if (re.exerciseId !== exerciseId) return re;
        return {
          ...re,
          sets: re.sets.map((s, i) => (i === setIdx ? { ...s, [field]: value } : s)),
        };
      }),
    );
  };

  // 가나다 순 정렬된 폼 운동 목록
  const sortedFormExercises = [...formExercises].sort((a, b) => {
    const nameA = DEFAULT_EXERCISES.find((e) => e.id === a.exerciseId)?.name ?? '';
    const nameB = DEFAULT_EXERCISES.find((e) => e.id === b.exerciseId)?.name ?? '';
    return nameA.localeCompare(nameB, 'ko');
  });

  const handleSave = async () => {
    if (!routineName.trim()) {
      showAlert('알림', '루틴 이름을 입력해주세요.');
      return;
    }
    if (formExercises.length === 0) {
      showAlert('알림', '운동을 하나 이상 추가해주세요.');
      return;
    }
    try {
      if (formMode === 'add') {
        const newRoutine: Routine = {
          id: generateId(),
          name: routineName.trim(),
          exercises: formExercises,
        };
        await addRoutine(newRoutine);
        setRoutines((prev) => [...prev, newRoutine]);
      } else if (formMode === 'edit' && editingRoutine) {
        const updated: Routine = {
          ...editingRoutine,
          name: routineName.trim(),
          exercises: formExercises,
        };
        await updateRoutine(updated);
        setRoutines((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      }
      closeForm();
      navigation.goBack();
    } catch {
      showAlert('오류', '루틴 저장에 실패했습니다.');
    }
  };

  const handleDelete = (id: string, name: string) => {
    showAlert('루틴 삭제', `"${name}"를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRoutine(id);
            setRoutines((prev) => prev.filter((r) => r.id !== id));
            if (editingRoutine?.id === id) closeForm();
          } catch {
            showAlert('오류', '루틴 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const formTitle = formMode === 'edit' ? '루틴 편집' : '새 루틴 추가';
  const alreadySelectedIds = formExercises.map((re) => re.exerciseId);

  return (
    <View style={styles.container}>
      <FlatList
        data={routines}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          formMode === null ? (
            <View style={styles.emptyBox}>
              <Ionicons name="list-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>저장된 루틴이 없어요.</Text>
              <Text style={styles.emptySubText}>아래 버튼으로 루틴을 추가해보세요!</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const exerciseNames = item.exercises
            .map((re) => DEFAULT_EXERCISES.find((e) => e.id === re.exerciseId)?.name)
            .filter(Boolean)
            .join(', ');
          const isEditing = editingRoutine?.id === item.id && formMode === 'edit';
          return (
            <TouchableOpacity
              style={[styles.routineCard, isEditing && styles.routineCardEditing]}
              onLongPress={() => openEditForm(item)}
              activeOpacity={0.85}
              delayLongPress={400}
            >
              <View style={styles.routineLeft}>
                <Text style={styles.routineName}>{item.name}</Text>
                <Text style={styles.routineExercises} numberOfLines={2}>
                  {exerciseNames}
                </Text>
                <Text style={styles.routineCount}>{item.exercises.length}종목</Text>
              </View>
              <View style={styles.routineActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openEditForm(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="pencil-outline" size={18} color="#4F8EF7" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleDelete(item.id, item.name)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF5C5C" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          formMode !== null ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>{formTitle}</Text>

              {/* 루틴 이름 */}
              <TextInput
                style={styles.nameInput}
                value={routineName}
                onChangeText={setRoutineName}
                placeholder="루틴 이름 (예: 가슴·어깨 데이)"
                placeholderTextColor="#bbb"
              />

              {/* 추가된 운동 목록 (가나다 순) */}
              <Text style={styles.formLabel}>
                추가된 운동{formExercises.length > 0 ? ` (${formExercises.length}종목)` : ''}
              </Text>

              {sortedFormExercises.length === 0 ? (
                <View style={styles.noExerciseBox}>
                  <Ionicons name="barbell-outline" size={32} color="#ddd" />
                  <Text style={styles.noExerciseText}>아직 추가된 운동이 없어요.</Text>
                  <Text style={styles.noExerciseSubText}>아래 버튼으로 운동을 추가해보세요.</Text>
                </View>
              ) : (
                sortedFormExercises.map((re) => {
                  const exercise = DEFAULT_EXERCISES.find((e) => e.id === re.exerciseId);
                  if (!exercise) return null;
                  return (
                    <View key={re.exerciseId} style={styles.formExerciseBlock}>
                      {/* 운동 헤더 */}
                      <View style={styles.formExerciseHeader}>
                        <View style={styles.formExerciseInfo}>
                          <Text style={styles.formExerciseName}>{exercise.name}</Text>
                          <Text style={styles.formExerciseMuscle}>
                            {exercise.muscleGroups.join(' · ')}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => removeExercise(re.exerciseId)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={18} color="#FF5C5C" />
                        </TouchableOpacity>
                      </View>

                      {/* 세트 편집기 */}
                      <View style={styles.setEditor}>
                        <View style={styles.setEditorHeader}>
                          <Text style={styles.setEditorHeaderNum}>세트</Text>
                          <Text style={styles.setEditorHeaderLabel}>무게 (kg)</Text>
                          <View style={{ width: 8 }} />
                          <Text style={styles.setEditorHeaderLabel}>횟수</Text>
                          <View style={{ width: 28 }} />
                        </View>

                        {re.sets.map((s, setIdx) => (
                          <View key={setIdx} style={styles.setEditorRow}>
                            <Text style={styles.setEditorNum}>{setIdx + 1}</Text>
                            <SetStepper
                              value={s.weight}
                              onChange={(v) => updateFormSet(re.exerciseId, setIdx, 'weight', v)}
                              step={5}
                            />
                            <View style={{ width: 8 }} />
                            <SetStepper
                              value={s.reps}
                              onChange={(v) => updateFormSet(re.exerciseId, setIdx, 'reps', v)}
                              step={1}
                            />
                            <TouchableOpacity
                              style={styles.setEditorDeleteBtn}
                              onPress={() => removeFormSet(re.exerciseId, setIdx)}
                              disabled={re.sets.length <= 1}
                            >
                              <Ionicons
                                name="remove-circle-outline"
                                size={18}
                                color={re.sets.length <= 1 ? '#ddd' : '#FF5C5C'}
                              />
                            </TouchableOpacity>
                          </View>
                        ))}

                        <TouchableOpacity
                          style={styles.addSetBtn}
                          onPress={() => addFormSet(re.exerciseId)}
                        >
                          <Ionicons name="add" size={14} color="#4F8EF7" />
                          <Text style={styles.addSetText}>세트 추가</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}

              {/* 운동 추가 + 버튼 */}
              <TouchableOpacity style={styles.addExerciseBtn} onPress={() => setPickerVisible(true)}>
                <Ionicons name="add-circle-outline" size={20} color="#4F8EF7" />
                <Text style={styles.addExerciseBtnText}>운동 추가 +</Text>
              </TouchableOpacity>

              {/* 저장/취소 버튼 */}
              <View style={styles.formBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeForm}>
                  <Text style={styles.cancelBtnText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleSave}>
                  <Text style={styles.confirmBtnText}>저장</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        }
      />

      {formMode === null && (
        <TouchableOpacity style={styles.addButton} onPress={openAddForm}>
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>루틴 추가</Text>
        </TouchableOpacity>
      )}

      {/* 운동 선택 모달 */}
      <ExercisePickerModal
        visible={pickerVisible}
        alreadySelected={alreadySelectedIds}
        onAdd={handleAddExercise}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  listContent: { padding: 16, paddingBottom: 100 },

  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 16, color: '#999' },
  emptySubText: { fontSize: 13, color: '#bbb' },

  // 루틴 카드
  routineCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  routineCardEditing: { borderWidth: 2, borderColor: '#4F8EF7' },
  routineLeft: { flex: 1, marginRight: 12 },
  routineName: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  routineExercises: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 4 },
  routineCount: { fontSize: 12, color: '#4F8EF7', fontWeight: '600' },
  routineActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  actionBtn: { padding: 4 },

  // 폼 카드
  formCard: {
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
  formTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 14 },
  nameInput: {
    backgroundColor: '#F5F6FA',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1A1A2E',
    marginBottom: 16,
  },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 10 },

  // 운동 없을 때
  noExerciseBox: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    marginBottom: 12,
  },
  noExerciseText: { fontSize: 14, color: '#bbb' },
  noExerciseSubText: { fontSize: 12, color: '#ccc' },

  // 폼 내 운동 블록
  formExerciseBlock: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFF',
    borderLeftWidth: 3,
    borderLeftColor: '#4F8EF7',
    overflow: 'hidden',
  },
  formExerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  formExerciseInfo: { flex: 1 },
  formExerciseName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  formExerciseMuscle: { fontSize: 11, color: '#999', marginTop: 2 },

  // 세트 편집기
  setEditor: { paddingHorizontal: 10, paddingBottom: 10 },
  setEditorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  setEditorHeaderNum: { width: 28, fontSize: 10, color: '#bbb', textAlign: 'center' },
  setEditorHeaderLabel: { flex: 1, fontSize: 10, color: '#bbb', textAlign: 'center' },
  setEditorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  setEditorNum: {
    width: 28,
    textAlign: 'center',
    fontSize: 12,
    color: '#888',
    fontWeight: '700',
  },
  setEditorDeleteBtn: { width: 28, alignItems: 'center', marginLeft: 4 },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingVertical: 4,
  },
  addSetText: { fontSize: 13, color: '#4F8EF7', fontWeight: '500' },

  // 운동 추가 버튼
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#4F8EF7',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  addExerciseBtnText: { fontSize: 15, color: '#4F8EF7', fontWeight: '600' },

  // 폼 하단 버튼
  formBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F5F6FA',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, color: '#888', fontWeight: '600' },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#4F8EF7',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },

  // 하단 추가 버튼
  addButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#4F8EF7',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  addButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },

  // ── 모달 ──
  modalContainer: { flex: 1, backgroundColor: '#F5F6FA' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  modalBackBtn: { padding: 4, width: 36 },
  modalCloseBtn: { padding: 4, width: 36, alignItems: 'flex-end' },

  // 검색바
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    margin: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1A1A2E' },

  // 카테고리
  categoryScroll: { maxHeight: 44 },
  categoryScrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E8EAF0',
  },
  categoryChipActive: { backgroundColor: '#4F8EF7' },
  categoryChipText: { fontSize: 13, fontWeight: '500', color: '#666' },
  categoryChipTextActive: { color: '#fff' },

  // 운동 목록 (모달)
  pickerList: { padding: 12 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pickerRowDisabled: { opacity: 0.5 },
  pickerRowLeft: { flex: 1 },
  pickerRowName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  pickerRowNameDisabled: { color: '#aaa' },
  pickerRowMuscle: { fontSize: 12, color: '#999', marginTop: 2 },
  alreadyBadge: {
    backgroundColor: '#EEF4FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  alreadyBadgeText: { fontSize: 12, color: '#4F8EF7', fontWeight: '600' },
  pickerEmpty: { textAlign: 'center', color: '#bbb', paddingVertical: 40, fontSize: 14 },

  // 기본값 설정 단계
  configContent: { padding: 16 },
  configExerciseHeader: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  configExerciseName: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  configExerciseMuscle: { fontSize: 13, color: '#999', marginTop: 4 },
  configCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  configLabel: { fontSize: 15, fontWeight: '500', color: '#333' },
  configStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    borderRadius: 10,
    overflow: 'hidden',
  },
  configStepBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E5EA',
  },
  configStepBtnText: { fontSize: 20, fontWeight: '700', color: '#4F8EF7' },
  configStepValue: {
    width: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  configStepperWide: { width: 150 },

  // 미리보기
  previewCard: {
    backgroundColor: '#F0F6FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  previewTitle: { fontSize: 12, fontWeight: '600', color: '#4F8EF7', marginBottom: 8 },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  previewSetNum: { fontSize: 14, color: '#555', fontWeight: '600' },
  previewSetInfo: { fontSize: 14, color: '#333' },

  // 추가 확인 버튼
  confirmAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F8EF7',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  confirmAddBtnText: { fontSize: 16, color: '#fff', fontWeight: '700' },
});
