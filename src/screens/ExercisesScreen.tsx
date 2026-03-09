import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { DEFAULT_EXERCISES, CATEGORY_LABELS } from '../utils/exercises';
import { ExerciseCategory } from '../types';
import {
  loadExerciseRestTimes,
  saveExerciseRestTime,
  ExerciseRestTimes,
} from '../storage/settingsStorage';
import { useTheme } from '../context/ThemeContext';

const CATEGORIES: { key: ExerciseCategory | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'chest', label: '가슴' },
  { key: 'back', label: '등' },
  { key: 'shoulders', label: '어깨' },
  { key: 'arms', label: '팔' },
  { key: 'legs', label: '하체' },
  { key: 'core', label: '코어' },
  { key: 'cardio', label: '유산소' },
];

// 개별 휴식시간 옵션: null = 기본값 사용
const REST_TIME_OPTIONS: (number | null)[] = [null, 30, 60, 90, 120, 180];

function formatRestLabel(sec: number | null): string {
  if (sec === null) return '기본값';
  if (sec < 60) return `${sec}초`;
  if (sec % 60 === 0) return `${sec / 60}분`;
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
}

export default function ExercisesScreen() {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | 'all'>('all');
  const [exerciseRestTimes, setExerciseRestTimes] = useState<ExerciseRestTimes>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadExerciseRestTimes().then(setExerciseRestTimes);
    }, []),
  );

  const handleSelectRestTime = async (exerciseId: string, sec: number | null) => {
    const updated = { ...exerciseRestTimes };
    if (sec === null) {
      delete updated[exerciseId];
    } else {
      updated[exerciseId] = sec;
    }
    setExerciseRestTimes(updated);
    await saveExerciseRestTime(exerciseId, sec);
    setExpandedId(null);
  };

  const filtered = DEFAULT_EXERCISES.filter((e) => {
    const matchCategory = selectedCategory === 'all' || e.category === selectedCategory;
    const matchSearch =
      e.name.includes(search) || e.muscleGroups.some((m) => m.includes(search));
    return matchCategory && matchSearch;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 검색 + 카테고리 */}
      <View>
        <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
          <Ionicons name="search-outline" size={18} color={colors.textSub} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="운동 검색..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                { backgroundColor: colors.chipBg, borderColor: colors.border },
                selectedCategory === item.key && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(item.key)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  { color: colors.textSub },
                  selectedCategory === item.key && styles.categoryChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* 운동 목록 */}
      <FlatList
        style={styles.exerciseList}
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const customTime = exerciseRestTimes[item.id];
          const hasCustomTime = customTime != null;
          const isExpanded = expandedId === item.id;

          return (
            <View style={[styles.exerciseCard, { backgroundColor: colors.card }]}>
              {/* 기본 행 */}
              <View style={styles.exerciseRow}>
                <View style={styles.exerciseLeft}>
                  <Text style={[styles.exerciseName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.exerciseMuscles, { color: colors.textSub }]}>{item.muscleGroups.join(' · ')}</Text>
                </View>

                <View style={styles.exerciseRight}>
                  <View style={[styles.categoryBadge, { backgroundColor: colors.primaryBg }]}>
                    <Text style={styles.categoryBadgeText}>
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </Text>
                  </View>

                  {/* 개별 휴식시간 버튼 */}
                  <TouchableOpacity
                    style={[
                      styles.restTimeIconBtn,
                      { backgroundColor: colors.chipBg },
                      hasCustomTime && [styles.restTimeIconBtnActive, { backgroundColor: colors.primaryBg }],
                    ]}
                    onPress={() => setExpandedId(isExpanded ? null : item.id)}
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

              {/* 개별 휴식시간 선택 패널 (확장) */}
              {isExpanded && (
                <View style={[styles.restTimePanel, { backgroundColor: colors.cardAlt, borderTopColor: colors.border }]}>
                  <View style={styles.restTimePanelHeader}>
                    <Ionicons name="timer-outline" size={14} color="#4F8EF7" />
                    <Text style={styles.restTimePanelTitle}>개별 휴식 시간</Text>
                    <Text style={[styles.restTimePanelHint, { color: colors.textMuted }]}>
                      기본값은 프로필 설정을 따릅니다
                    </Text>
                  </View>
                  <View style={styles.restTimePanelOptions}>
                    {REST_TIME_OPTIONS.map((sec) => {
                      const isSelected =
                        sec === null
                          ? !hasCustomTime
                          : exerciseRestTimes[item.id] === sec;
                      return (
                        <TouchableOpacity
                          key={String(sec)}
                          style={[styles.restTimePanelBtn, { backgroundColor: colors.card, borderColor: colors.border }, isSelected && [styles.restTimePanelBtnActive, { backgroundColor: colors.primaryBg, borderColor: '#4F8EF7' }]]}
                          onPress={() => handleSelectRestTime(item.id, sec)}
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
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSub }]}>검색 결과가 없어요.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#333', paddingVertical: 12 },

  categoryList: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  categoryChip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipActive: { backgroundColor: '#4F8EF7', borderColor: '#4F8EF7' },
  categoryChipText: { fontSize: 13, color: '#666', fontWeight: '500', lineHeight: 18 },
  categoryChipTextActive: { color: '#fff' },

  exerciseList: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  separator: { height: 10 },

  exerciseCard: {
    backgroundColor: '#fff',
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
  exerciseName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  exerciseMuscles: { fontSize: 12, color: '#999', marginTop: 3 },

  exerciseRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  categoryBadge: {
    backgroundColor: '#EEF4FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryBadgeText: { fontSize: 12, color: '#4F8EF7', fontWeight: '500' },

  // 개별 휴식시간 아이콘 버튼
  restTimeIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F5F6FA',
  },
  restTimeIconBtnActive: {
    backgroundColor: '#EEF4FF',
  },
  restTimeBadgeText: { fontSize: 11, color: '#4F8EF7', fontWeight: '600' },

  // 확장 패널
  restTimePanel: {
    backgroundColor: '#F8FAFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    padding: 12,
  },
  restTimePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  restTimePanelTitle: { fontSize: 13, fontWeight: '700', color: '#4F8EF7' },
  restTimePanelHint: { fontSize: 11, color: '#bbb', marginLeft: 4 },
  restTimePanelOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  restTimePanelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  restTimePanelBtnActive: {
    backgroundColor: '#EEF4FF',
    borderColor: '#4F8EF7',
  },
  restTimePanelBtnText: { fontSize: 13, fontWeight: '600', color: '#888' },
  restTimePanelBtnTextActive: { color: '#4F8EF7' },

  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: '#999' },
});
