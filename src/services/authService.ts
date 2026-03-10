import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously,
  signOut,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  workoutGoal: string; // 기본 운동 목표 (초기값 빈 문자열)
  createdAt: any;
}

export const authService = {
  /**
   * Observe auth state changes
   */
  onAuthStateChanged: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Get current user
   */
  getCurrentUser: () => {
    return auth.currentUser;
  },

  /**
   * Sign in with email and password
   */
  signIn: async (email: string, pass: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      return userCredential.user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  },

  /**
   * Sign up with email and password
   */
  signUp: async (email: string, pass: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      return userCredential.user;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  },

  /**
   * Sign in anonymously (Guest mode)
   */
  signInGuest: async () => {
    try {
      const userCredential = await signInAnonymously(auth);
      return userCredential.user;
    } catch (error) {
      console.error('Guest sign in error:', error);
      throw error;
    }
  },

  /**
   * Sign out
   */
  signOut: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  },

  /**
   * Initialize or update user data in Firestore after login
   * 목적: 유저별 운동 기록과 루틴 보관을 위한 기초 문서 생성
   */
  syncUserToFirestore: async (user: User) => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // 신규 유저: 가입 날짜와 빈 운동 목표 필드 생성
      const newUser: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.isAnonymous ? '게스트' : (user.displayName || '사용자'),
        photoURL: user.photoURL,
        workoutGoal: '', // 초기 상태는 비어있음
        createdAt: serverTimestamp(),
      };
      await setDoc(userRef, newUser);
    } else {
      // 기존 유저: 프로필 정보(이름, 사진) 변경 시 업데이트
      await updateDoc(userRef, {
        email: user.email,
        displayName: user.displayName || snap.data()?.displayName,
        photoURL: user.photoURL || snap.data()?.photoURL,
      });
    }
  },

  // 구글/카카오/애플 로그인 스텁 (나중에 개발 빌드에서 구현)
  signInWithGoogle: async () => {
    alert('Social login requires Dev Build. Please use Email login for now in Expo Go.');
  },
  signInWithKakao: async () => {
    alert('Social login requires Dev Build. Please use Email login for now in Expo Go.');
  },
  signInWithApple: async () => {
    alert('Social login requires Dev Build. Please use Email login for now in Expo Go.');
  }
};
