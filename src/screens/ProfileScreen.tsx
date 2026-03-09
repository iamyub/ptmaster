import React, { useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { loadWorkouts } from '../storage/workoutStorage';
import { RootStackParamList, Workout } from '../types';
import { useTheme } from '../context/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  // 헤더 우측 기어 아이콘
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          style={styles.headerGearBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="settings-outline" size={22} color="#4F8EF7" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts().then(setWorkouts);
    }, []),
  );

  const totalWorkouts = workouts.length;
  const totalExercises = workouts.reduce((sum, w) => sum + w.exercises.length, 0);
  const totalDuration = workouts.reduce((sum, w) => sum + (w.duration ?? 0), 0);

  const stats = [
    { icon: 'barbell-outline', label: '총 운동 횟수', value: `${totalWorkouts}회` },
    { icon: 'layers-outline', label: '총 종목 수', value: `${totalExercises}종목` },
    { icon: 'time-outline', label: '총 운동 시간', value: `${totalDuration}분` },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* 프로필 카드 */}
      <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={40} color="#fff" />
        </View>
        <Text style={[styles.userName, { color: colors.text }]}>운동인</Text>
        <Text style={[styles.userSubtitle, { color: colors.textSub }]}>피티마스터 사용자</Text>
      </View>

      {/* 운동 통계 */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>운동 통계</Text>
      <View style={styles.statsGrid}>
        {stats.map((s) => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name={s.icon as any} size={24} color="#4F8EF7" />
            <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.textSub }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* 설정 바로가기 */}
      <TouchableOpacity
        style={[styles.settingsLinkCard, { backgroundColor: colors.card }]}
        onPress={() => navigation.navigate('Settings')}
        activeOpacity={0.8}
      >
        <Ionicons name="settings-outline" size={20} color="#4F8EF7" />
        <Text style={[styles.settingsLinkText, { color: colors.text }]}>설정</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.settingsLinkArrow} />
      </TouchableOpacity>

      <View style={[styles.infoCard, { backgroundColor: colors.primaryBg }]}>
        <Ionicons name="information-circle-outline" size={20} color="#4F8EF7" />
        <Text style={[styles.infoText, { color: colors.textSub }]}>
          운동 기록을 꾸준히 남기면 성장 과정을 한눈에 확인할 수 있어요.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { padding: 20, paddingBottom: 40 },

  headerGearBtn: { marginRight: 4 },

  profileCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4F8EF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  userName: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  userSubtitle: { fontSize: 14, color: '#999', marginTop: 4 },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 14 },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  statLabel: { fontSize: 11, color: '#999', textAlign: 'center' },

  settingsLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    gap: 12,
  },
  settingsLinkText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  settingsLinkArrow: { marginLeft: 'auto' },

  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EEF4FF',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, color: '#555', lineHeight: 20 },
});
