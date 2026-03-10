import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { loadWorkouts } from '../storage/workoutStorage';
import {
  loadProfile,
  saveProfile,
  UserProfile,
  DEFAULT_PROFILE,
} from '../storage/profileStorage';
import { RootStackParamList, Workout } from '../types';
import { useTheme } from '../context/ThemeContext';
import { authService } from '../services/authService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const currentUser = authService.getCurrentUser();

  // #10: 톱니바퀴 아이콘 여백 수정
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
      if (!currentUser) return;
      loadWorkouts(currentUser.uid).then(setWorkouts);
      loadProfile(currentUser.uid).then(setProfile);
    }, [currentUser]),
  );

  const totalWorkouts = workouts.length;
  const totalExercises = workouts.reduce((sum, w) => sum + w.exercises.length, 0);
  const totalDuration = workouts.reduce((sum, w) => sum + (w.duration ?? 0), 0);

  const stats = [
    { icon: 'barbell-outline', label: '총 운동 횟수', value: `${totalWorkouts}회` },
    { icon: 'layers-outline', label: '총 종목 수', value: `${totalExercises}종목` },
    { icon: 'time-outline', label: '총 운동 시간', value: `${totalDuration}분` },
  ];

  const handleSaveName = async () => {
    if (!currentUser) return;
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setEditingName(false);
      return;
    }
    const updated = { ...profile, name: trimmed };
    setProfile(updated);
    await saveProfile(currentUser.uid, updated);
    setEditingName(false);
  };

  const handleGenderSelect = async (gender: 'male' | 'female') => {
    if (!currentUser) return;
    const updated = { ...profile, gender: profile.gender === gender ? null : gender };
    setProfile(updated);
    await saveProfile(currentUser.uid, updated);
  };

  const handleBodyInfoChange = async (field: 'height' | 'weight', value: string) => {
    if (!currentUser) return;
    const updated = { ...profile, [field]: value };
    setProfile(updated);
    await saveProfile(currentUser.uid, updated);
  };

  const initials = profile.name
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const handlePickPhoto = async () => {
    if (!currentUser) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        const updated = { ...profile, photoUri: uri };
        setProfile(updated);
        await saveProfile(currentUser.uid, updated);
      }
    } catch {
      Alert.alert('오류', '사진을 불러오는 데 실패했습니다.');
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* 프로필 카드 */}
      <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
        {/* 아바타 */}
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={handlePickPhoto}
          activeOpacity={0.8}
        >
          <View style={styles.avatarCircle}>
            {profile.photoUri ? (
              <Image
                source={{ uri: profile.photoUri }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarInitials}>{initials || '?'}</Text>
            )}
          </View>
          <View style={styles.avatarCameraOverlay}>
            <Ionicons name="camera-outline" size={14} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* 이름 편집 */}
        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              style={[styles.nameInput, { color: colors.text, borderColor: colors.primary }]}
              autoFocus
              onSubmitEditing={handleSaveName}
              returnKeyType="done"
              maxLength={20}
            />
            <TouchableOpacity onPress={handleSaveName} style={styles.nameEditConfirmBtn}>
              <Ionicons name="checkmark" size={20} color="#4F8EF7" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEditingName(false)}
              style={styles.nameEditCancelBtn}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.nameRow}
            onPress={() => {
              setNameInput(profile.name);
              setEditingName(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.userName, { color: colors.text }]}>{profile.name}</Text>
            <Ionicons name="pencil-outline" size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        )}
        <Text style={[styles.userSubtitle, { color: colors.textSub }]}>피티마스터 사용자</Text>

        {/* 신체 정보 */}
        <View style={[styles.bodyInfoSection, { borderTopColor: colors.border }]}>
          {/* 성별 */}
          <View style={styles.bodyInfoRow}>
            <Text style={[styles.bodyInfoLabel, { color: colors.textSub }]}>성별</Text>
            <View style={styles.genderButtons}>
              <TouchableOpacity
                style={[
                  styles.genderBtn,
                  { borderColor: colors.border, backgroundColor: colors.chipBg },
                  profile.gender === 'male' && styles.genderBtnActive,
                ]}
                onPress={() => handleGenderSelect('male')}
              >
                <Ionicons
                  name="male-outline"
                  size={14}
                  color={profile.gender === 'male' ? '#fff' : colors.textSub}
                />
                <Text
                  style={[
                    styles.genderBtnText,
                    { color: profile.gender === 'male' ? '#fff' : colors.textSub },
                  ]}
                >
                  남
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderBtn,
                  { borderColor: colors.border, backgroundColor: colors.chipBg },
                  profile.gender === 'female' && [styles.genderBtnActive, { backgroundColor: '#FF6B9D', borderColor: '#FF6B9D' }],
                ]}
                onPress={() => handleGenderSelect('female')}
              >
                <Ionicons
                  name="female-outline"
                  size={14}
                  color={profile.gender === 'female' ? '#fff' : colors.textSub}
                />
                <Text
                  style={[
                    styles.genderBtnText,
                    { color: profile.gender === 'female' ? '#fff' : colors.textSub },
                  ]}
                >
                  여
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 키 / 몸무게 */}
          <View style={styles.bodyInfoRow}>
            <Text style={[styles.bodyInfoLabel, { color: colors.textSub }]}>키</Text>
            <View style={styles.bodyInputWrap}>
              <TextInput
                value={profile.height}
                onChangeText={(v) => handleBodyInfoChange('height', v.replace(/[^0-9.]/g, ''))}
                placeholder="–"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                style={[styles.bodyInput, { color: colors.text, borderColor: colors.border }]}
              />
              <Text style={[styles.bodyUnit, { color: colors.textSub }]}>cm</Text>
            </View>
          </View>

          <View style={styles.bodyInfoRow}>
            <Text style={[styles.bodyInfoLabel, { color: colors.textSub }]}>몸무게</Text>
            <View style={styles.bodyInputWrap}>
              <TextInput
                value={profile.weight}
                onChangeText={(v) => handleBodyInfoChange('weight', v.replace(/[^0-9.]/g, ''))}
                placeholder="–"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                style={[styles.bodyInput, { color: colors.text, borderColor: colors.border }]}
              />
              <Text style={[styles.bodyUnit, { color: colors.textSub }]}>kg</Text>
            </View>
          </View>
        </View>
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

      {/* #11: 설정 카드 제거 - infoCard만 남김 */}
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
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  // #10: marginRight 16으로 수정
  headerGearBtn: { marginRight: 16 },

  profileCard: {
    alignItems: 'center',
    borderRadius: 20,
    padding: 28,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4F8EF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 28, fontWeight: '800', color: '#fff' },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarCameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },

  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  userName: { fontSize: 20, fontWeight: '700' },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '700',
    borderBottomWidth: 2,
    paddingVertical: 2,
    paddingHorizontal: 4,
    minWidth: 120,
  },
  nameEditConfirmBtn: { padding: 4 },
  nameEditCancelBtn: { padding: 4 },
  userSubtitle: { fontSize: 14, marginTop: 2, marginBottom: 16 },

  bodyInfoSection: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 16,
    gap: 12,
  },
  bodyInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bodyInfoLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  genderButtons: { flexDirection: 'row', gap: 8 },
  genderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  genderBtnActive: { backgroundColor: '#4F8EF7', borderColor: '#4F8EF7' },
  genderBtnText: { fontSize: 13, fontWeight: '600' },
  bodyInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bodyInput: {
    fontSize: 15,
    fontWeight: '600',
    borderBottomWidth: 1.5,
    paddingVertical: 3,
    paddingHorizontal: 4,
    minWidth: 70,
    textAlign: 'right',
  },
  bodyUnit: { fontSize: 13, fontWeight: '500' },

  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 14 },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
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
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 11, textAlign: 'center' },

  infoCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 20 },
});
