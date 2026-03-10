import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/authService';
import { useTheme } from '../context/ThemeContext';

export default function LoginScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('알림', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        await authService.signUp(email, password);
      } else {
        await authService.signIn(email, password);
      }
    } catch (error: any) {
      console.error('Auth error detail:', error);
      let msg = `인증에 실패했습니다. (${error.code})`;
      if (error.code === 'auth/email-already-in-use') msg = '이미 사용 중인 이메일입니다.';
      if (error.code === 'auth/invalid-email') msg = '유효하지 않은 이메일 형식입니다.';
      if (error.code === 'auth/weak-password') msg = '비밀번호는 최소 6자리 이상이어야 합니다.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        msg = '이메일 또는 비밀번호가 올바르지 않습니다.';
      }
      Alert.alert('오류', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'kakao' | 'apple') => {
    try {
      if (provider === 'google') await authService.signInWithGoogle();
      else if (provider === 'kakao') await authService.signInWithKakao();
      else if (provider === 'apple') await authService.signInWithApple();
    } catch (error) {
      console.error(`${provider} login failed:`, error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Logo Area */}
          <View style={styles.logoContainer}>
            <View style={[styles.logoCircle, { backgroundColor: '#4F8EF7' }]}>
              <Ionicons name="barbell" size={60} color="#FFFFFF" />
            </View>
            <Text style={styles.appName}>PT Master</Text>
            <Text style={styles.tagline}>당신의 스마트한 운동 파트너</Text>
          </View>

          {/* Email/Password Form */}
          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="이메일 주소"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="비밀번호"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.mainButton, { backgroundColor: '#4F8EF7' }]}
              onPress={handleEmailAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.mainButtonText}>
                  {isSignUp ? '회원가입' : '로그인'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setIsSignUp(!isSignUp)} 
              style={styles.toggleTextWrapper}
            >
              <Text style={styles.toggleText}>
                {isSignUp ? '이미 계정이 있으신가요? 로그인' : '처음이신가요? 계정 만들기'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => authService.signInGuest()} 
              style={styles.guestBtn}
            >
              <Text style={styles.guestBtnText}>로그인 없이 둘러보기</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>간편 로그인</Text>
            <View style={styles.divider} />
          </View>

          {/* Social Login Buttons */}
          <View style={styles.socialContainer}>
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={[styles.socialIconBtn, { backgroundColor: '#FEE500' }]}
                onPress={() => handleSocialLogin('kakao')}
              >
                <Ionicons name="chatbubble" size={24} color="#3C1E1E" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.socialIconBtn, styles.googleBtn]}
                onPress={() => handleSocialLogin('google')}
              >
                <Ionicons name="logo-google" size={24} color="#444" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.socialIconBtn, { backgroundColor: '#000000' }]}
                onPress={() => handleSocialLogin('apple')}
              >
                <Ionicons name="logo-apple" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.footerText}>
            계속 진행하면 서비스 이용약관 및{"\n"}개인정보 처리방침에 동의하게 됩니다.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 30,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1A1A2E',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  formContainer: {
    width: '100%',
    marginBottom: 30,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  mainButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  toggleTextWrapper: {
    marginTop: 16,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'underline',
  },
  guestBtn: {
    marginTop: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  guestBtnText: {
    fontSize: 14,
    color: '#4F8EF7',
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#EEEEEE',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 13,
    color: '#BBB',
  },
  socialContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 20,
  },
  socialIconBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#AAA',
    lineHeight: 18,
  },
});
