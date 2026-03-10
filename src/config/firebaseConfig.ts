import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

const db = getFirestore(app);

export { auth, db };
