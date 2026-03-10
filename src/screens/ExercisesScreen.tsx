import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { DEFAULT_EXERCISES, CATEGORY_LABELS } from '../utils/exercises';
import { Exercise, ExerciseCategory } from '../types';
import {
  loadExerciseRestTimes,
  saveExerciseRestTime,
  ExerciseRestTimes,
  loadCustomAlternatives,
  saveCustomAlternatives,
  CustomAlternatives,
} from '../storage/settingsStorage';
import { useTheme } from '../context/ThemeContext';
import { useWorkout, MINI_BAR_HEIGHT } from '../context/WorkoutContext';
import { authService } from '../services/authService';

const CATEGORIES: { key: ExerciseCategory | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: '가슴', label: '가슴' },
  { key: '등', label: '등' },
  { key: '어깨', label: '어깨' },
  { key: '팔', label: '팔' },
  { key: '하체', label: '하체' },
  { key: '복근', label: '복근' },
];

const REST_TIME_OPTIONS: (number | null)[] = [null, 30, 60, 90, 120, 180];

function formatRestLabel(sec: number | null): string {
  if (sec === null) return '기본값';
  if (sec < 60) return `${sec}초`;
  if (sec % 60 === 0) return `${sec / 60}분`;
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
}

function displayName(ex: Exercise): string {
  return ex.description ? `${ex.name} - ${ex.description}` : ex.name;
}

