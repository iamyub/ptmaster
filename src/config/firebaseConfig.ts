import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase 프로젝트 실제 설정값 적용
const firebaseConfig = {
  apiKey: "AIzaSyDpsovyVAJUw_gM2mshS-4bVOFvkL66lSc",
  authDomain: "ptmaster-94e53.firebaseapp.com",
  projectId: "ptmaster-94e53",
  storageBucket: "ptmaster-94e53.firebasestorage.app",
  messagingSenderId: "406682351820",
  appId: "1:406682351820:web:cf37b235ccd4bd803e6a69",
  measurementId: "G-H565J7XC9Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage for persistence in Expo
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

/**
 * Expo/React Native 환경에서 WebSocket 연결이 불안정할 경우를 대비해
 * 롱 폴링(Long Polling) 방식을 강제 활성화합니다.
 */
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export { auth, db };
