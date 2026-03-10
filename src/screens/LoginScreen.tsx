import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/authService';
import { useTheme } from '../context/ThemeContext';

export default function LoginScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleSocialLogin = async (provider: 'google' | 'kakao' | 'apple') => {
    setLoading(true);
    try {
      if (provider === 'google') await authService.signInWithGoogle();
      else if (provider === 'kakao') await authService.signInWithKakao();
      else if (provider === 'apple') await authService.signInWithApple();
    } catch (error) {
      console.error(`${provider} login failed:`, error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      <View style={styles.content}>
        {/* Logo Area */}
        <View style={styles.logoContainer}>
          <View style={[styles.logoCircle, { backgroundColor: '#4F8EF7' }]}>
            <Ionicons name="barbell" size={60} color="#FFFFFF" />
          </View>
          <Text style={styles.appName}>PT Master</Text>
          <Text style={styles.tagline}>당신의 스마트한 운동 파트너</Text>
        </View>

        {/* Login Buttons Area */}
        <View style={styles.buttonContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#4F8EF7" />
          ) : (
            <>
              {/* Kakao Login */}
              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: '#FEE500' }]}
                onPress={() => handleSocialLogin('kakao')}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble" size={20} color="#3C1E1E" />
                <Text style={[styles.buttonText, { color: '#3C1E1E' }]}>카카오로 시작하기</Text>
              </TouchableOpacity>

              {/* Google Login */}
              <TouchableOpacity
                style={[styles.loginButton, styles.googleButton]}
                onPress={() => handleSocialLogin('google')}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-google" size={20} color="#444" />
                <Text style={[styles.buttonText, { color: '#444' }]}>Google로 시작하기</Text>
              </TouchableOpacity>

              {/* Apple Login */}
              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: '#000000' }]}
                onPress={() => handleSocialLogin('apple')}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Apple로 시작하기</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.footerText}>
          계속 진행하면 서비스 이용약관 및{"\n"}개인정보 처리방침에 동의하게 됩니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 80,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  appName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1A1A2E',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  loginButton: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    position: 'absolute',
    bottom: 40,
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
  },
});