export default function ExercisesScreen() {
  const { colors } = useTheme();
  const { activeWorkout } = useWorkout();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | 'all'>('all');
  const [exerciseRestTimes, setExerciseRestTimes] = useState<ExerciseRestTimes>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [customAlternatives, setCustomAlternatives] = useState<CustomAlternatives>({});
  const [modalExercise, setModalExercise] = useState<Exercise | null>(null);

  const currentUser = authService.getCurrentUser();

  const { width } = useWindowDimensions();
  const isLarge = width >= 600;
  const extraBottomPad = activeWorkout ? MINI_BAR_HEIGHT : 0;

  const numCols = isLarge ? (width >= 900 ? 3 : 2) : 1;

  useFocusEffect(
    useCallback(() => {
      if (!currentUser) return;
      Promise.all([
        loadExerciseRestTimes(currentUser.uid), 
        loadCustomAlternatives(currentUser.uid)
      ]).then(
        ([rt, ca]) => {
          setExerciseRestTimes(rt);
          setCustomAlternatives(ca);
        },
      );
    }, [currentUser]),
  );

  const handleSelectRestTime = async (exerciseId: string, sec: number | null) => {
    if (!currentUser) return;
    const updated = { ...exerciseRestTimes };
    if (sec === null) {
      delete updated[exerciseId];
    } else {
      updated[exerciseId] = sec;
    }
    setExerciseRestTimes(updated);
    await saveExerciseRestTime(currentUser.uid, exerciseId, sec);
    setExpandedId(null);
  };

  const getAlternativeIds = (exercise: Exercise): string[] => {
    const custom = customAlternatives[exercise.id];
    return custom !== undefined ? custom : exercise.alternativeExercises;
  };

  const handleAddAlternative = async (exerciseId: string, altId: string) => {
    if (!currentUser) return;
    const ex = DEFAULT_EXERCISES.find((e) => e.id === exerciseId);
    if (!ex) return;
    const current = getAlternativeIds(ex);
    if (current.includes(altId)) return;
    const updated = { ...customAlternatives, [exerciseId]: [...current, altId] };
    setCustomAlternatives(updated);
    await saveCustomAlternatives(currentUser.uid, updated);
  };

  const handleRemoveAlternative = async (exerciseId: string, altId: string) => {
    if (!currentUser) return;
    const ex = DEFAULT_EXERCISES.find((e) => e.id === exerciseId);
    if (!ex) return;
    const current = getAlternativeIds(ex);
    const updated = { ...customAlternatives, [exerciseId]: current.filter((id) => id !== altId) };
    setCustomAlternatives(updated);
    await saveCustomAlternatives(currentUser.uid, updated);
  };

  const filtered = DEFAULT_EXERCISES.filter((e) => {
    const matchCategory = selectedCategory === 'all' || e.category === selectedCategory;
    const matchSearch =
      e.name.includes(search) ||
      e.equipment.includes(search) ||
      (e.description ?? '').includes(search);
    return matchCategory && matchSearch;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search + category */}
      <View>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.card, margin: isLarge ? 20 : 16, marginBottom: 8 },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.textSub} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontSize: isLarge ? 16 : 15 }]}
            placeholder="운동 검색..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.categoryList, { paddingHorizontal: isLarge ? 20 : 16 }]}
        >
          {CATEGORIES.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.categoryChip,
                { backgroundColor: colors.chipBg, borderColor: colors.border, height: isLarge ? 40 : 36 },
                selectedCategory === item.key && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(item.key)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  { color: colors.textSub, fontSize: isLarge ? 14 : 13 },
                  selectedCategory === item.key && styles.categoryChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Exercise list */}
      <FlatList
        key={numCols}
        style={styles.exerciseList}
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={numCols}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: isLarge ? 20 : 16, paddingBottom: 40 + extraBottomPad },
        ]}
        columnWrapperStyle={numCols > 1 ? { gap: 10 } : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          const customTime = exerciseRestTimes[item.id];
          const hasCustomTime = customTime != null;
          const isExpanded = expandedId === item.id;
          const altIds = getAlternativeIds(item);

          return (
            <TouchableOpacity
              style={[
                styles.exerciseCard,
                { backgroundColor: colors.card, flex: numCols > 1 ? 1 : undefined },
              ]}
              onPress={() => setModalExercise(item)}
              activeOpacity={0.8}
            >
              <View style={styles.exerciseRow}>
                <View style={styles.exerciseLeft}>
                  <Text style={[styles.exerciseName, { color: colors.text, fontSize: isLarge ? 16 : 15 }]}>
                    {displayName(item)}
                  </Text>
                  <Text style={[styles.exerciseMuscles, { color: colors.textSub }]}>
                    {item.equipment}
                    {altIds.length > 0 && (
                      <Text style={{ color: colors.textMuted }}>{`  ·  대체 ${altIds.length}개`}</Text>
                    )}
                  </Text>
                </View>

                <View style={styles.exerciseRight}>
                  <View style={[styles.categoryBadge, { backgroundColor: colors.primaryBg }]}>
                    <Text style={styles.categoryBadgeText}>
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.restTimeIconBtn,
                      { backgroundColor: colors.chipBg },
                      hasCustomTime && [styles.restTimeIconBtnActive, { backgroundColor: colors.primaryBg }],
                    ]}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setExpandedId(isExpanded ? null : item.id);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="timer-outline"
                      size={16}
                      color={hasCustomTime ? '#4F8EF7' : '#bbb'}
                    />
                    {hasCustomTime && (
                      <Text style={styles.restTimeBadgeText}>{formatRestLabel(customTime)}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {isExpanded && (
                <View
                  style={[
                    styles.restTimePanel,
                    { backgroundColor: colors.cardAlt, borderTopColor: colors.border },
                  ]}
                >
                  <View style={styles.restTimePanelHeader}>
                    <Ionicons name="timer-outline" size={14} color="#4F8EF7" />
                    <Text style={styles.restTimePanelTitle}>개별 휴식 시간</Text>
                    <Text style={[styles.restTimePanelHint, { color: colors.textMuted }]}>
                      기본값은 설정을 따릅니다
                    </Text>
                  </View>
                  <View style={styles.restTimePanelOptions}>
                    {REST_TIME_OPTIONS.map((sec) => {
                      const isSelected =
                        sec === null ? !hasCustomTime : exerciseRestTimes[item.id] === sec;
                      return (
                        <TouchableOpacity
                          key={String(sec)}
                          style={[
                            styles.restTimePanelBtn,
                            { backgroundColor: colors.card, borderColor: colors.border },
                            isSelected && [
                              styles.restTimePanelBtnActive,
                              { backgroundColor: colors.primaryBg, borderColor: '#4F8EF7' },
                            ],
                          ]}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            handleSelectRestTime(item.id, sec);
                          }}
                        >
                          <Text
                            style={[
                              styles.restTimePanelBtnText,
                              { color: colors.textSub },
                              isSelected && styles.restTimePanelBtnTextActive,
                            ]}
                          >
                            {formatRestLabel(sec)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSub }]}>검색 결과가 없어요.</Text>
          </View>
        }
      />

      {/* Exercise detail / alternative exercises modal */}
      {modalExercise && (
        <ExerciseDetailModal
          exercise={modalExercise}
          alternativeIds={getAlternativeIds(modalExercise)}
          allExercises={DEFAULT_EXERCISES}
          onClose={() => setModalExercise(null)}
          onAdd={(altId) => handleAddAlternative(modalExercise.id, altId)}
          onRemove={(altId) => handleRemoveAlternative(modalExercise.id, altId)}
          colors={colors}
        />
      )}
    </View>
  );
}

// ── Exercise detail / alternative exercises modal ──────────────
function ExerciseDetailModal({
  exercise,
  alternativeIds,
  allExercises,
  onClose,
  onAdd,
  onRemove,
  colors,
}: {
  exercise: Exercise;
  alternativeIds: string[];
  allExercises: Exercise[];
  onClose: () => void;
  onAdd: (altId: string) => void;
  onRemove: (altId: string) => void;
  colors: any;
}) {
  const [showAddView, setShowAddView] = useState(false);
  const [addSearch, setAddSearch] = useState('');

  const alternativeExercises = alternativeIds
    .map((id) => allExercises.find((e) => e.id === id))
    .filter(Boolean) as Exercise[];

  const candidates = allExercises.filter(
    (e) =>
      e.id !== exercise.id &&
      !alternativeIds.includes(e.id) &&
      (addSearch === '' ||
        e.name.includes(addSearch) ||
        (e.description ?? '').includes(addSearch) ||
        e.category.includes(addSearch)),
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={detailStyles.overlay}>
        <View style={[detailStyles.sheet, { backgroundColor: colors.card }]}>
          {!showAddView ? (
            <>
              {/* Header */}
              <View style={detailStyles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={[detailStyles.title, { color: colors.text }]}>
                    {displayName(exercise)}
                  </Text>
                  <Text style={[detailStyles.subtitle, { color: colors.textSub }]}>
                    {exercise.category} · {exercise.equipment}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={22} color={colors.textSub} />
                </TouchableOpacity>
              </View>

              {/* Alternative exercises section */}
              <View style={detailStyles.section}>
                <View style={detailStyles.sectionHeader}>
                  <Text style={[detailStyles.sectionTitle, { color: colors.textSub }]}>
                    대체 운동 ({alternativeExercises.length})
                  </Text>
                  <TouchableOpacity
                    style={[detailStyles.addBtn, { backgroundColor: colors.primaryBg }]}
                    onPress={() => setShowAddView(true)}
                  >
                    <Ionicons name="add" size={14} color="#4F8EF7" />
                    <Text style={detailStyles.addBtnText}>추가</Text>
                  </TouchableOpacity>
                </View>

                {alternativeExercises.length === 0 ? (
                  <Text style={[detailStyles.emptyText, { color: colors.textMuted }]}>
                    등록된 대체 운동이 없습니다
                  </Text>
                ) : (
                  <View>
                    {alternativeExercises.map((alt) => (
                      <View
                        key={alt.id}
                        style={[detailStyles.altItem, { borderBottomColor: colors.border }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[detailStyles.altName, { color: colors.text }]}>
                            {displayName(alt)}
                          </Text>
                          <Text style={[detailStyles.altSub, { color: colors.textSub }]}>
                            {alt.category} · {alt.equipment}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => onRemove(alt.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={20} color="#FF5C5C" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          ) : (
            <>
              {/* Add alternative view */}
              <View style={detailStyles.header}>
                <TouchableOpacity
                  onPress={() => { setShowAddView(false); setAddSearch(''); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="arrow-back" size={22} color={colors.textSub} />
                </TouchableOpacity>
                <Text style={[detailStyles.title, { color: colors.text, flex: 1, marginLeft: 12 }]}>
                  대체 운동 추가
                </Text>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={22} color={colors.textSub} />
                </TouchableOpacity>
              </View>

              <View style={[detailStyles.searchBox, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
                <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                <TextInput
                  value={addSearch}
                  onChangeText={setAddSearch}
                  placeholder="운동 검색..."
                  placeholderTextColor={colors.textMuted}
                  style={[detailStyles.searchInput, { color: colors.text }]}
                  autoFocus
                />
              </View>

              <FlatList
                data={candidates}
                keyExtractor={(e) => e.id}
                style={detailStyles.candidateList}
                ItemSeparatorComponent={() => (
                  <View style={{ height: 1, backgroundColor: colors.border }} />
                )}
                ListEmptyComponent={
                  <Text style={[detailStyles.emptyText, { color: colors.textMuted, textAlign: 'center', padding: 24 }]}>
                    추가할 수 있는 운동이 없습니다
                  </Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={detailStyles.candidateItem}
                    onPress={() => {
                      onAdd(item.id);
                      setShowAddView(false);
                      setAddSearch('');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[detailStyles.altName, { color: colors.text }]}>
                        {displayName(item)}
                      </Text>
                      <Text style={[detailStyles.altSub, { color: colors.textSub }]}>
                        {item.category} · {item.equipment}
                      </Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={20} color="#4F8EF7" />
                  </TouchableOpacity>
                )}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 12 },

  categoryList: { paddingBottom: 10, gap: 8 },
  categoryChip: {
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  categoryChipActive: { backgroundColor: '#4F8EF7', borderColor: '#4F8EF7' },
  categoryChipText: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  categoryChipTextActive: { color: '#fff' },

  exerciseList: { flex: 1 },
  listContent: { paddingTop: 4, paddingBottom: 40 },

  exerciseCard: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  exerciseLeft: { flex: 1 },
  exerciseName: { fontSize: 15, fontWeight: '600', marginBottom: 3 },
  exerciseMuscles: { fontSize: 12, marginTop: 3 },

  exerciseRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  categoryBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryBadgeText: { fontSize: 12, color: '#4F8EF7', fontWeight: '500' },

  restTimeIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  restTimeIconBtnActive: {},
  restTimeBadgeText: { fontSize: 11, color: '#4F8EF7', fontWeight: '600' },

  restTimePanel: {
    borderTopWidth: 1,
    padding: 12,
  },
  restTimePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  restTimePanelTitle: { fontSize: 13, fontWeight: '700', color: '#4F8EF7' },
  restTimePanelHint: { fontSize: 11, marginLeft: 4 },
  restTimePanelOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  restTimePanelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  restTimePanelBtnActive: {},
  restTimePanelBtnText: { fontSize: 13, fontWeight: '600' },
  restTimePanelBtnTextActive: { color: '#4F8EF7' },

  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
});

const detailStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingTop: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 3 },

  section: { paddingHorizontal: 20, paddingTop: 4 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  addBtnText: { fontSize: 13, fontWeight: '600', color: '#4F8EF7' },

  altItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  altName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  altSub: { fontSize: 12 },
  emptyText: { fontSize: 13, paddingVertical: 12 },

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

  candidateList: { flex: 1 },
  candidateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap: 10,
  },
});
