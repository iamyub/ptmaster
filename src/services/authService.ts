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
  gender: 'male' | 'female' | null;
  height: string;
  weight: string;
  workoutGoal: string;
  isFirstTime: boolean;
  createdAt: any;
}

export const authService = {
  onAuthStateChanged: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
  },

  getCurrentUser: () => {
    return auth.currentUser;
  },

  signIn: async (email: string, pass: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      return userCredential.user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  },

  signUp: async (email: string, pass: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      return userCredential.user;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  },

  signInGuest: async () => {
    try {
      const userCredential = await signInAnonymously(auth);
      return userCredential.user;
    } catch (error) {
      console.error('Guest sign in error:', error);
      throw error;
    }
  },

  signOut: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  },

  /**
   * Check if it's user's first time (onboarding needed)
   */
  checkIsFirstTime: async (uid: string): Promise<boolean> => {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        return snap.data().isFirstTime !== false;
      }
      return true;
    } catch {
      return true;
    }
  },

  /**
   * Complete onboarding
   */
  completeOnboarding: async (uid: string, profileData: Partial<UserProfile>) => {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        ...profileData,
        isFirstTime: false,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.error('Complete onboarding error:', error);
      throw error;
    }
  },

  syncUserToFirestore: async (user: User) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const newUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.isAnonymous ? '게스트' : (user.displayName || '사용자'),
        photoURL: user.photoURL,
        workoutGoal: '',
        isFirstTime: true,
        createdAt: serverTimestamp(),
      };
      await setDoc(userRef, newUser);
    }
  }
};
