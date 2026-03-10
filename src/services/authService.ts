import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

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
  onAuthStateChanged: (callback: (user: any) => void) => {
    return auth().onAuthStateChanged(callback);
  },

  /**
   * Get current user
   */
  getCurrentUser: () => {
    return auth().currentUser;
  },

  /**
   * Sign out
   */
  signOut: async () => {
    try {
      await auth().signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  },

  /**
   * Initialize or update user data in Firestore after login
   */
  syncUserToFirestore: async (user: any) => {
    if (!user) return;

    const userRef = firestore().collection('users').doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists) {
      // Create new user record with initial values
      const newUser: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '사용자',
        photoURL: user.photoURL,
        currentMargin: 63225, // Requested initial value
        createdAt: firestore.FieldValue.serverTimestamp(),
      };
      await userRef.set(newUser);
    } else {
      // Update existing user profile info if changed
      await userRef.update({
        email: user.email,
        displayName: user.displayName || doc.data()?.displayName,
        photoURL: user.photoURL || doc.data()?.photoURL,
      });
    }
  },

  // Note: Actual Social Login implementations (Google, Kakao, Apple) 
  // require additional native libraries and configuration.
  // These are stubs for now as they depend on your specific keys and setup.
  signInWithGoogle: async () => {
    console.log('Google login triggered - requires @react-native-google-signin/google-signin');
    // Implementation placeholder
  },

  signInWithKakao: async () => {
    console.log('Kakao login triggered - requires @actbase/react-native-kakaosdk or similar');
    // Implementation placeholder
  },

  signInWithApple: async () => {
    console.log('Apple login triggered - requires @invertase/react-native-apple-authentication');
    // Implementation placeholder
  }
};
