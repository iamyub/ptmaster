import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/authService';
import { useTheme } from '../context/ThemeContext';

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { colors } = useTheme();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  const handleNext = async () => {
    if (step < 4) {
      if (step === 1 && !nickname.trim()) return;
      if (step === 2 && !gender) return;
      if (step === 3 && !height) return;
      setStep(step + 1);
    } else {
      // Final Step: Save to Firestore
      if (!weight) return;
      setLoading(true);
      try {
        const user = authService.getCurrentUser();
        if (user) {
          await authService.completeOnboarding(user.uid, {
            displayName: nickname.trim(),
            gender,
            height,
            weight,
          });
          onComplete();
        }
      } catch (error) {
        console.error('Onboarding save error:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.question}>반가워요!{"\n"}닉네임을 알려주세요.</Text>
            <TextInput
              style={[styles.input, { borderBottomColor: colors.primary }]}
              placeholder="닉네임 입력"
              value={nickname}
              onChangeText={setNickname}
              autoFocus
              maxLength={12}
            />
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.question}>성별을 선택해주세요.</Text>
            <View style={styles.genderRow}>
              <TouchableOpacity
                style={[
                  styles.genderBtn,
                  gender === 'male' && { backgroundColor: '#4F8EF7', borderColor: '#4F8EF7' },
                ]}
                onPress={() => setGender('male')}
              >
                <Ionicons name="male" size={32} color={gender === 'male' ? '#fff' : '#ccc'} />
                <Text style={[styles.genderText, gender === 'male' && { color: '#fff' }]}>남성</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderBtn,
                  gender === 'female' && { backgroundColor: '#FF6B9D', borderColor: '#FF6B9D' },
                ]}
                onPress={() => setGender('female')}
              >
                <Ionicons name="female" size={32} color={gender === 'female' ? '#fff' : '#ccc'} />
                <Text style={[styles.genderText, gender === 'female' && { color: '#fff' }]}>여성</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.question}>키가 몇 cm 인가요?</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.numberInput, { borderBottomColor: colors.primary }]}
                placeholder="000"
                value={height}
                onChangeText={(v) => setHeight(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                autoFocus
              />
              <Text style={styles.unit}>cm</Text>
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.question}>현재 몸무게는 얼마인가요?</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.numberInput, { borderBottomColor: colors.primary }]}
                placeholder="00.0"
                value={weight}
                onChangeText={(v) => setWeight(v.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
                autoFocus
              />
              <Text style={styles.unit}>kg</Text>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          {step > 1 && (
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#333" />
            </TouchableOpacity>
          )}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${(step / 4) * 100}%` }]} />
          </View>
        </View>

        <View style={styles.content}>
          {renderStep()}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextBtn, loading && { opacity: 0.7 }]}
            onPress={handleNext}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextBtnText}>{step === 4 ? '시작하기' : '다음'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backBtn: { marginRight: 16 },
  progressContainer: {
    flex: 1,
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4F8EF7',
  },
  content: { flex: 1, paddingHorizontal: 30, paddingTop: 40 },
  stepContent: { width: '100%' },
  question: { fontSize: 24, fontWeight: '800', color: '#1A1A2E', lineHeight: 34, marginBottom: 40 },
  input: {
    fontSize: 28,
    fontWeight: '600',
    paddingVertical: 10,
    borderBottomWidth: 2,
  },
  genderRow: { flexDirection: 'row', gap: 20 },
  genderBtn: {
    flex: 1,
    height: 120,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  genderText: { fontSize: 16, fontWeight: '700', color: '#ccc' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  numberInput: {
    fontSize: 40,
    fontWeight: '700',
    paddingVertical: 5,
    borderBottomWidth: 2,
    minWidth: 100,
    textAlign: 'center',
  },
  unit: { fontSize: 20, fontWeight: '600', color: '#666', marginBottom: 10 },
  footer: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 0 : 20 },
  nextBtn: {
    height: 56,
    backgroundColor: '#4F8EF7',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
