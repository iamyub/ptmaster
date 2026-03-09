import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Routine, RoutineExercise, RoutineSet, RootStackParamList, Exercise, ExerciseCategory } from '../types';
import { loadRoutines, addRoutine, updateRoutine, deleteRoutine } from '../storage/routineStorage';
import { DEFAULT_EXERCISES, CATEGORY_LABELS } from '../utils/exercises';
import SetStepper from '../components/SetStepper';
import { useTheme } from '../context/ThemeContext';

type Route = RouteProp<RootStackParamList, 'ManageRoutines'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type FormMode = 'add' | 'edit';

// ── 운동 선택 모달 ──────────────────────────────────────────
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
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ExerciseCategory | 'all'>('all');
  const [step, setStep] = useState<'list' | 'config'>('list');
  const [pickedExercise, setPickedExercise] = useState<Exercise | null>(null);
  const [setCount, setSetCount] = useState(3);
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(10);

  // 모달 닫힐 때 상태 초기화
  useEffect(() => {
    if (!visible) {
      setStep('list');
      setPickedExercise(null);
      setSearch('');
      setSetCount(3);
      setWeight(0);
      setReps(10);
    }
  }, [visible]);

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
    setSetCount(3);
    setWeight(0);
    setReps(10);
    setStep('config');
  };

  const handleConfirmAdd = () => {
    if (!pickedExercise) return;
    const sets: RoutineSet[] = Array.from({ length: setCount }, () => ({
      weight,
      reps,
    }));
    onAdd(pickedExercise.id, sets);
    // 상태 리셋
    setStep('list');
    setPickedExercise(null);
    setSearch('');
    setSetCount(3);
    setWeight(0);
    setReps(10);
  };

  const handleClose = () => {
    setStep('list');
    setPickedExercise(null);
    setSearch('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
    >
      <KeyboardAvoidingView
        style={[mStyles.modalContainer, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 헤더 */}
        <View style={[mStyles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {step === 'config' ? (
            <TouchableOpacity onPress={() => setStep('list')} style={mStyles.modalBackBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
          <Text style={[mStyles.modalTitle, { color: colors.text }]}>
            {step === 'list' ? '운동 선택' : '기본값 설정'}
          </Text>
          <TouchableOpacity onPress={handleClose} style={mStyles.modalCloseBtn}>
            <Ionicons name="close" size={22} color={colors.textSub} />
          </TouchableOpacity>
        </View>

        {step === 'list' ? (
          <>
            {/* 검색 */}
            <View style={[mStyles.searchBar, { backgroundColor: colors.card }]}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={[mStyles.searchInput, { color: colors.text }]}
                value={search}
                onChangeText={setSearch}
                placeholder="운동 이름 검색"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* 카테고리 필터 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={mStyles.categoryScroll}
              contentContainerStyle={mStyles.categoryScrollContent}
            >
              {categories.map((cat) => {
                const active = activeCategory === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      mStyles.categoryChip,
                      { backgroundColor: active ? colors.primary : colors.chipBg },
                    ]}
                    onPress={() => setActiveCategory(cat.key)}
                  >
                    <Text style={[mStyles.categoryChipText, { color: active ? '#fff' : colors.textSub }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 운동 목록 */}
            <FlatList
              data={filtered}
              keyExtractor={(e) => e.id}
              contentContainerStyle={mStyles.pickerList}
              renderItem={({ item }) => {
                const isAlready = alreadySelected.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[
                      mStyles.pickerRow,
                      { backgroundColor: colors.card },
                      isAlready && mStyles.pickerRowDisabled,
                    ]}
                    onPress={() => !isAlready && handlePickExercise(item)}
                    activeOpacity={isAlready ? 1 : 0.7}
                  >
                    <View style={mStyles.pickerRowLeft}>
                      <Text style={[mStyles.pickerRowName, { color: isAlready ? colors.textMuted : colors.text }]}>
                        {item.name}
                      </Text>
                      <Text style={[mStyles.pickerRowMuscle, { color: colors.textSub }]}>
                        {item.muscleGroups.join(' · ')}
                      </Text>
                    </View>
                    {isAlready ? (
                      <View style={[mStyles.alreadyBadge, { backgroundColor: colors.primaryBg }]}>
                        <Text style={[mStyles.alreadyBadgeText, { color: colors.primary }]}>추가됨</Text>
                      </View>
                    ) : (
                      <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[mStyles.pickerEmpty, { color: colors.textMuted }]}>검색 결과가 없어요.</Text>
              }
            />
          </>
        ) : (
          /* 기본값 설정 단계 */
          <ScrollView contentContainerStyle={mStyles.configContent}>
            <View style={[mStyles.configExerciseHeader, { backgroundColor: colors.card }]}>
              <Text style={[mStyles.configExerciseName, { color: colors.text }]}>{pickedExercise?.name}</Text>
              <Text style={[mStyles.configExerciseMuscle, { color: colors.textSub }]}>
                {pickedExercise?.muscleGroups.join(' · ')}
              </Text>
            </View>

            <View style={[mStyles.configCard, { backgroundColor: colors.card }]}>
              {/* 세트 수 */}
              <View style={mStyles.configRow}>
                <Text style={[mStyles.configLabel, { color: colors.text }]}>세트 수</Text>
                <View style={[mStyles.configStepper, { backgroundColor: colors.chipBg }]}>
                  <TouchableOpacity
                    style={[mStyles.configStepBtn, { backgroundColor: colors.border }]}
                    onPress={() => setSetCount((v) => Math.max(1, v - 1))}
                  >
                    <Text style={[mStyles.configStepBtnText, { color: colors.primary }]}>−</Text>
                  </TouchableOpacity>
                  <Text style={[mStyles.configStepValue, { color: colors.text }]}>{setCount}</Text>
                  <TouchableOpacity
                    style={[mStyles.configStepBtn, { backgroundColor: colors.border }]}
                    onPress={() => setSetCount((v) => Math.min(10, v + 1))}
                  >
                    <Text style={[mStyles.configStepBtnText, { color: colors.primary }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 기본 무게 */}
              <View style={mStyles.configRow}>
                <Text style={[mStyles.configLabel, { color: colors.text }]}>기본 무게 (kg)</Text>
                <View style={mStyles.configStepperWide}>
                  <SetStepper value={weight} onChange={setWeight} step={5} />
                </View>
              </View>

              {/* 기본 횟수 */}
              <View style={mStyles.configRow}>
                <Text style={[mStyles.configLabel, { color: colors.text }]}>기본 횟수</Text>
                <View style={mStyles.configStepperWide}>
                  <SetStepper value={reps} onChange={setReps} step={1} min={1} />
                </View>
              </View>
            </View>

            {/* 미리보기 */}
            <View style={[mStyles.previewCard, { backgroundColor: colors.primaryBg }]}>
              <Text style={[mStyles.previewTitle, { color: colors.primary }]}>추가될 세트 미리보기</Text>
              {Array.from({ length: setCount }, (_, i) => (
                <View key={i} style={mStyles.previewRow}>
                  <Text style={[mStyles.previewSetNum, { color: colors.textSub }]}>{i + 1}세트</Text>
                  <Text style={[mStyles.previewSetInfo, { color: colors.text }]}>
                    {weight}kg × {reps}회
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={mStyles.confirmAddBtn} onPress={handleConfirmAdd}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={mStyles.confirmAddBtnText}>루틴에 추가하기</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── 메인 화면 ───────────────────────────────────────────────
export default function ManageRoutinesScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { colors } = useTheme();
  const paramRoutineId = route.params?.routineId;
  const paramOpenForm = route.params?.openForm;

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [routineName, setRoutineName] = useState('');
  const [formExercises, setFormExercises] = useState<RoutineExercise[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);

  // ── 헤더 제목 동적 변경 ──
  useLayoutEffect(() => {
    if (formMode === 'edit' && editingRoutine) {
      navigation.setOptions({ title: editingRoutine.name });
    } else if (formMode === 'add') {
      navigation.setOptions({ title: '새 루틴 추가' });
    } else {
      navigation.setOptions({ title: '루틴 관리' });
    }
  }, [navigation, formMode, editingRoutine]);

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
    setFormExercises(routine.exercises.map((re) => ({
      ...re,
      sets: re.sets.map((s) => ({ ...s })),
    })));
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingRoutine(null);
    setRoutineName('');
    setFormExercises([]);
  };

  // 모달에서 운동 추가 (weight/reps/sets 포함)
  const handleAddExercise = (exerciseId: string, sets: RoutineSet[]) => {
    setFormExercises((prev) => [...prev, { exerciseId, sets }]);
    setPickerVisible(false);
  };

  const removeExercise = (exerciseId: string) => {
    setFormExercises((prev) => prev.filter((re) => re.exerciseId !== exerciseId));
  };

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

  const alreadySelectedIds = formExercises.map((re) => re.exerciseId);

  // ── 편집/추가 폼 화면 ──────────────────────────────────────
  if (formMode !== null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.formScrollContent}>
          {/* 루틴 이름 입력 */}
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.formLabel, { color: colors.textSub }]}>루틴 이름</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: colors.inputBg, color: colors.text }]}
              value={routineName}
              onChangeText={setRoutineName}
              placeholder="루틴 이름 (예: 가슴·어깨 데이)"
              placeholderTextColor={colors.textMuted}
              autoFocus={formMode === 'add'}
            />
          </View>

          {/* 추가된 운동 목록 */}
          <Text style={[styles.exercisesSectionLabel, { color: colors.textSub }]}>
            추가된 운동{formExercises.length > 0 ? ` (${formExercises.length}종목)` : ''}
          </Text>

          {sortedFormExercises.length === 0 ? (
            <View style={[styles.noExerciseBox, { backgroundColor: colors.cardAlt }]}>
              <Ionicons name="barbell-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.noExerciseText, { color: colors.textMuted }]}>아직 추가된 운동이 없어요.</Text>
              <Text style={[styles.noExerciseSubText, { color: colors.textMuted }]}>아래 버튼으로 운동을 추가해보세요.</Text>
            </View>
          ) : (
            sortedFormExercises.map((re) => {
              const exercise = DEFAULT_EXERCISES.find((e) => e.id === re.exerciseId);
              if (!exercise) return null;
              return (
                <View
                  key={re.exerciseId}
                  style={[
                    styles.formExerciseBlock,
                    { backgroundColor: colors.cardAlt, borderLeftColor: colors.primary },
                  ]}
                >
                  {/* 운동 헤더 */}
                  <View style={styles.formExerciseHeader}>
                    <View style={styles.formExerciseInfo}>
                      <Text style={[styles.formExerciseName, { color: colors.text }]}>{exercise.name}</Text>
                      <Text style={[styles.formExerciseMuscle, { color: colors.textSub }]}>
                        {exercise.muscleGroups.join(' · ')}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeExercise(re.exerciseId)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>

                  {/* 세트 편집기 */}
                  <View style={styles.setEditor}>
                    <View style={styles.setEditorHeader}>
                      <Text style={[styles.setEditorHeaderNum, { color: colors.textMuted }]}>세트</Text>
                      <Text style={[styles.setEditorHeaderLabel, { color: colors.textMuted }]}>무게 (kg)</Text>
                      <View style={{ width: 8 }} />
                      <Text style={[styles.setEditorHeaderLabel, { color: colors.textMuted }]}>횟수</Text>
                      <View style={{ width: 28 }} />
                    </View>

                    {re.sets.map((s, setIdx) => (
                      <View key={setIdx} style={styles.setEditorRow}>
                        <Text style={[styles.setEditorNum, { color: colors.textSub }]}>{setIdx + 1}</Text>
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
                          min={1}
                        />
                        <TouchableOpacity
                          style={styles.setEditorDeleteBtn}
                          onPress={() => removeFormSet(re.exerciseId, setIdx)}
                          disabled={re.sets.length <= 1}
                        >
                          <Ionicons
                            name="remove-circle-outline"
                            size={18}
                            color={re.sets.length <= 1 ? colors.textMuted : colors.destructive}
                          />
                        </TouchableOpacity>
                      </View>
                    ))}

                    <TouchableOpacity
                      style={styles.addSetBtn}
                      onPress={() => addFormSet(re.exerciseId)}
                    >
                      <Ionicons name="add" size={14} color={colors.primary} />
                      <Text style={[styles.addSetText, { color: colors.primary }]}>세트 추가</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {/* 운동 추가 버튼 */}
          <TouchableOpacity
            style={[styles.addExerciseBtn, { borderColor: colors.primary }]}
            onPress={() => setPickerVisible(true)}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.addExerciseBtnText, { color: colors.primary }]}>운동 추가 +</Text>
          </TouchableOpacity>

          {/* 삭제 버튼 (편집 모드) */}
          {formMode === 'edit' && editingRoutine && (
            <TouchableOpacity
              style={[styles.deleteRoutineBtn, { backgroundColor: colors.destructiveBg }]}
              onPress={() => handleDelete(editingRoutine.id, editingRoutine.name)}
            >
              <Ionicons name="trash-outline" size={17} color={colors.destructive} />
              <Text style={[styles.deleteRoutineBtnText, { color: colors.destructive }]}>루틴 삭제</Text>
            </TouchableOpacity>
          )}

          {/* 저장/취소 */}
          <View style={styles.formBtns}>
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.chipBg }]}
              onPress={() => { closeForm(); navigation.goBack(); }}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textSub }]}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleSave}>
              <Text style={styles.confirmBtnText}>저장</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

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

  // ── 루틴 목록 화면 ─────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={routines}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="list-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSub }]}>저장된 루틴이 없어요.</Text>
            <Text style={[styles.emptySubText, { color: colors.textMuted }]}>아래 버튼으로 루틴을 추가해보세요!</Text>
          </View>
        }
        renderItem={({ item }) => {
          const exerciseNames = item.exercises
            .map((re) => DEFAULT_EXERCISES.find((e) => e.id === re.exerciseId)?.name)
            .filter(Boolean)
            .join(', ');
          return (
            <TouchableOpacity
              style={[styles.routineCard, { backgroundColor: colors.card }]}
              onLongPress={() => openEditForm(item)}
              activeOpacity={0.85}
              delayLongPress={400}
            >
              <View style={styles.routineLeft}>
                <Text style={[styles.routineName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.routineExercises, { color: colors.textSub }]} numberOfLines={2}>
                  {exerciseNames}
                </Text>
                <Text style={[styles.routineCount, { color: colors.primary }]}>{item.exercises.length}종목</Text>
              </View>
              <View style={styles.routineActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openEditForm(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleDelete(item.id, item.name)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.addButton} onPress={openAddForm}>
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.addButtonText}>루틴 추가</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── 스타일 ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // 루틴 목록
  listContent: { padding: 16, paddingBottom: 100 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 16 },
  emptySubText: { fontSize: 13 },

  routineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  routineLeft: { flex: 1, marginRight: 12 },
  routineName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  routineExercises: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  routineCount: { fontSize: 12, fontWeight: '600' },
  routineActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  actionBtn: { padding: 4 },

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

  // 편집 폼
  formScrollContent: { padding: 16, paddingBottom: 40 },

  formCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  formLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  nameInput: {
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
  },

  exercisesSectionLabel: { fontSize: 12, fontWeight: '700', marginBottom: 10, marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  noExerciseBox: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  noExerciseText: { fontSize: 14 },
  noExerciseSubText: { fontSize: 12 },

  formExerciseBlock: {
    marginBottom: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
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
  formExerciseName: { fontSize: 15, fontWeight: '700' },
  formExerciseMuscle: { fontSize: 11, marginTop: 2 },

  setEditor: { paddingHorizontal: 10, paddingBottom: 10 },
  setEditorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  setEditorHeaderNum: { width: 28, fontSize: 10, textAlign: 'center' },
  setEditorHeaderLabel: { flex: 1, fontSize: 10, textAlign: 'center' },
  setEditorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  setEditorNum: { width: 28, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  setEditorDeleteBtn: { width: 28, alignItems: 'center', marginLeft: 4 },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingVertical: 4,
  },
  addSetText: { fontSize: 13, fontWeight: '500' },

  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  addExerciseBtnText: { fontSize: 15, fontWeight: '600' },

  deleteRoutineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  deleteRoutineBtnText: { fontSize: 15, fontWeight: '600' },

  formBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  confirmBtn: { flex: 2, backgroundColor: '#4F8EF7', borderRadius: 12, padding: 14, alignItems: 'center' },
  confirmBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },
});

// ── 모달 스타일 ──────────────────────────────────────────────
const mStyles = StyleSheet.create({
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalBackBtn: { padding: 4, width: 36 },
  modalCloseBtn: { padding: 4, width: 36, alignItems: 'flex-end' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  searchInput: { flex: 1, fontSize: 15 },

  categoryScroll: { maxHeight: 44 },
  categoryScrollContent: { paddingHorizontal: 12, paddingBottom: 8, gap: 8, flexDirection: 'row' },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  categoryChipText: { fontSize: 13, fontWeight: '500' },

  pickerList: { padding: 12 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  pickerRowName: { fontSize: 15, fontWeight: '600' },
  pickerRowMuscle: { fontSize: 12, marginTop: 2 },
  alreadyBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  alreadyBadgeText: { fontSize: 12, fontWeight: '600' },
  pickerEmpty: { textAlign: 'center', paddingVertical: 40, fontSize: 14 },

  configContent: { padding: 16, paddingBottom: 40 },
  configExerciseHeader: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  configExerciseName: { fontSize: 20, fontWeight: '700' },
  configExerciseMuscle: { fontSize: 13, marginTop: 4 },

  configCard: {
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
  configRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  configLabel: { fontSize: 15, fontWeight: '500' },
  configStepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, overflow: 'hidden' },
  configStepBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  configStepBtnText: { fontSize: 20, fontWeight: '700' },
  configStepValue: { width: 40, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  configStepperWide: { width: 150 },

  previewCard: { borderRadius: 12, padding: 14, marginBottom: 20 },
  previewTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  previewSetNum: { fontSize: 14, fontWeight: '600' },
  previewSetInfo: { fontSize: 14 },

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
