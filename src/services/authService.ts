import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
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
  currentMargin: number;
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
   */
  syncUserToFirestore: async (user: User) => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // Create new user record with initial values
      const newUser: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '사용자',
        photoURL: user.photoURL,
        currentMargin: 63225,
        createdAt: serverTimestamp(),
      };
      await setDoc(userRef, newUser);
    } else {
      // Update existing user profile info if changed
      await updateDoc(userRef, {
        email: user.email,
        displayName: user.displayName || snap.data()?.displayName,
        photoURL: user.photoURL || snap.data()?.photoURL,
      });
    }
  },

  // Stubs for social login (will be implemented in Dev Build)
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
