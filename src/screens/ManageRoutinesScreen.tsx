import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RenderItemParams, NestableScrollContainer, NestableDraggableFlatList } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import { showAlert } from '../utils/alert';
import { RootStackParamList, Routine, RoutineExercise, RoutineSet, Exercise } from '../types';
import { loadRoutines, saveRoutines, addRoutine, updateRoutine, deleteRoutine } from '../storage/routineStorage';
import { DEFAULT_EXERCISES } from '../utils/exercises';
import SetStepper from '../components/SetStepper';
import { useTheme } from '../context/ThemeContext';
import { authService } from '../services/authService';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ManageRoutines'>;

type FormMode = 'add' | 'edit';

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ManageRoutinesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();

  const currentUser = authService.getCurrentUser();

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formExercises, setFormExercises] = useState<RoutineExercise[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const initialStateRef = useRef<{ name: string; exercises: RoutineExercise[] } | null>(null);
  const skipUnsavedCheckRef = useRef(false);
  const handleSaveRef = useRef<() => Promise<void>>(async () => {});
  const handleGoBackRef = useRef(() => { navigation.goBack(); });

  useEffect(() => {
    handleGoBackRef.current = () => {
      if (formMode) {
        setFormMode(null);
        setEditingId(null);
      } else {
        navigation.goBack();
      }
    };
  }, [formMode, navigation]);

  useFocusEffect(
    useCallback(() => {
      if (currentUser) {
        loadRoutines(currentUser.uid).then(setRoutines);
      }
    }, [currentUser]),
  );

  // Deep comparison check for unsaved changes
  const hasChanges = useCallback(() => {
    if (!initialStateRef.current) return false;
    if (formName !== initialStateRef.current.name) return true;
    if (formExercises.length !== initialStateRef.current.exercises.length) return true;
    for (let i = 0; i < formExercises.length; i++) {
      const a = formExercises[i];
      const b = initialStateRef.current.exercises[i];
      if (a.exerciseId !== b.exerciseId) return true;
      if (a.sets.length !== b.sets.length) return true;
      for (let j = 0; j < a.sets.length; j++) {
        if (a.sets[j].weight !== b.sets[j].weight) return true;
        if (a.sets[j].reps !== b.sets[j].reps) return true;
      }
    }
    return false;
  }, [formName, formExercises]);

  const openAddForm = () => {
    setFormMode('add');
    setEditingId(null);
    setFormName('');
    setFormExercises([]);
    initialStateRef.current = { name: '', exercises: [] };
  };

  const openEditForm = (routine: Routine) => {
    setFormMode('edit');
    setEditingId(routine.id);
    setFormName(routine.name);
    const cloned = routine.exercises.map(ex => ({
      ...ex,
      sets: ex.sets.map(s => ({ ...s }))
    }));
    setFormExercises(cloned);
    initialStateRef.current = { name: routine.name, exercises: cloned };
  };

  useEffect(() => {
    if (route.params?.openForm) {
      openAddForm();
      navigation.setParams({ openForm: undefined });
    } else if (route.params?.routineId) {
      const routine = routines.find(r => r.id === route.params?.routineId);
      if (routine) {
        openEditForm(routine);
      }
      navigation.setParams({ routineId: undefined });
    }
  }, [route.params, routines]);

  const handleClose = () => {
    if (hasChanges()) {
      showAlert('알림', '변경사항이 저장되지 않았습니다. 정말 닫으시겠습니까?', [
        { text: '계속 수정', style: 'cancel' },
        { text: '닫기', style: 'destructive', onPress: () => setFormMode(null) },
      ]);
    } else {
      setFormMode(null);
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;
    if (!formName.trim()) {
      showAlert('알림', '루틴 이름을 입력해주세요.');
      return;
    }
    if (formExercises.length === 0) {
      showAlert('알림', '최소 하나의 운동을 추가해주세요.');
      return;
    }

    const routine: Routine = {
      id: editingId || generateId(),
      name: formName.trim(),
      exercises: formExercises,
    };

    try {
      if (formMode === 'add') {
        await addRoutine(currentUser.uid, routine);
      } else {
        await updateRoutine(currentUser.uid, routine);
      }
      const updated = await loadRoutines(currentUser.uid);
      setRoutines(updated);
      setFormMode(null);
    } catch {
      showAlert('오류', '루틴 저장에 실패했습니다.');
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (!currentUser) return;
    showAlert('루틴 삭제', `"${name}" 루틴을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRoutine(currentUser.uid, id);
            setRoutines(prev => prev.filter(r => r.id !== id));
          } catch {
            showAlert('오류', '루틴 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const addExercise = (exerciseId: string) => {
    if (formExercises.some(re => re.exerciseId === exerciseId)) {
      showAlert('알림', '이미 추가된 운동입니다.');
      return;
    }
    setFormExercises(prev => [...prev, { exerciseId, sets: [{ weight: 0, reps: 0 }] }]);
    setPickerVisible(false);
  };

  const removeExercise = (exerciseId: string) => {
    setFormExercises(prev => prev.filter(re => re.exerciseId !== exerciseId));
  };

  const addFormSet = (exerciseId: string) => {
    setFormExercises(prev => prev.map(re => {
      if (re.exerciseId !== exerciseId) return re;
      const last = re.sets[re.sets.length - 1];
      return { ...re, sets: [...re.sets, { weight: last?.weight ?? 0, reps: last?.reps ?? 0 }] };
    }));
  };

  const removeFormSet = (exerciseId: string, setIdx: number) => {
    setFormExercises(prev => prev.map(re => {
      if (re.exerciseId !== exerciseId || re.sets.length <= 1) return re;
      return { ...re, sets: re.sets.filter((_, i) => i !== setIdx) };
    }));
  };

  const updateFormSet = (exerciseId: string, setIdx: number, field: keyof RoutineSet, value: number) => {
    setFormExercises(prev => prev.map(re => {
      if (re.exerciseId !== exerciseId) return re;
      return {
        ...re,
        sets: re.sets.map((s, i) => i === setIdx ? { ...s, [field]: value } : s),
      };
    }));
  };

  const sortedFormExercises = formExercises;

  const isLarge = width >= 600;
  const { width } = useWindowDimensions();
  const hPad = isLarge ? 24 : 16;
  const extraBottomPad = insets.bottom;

  const renderFormContent = () => (
    <View style={styles.formContainer}>
      <View style={[styles.formHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TextInput
          style={[styles.formNameInput, { color: colors.text }]}
          value={formName}
          onChangeText={setFormName}
          placeholder="루틴 이름 (예: 가슴/삼두, 오운완)"
          placeholderTextColor={colors.textMuted}
          autoFocus={formMode === 'add'}
        />
      </View>

      {formExercises.length === 0 ? (
        <View style={styles.noExerciseBox}>
          <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.noExerciseText, { color: colors.textSub }]}>추가된 운동이 없어요</Text>
          <Text style={[styles.noExerciseSubText, { color: colors.textMuted }]}>
            아래 '운동 추가' 버튼을 눌러보세요
          </Text>
        </View>
      ) : (
      <NestableDraggableFlatList
        data={sortedFormExercises}
        keyExtractor={(re) => re.exerciseId}
        onDragBegin={() => setIsDragging(true)}
        onDragEnd={({ data }) => {
          setFormExercises(data);
          setIsDragging(false);
        }}
        activationDistance={Platform.select({ ios: 10, android: 15 })}
        renderItem={({ item: re, drag, isActive }: RenderItemParams<RoutineExercise>) => {
          const exercise = DEFAULT_EXERCISES.find((e) => e.id === re.exerciseId);
          if (!exercise) return null;
          return (
            <TouchableOpacity
              activeOpacity={1}
              onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                drag();
              }}
              delayLongPress={350}
              style={[
                styles.formExerciseBlock,
                { backgroundColor: colors.cardAlt, borderLeftColor: colors.primary },
                isActive && styles.formExerciseBlockDragging,
                isActive && { opacity: 0.72, transform: [{ scale: 0.95 }] },
              ]}
            >
                <View style={styles.formExerciseHeader}>
                  <View style={styles.formExerciseInfo}>
                    <Text style={[styles.formExerciseName, { color: colors.text }]}>
                      {exercise.name}
                    </Text>
                    <Text style={[styles.formExerciseMuscle, { color: colors.textSub }]}>
                      {[exercise.equipment, exercise.description].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeExercise(re.exerciseId)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                  </TouchableOpacity>
                </View>

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

                  <TouchableOpacity style={styles.addSetBtn} onPress={() => addFormSet(re.exerciseId)}>
                    <Ionicons name="add" size={14} color={colors.primary} />
                    <Text style={[styles.addSetText, { color: colors.primary }]}>세트 추가</Text>
                  </TouchableOpacity>
                </View>
            </TouchableOpacity>
          );
        }}
      />
      )}

      {/* Add exercise button (small screens only) */}
      {!isLarge && (
        <TouchableOpacity
          style={[styles.inlineAddBtn, { borderColor: colors.primary }]}
          onPress={() => setPickerVisible(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={[styles.inlineAddBtnText, { color: colors.primary }]}>운동 추가</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (formMode) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ flex: 1 }}>
          <NestableScrollContainer
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!isDragging}
            bounces={!isDragging}
            contentContainerStyle={[styles.formScrollContent, { paddingBottom: 16 }]}
          >
            {renderFormContent()}
          </NestableScrollContainer>
          <View style={[styles.bottomBar, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: 16 + extraBottomPad }]}>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
              <Text style={styles.saveBtnText}>루틴 저장하기</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ExercisePickerModal
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onSelect={addExercise}
          colors={colors}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.listContent, { padding: hPad, paddingBottom: 40 + extraBottomPad }]}>
        <TouchableOpacity
          style={[styles.addRoutineCard, { backgroundColor: colors.card, borderColor: colors.primary }]}
          onPress={openAddForm}
        >
          <Ionicons name="add-circle" size={32} color={colors.primary} />
          <Text style={[styles.addRoutineText, { color: colors.primary }]}>새 루틴 만들기</Text>
        </TouchableOpacity>

        {routines.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.routineCard, { backgroundColor: colors.card }]}
            onPress={() => openEditForm(r)}
            activeOpacity={0.8}
          >
            <View style={styles.routineHeader}>
              <Text style={[styles.routineName, { color: colors.text }]}>{r.name}</Text>
              <View style={styles.routineActions}>
                <TouchableOpacity onPress={() => handleDelete(r.id, r.name)}>
                  <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.exerciseTags}>
              {r.exercises.map((re, idx) => {
                const ex = DEFAULT_EXERCISES.find(e => e.id === re.exerciseId);
                if (!ex) return null;
                return (
                  <View key={idx} style={[styles.tag, { backgroundColor: colors.primaryBg }]}>
                    <Text style={styles.tagText}>{ex.name}</Text>
                  </View>
                );
              })}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Exercise Picker Modal ───────────────────────────────────────
function ExercisePickerModal({ visible, onClose, onSelect, colors }: any) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <KeyboardAvoidingView
          style={[mStyles.modalContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[mStyles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[mStyles.modalTitle, { color: colors.text }]}>운동 선택</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSub} />
            </TouchableOpacity>
          </View>
          <ScrollView style={mStyles.modalList}>
            {DEFAULT_EXERCISES.map((ex) => (
              <TouchableOpacity
                key={ex.id}
                style={[mStyles.modalItem, { borderBottomColor: colors.border }]}
                onPress={() => onSelect(ex.id)}
              >
                <Text style={[mStyles.modalItemName, { color: colors.text }]}>{ex.name}</Text>
                <Text style={[mStyles.modalItemSub, { color: colors.textSub }]}>{ex.category}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { height: '80%', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalList: { flex: 1 },
  modalItem: { padding: 16, borderBottomWidth: 1 },
  modalItemName: { fontSize: 16, fontWeight: '600' },
  modalItemSub: { fontSize: 13, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { gap: 16 },
  addRoutineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  addRoutineText: { fontSize: 16, fontWeight: '700' },
  routineCard: {
    padding: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  routineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  routineName: { fontSize: 18, fontWeight: '700' },
  routineActions: { flexDirection: 'row', gap: 16 },
  exerciseTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  tagText: { fontSize: 12, color: '#4F8EF7', fontWeight: '600' },

  // Form styles
  formScrollContent: { flexGrow: 1 },
  formContainer: { flex: 1 },
  formHeader: { padding: 16, borderBottomWidth: 1, marginBottom: 16 },
  formNameInput: { fontSize: 20, fontWeight: '700', padding: 4 },
  noExerciseBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  noExerciseText: { fontSize: 16, fontWeight: '600' },
  noExerciseSubText: { fontSize: 13 },
  formExerciseBlock: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  formExerciseBlockDragging: { elevation: 10, shadowOpacity: 0.2, shadowRadius: 10 },
  formExerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  formExerciseInfo: { flex: 1 },
  formExerciseName: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  formExerciseMuscle: { fontSize: 12 },
  setEditor: {},
  setEditorHeader: { flexDirection: 'row', marginBottom: 8, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.05)' },
  setEditorHeaderNum: { width: 30, textAlign: 'center', fontSize: 11 },
  setEditorHeaderLabel: { flex: 1, textAlign: 'center', fontSize: 11 },
  setEditorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  setEditorNum: { width: 30, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  setEditorDeleteBtn: { width: 30, alignItems: 'center' },
  addSetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start' },
  addSetText: { fontSize: 14, fontWeight: '600' },
  inlineAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, padding: 16, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed' },
  inlineAddBtnText: { fontSize: 15, fontWeight: '600' },
  bottomBar: { padding: 16, borderTopWidth: 1 },
  saveBtn: { padding: 18, borderRadius: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
