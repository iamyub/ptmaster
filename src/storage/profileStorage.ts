import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

export interface UserProfile {
  name: string;
  gender: 'male' | 'female' | null;
  height: string; // cm (string for input convenience)
  weight: string; // kg (string for input convenience)
  photoUri?: string; // base64 data URI or file URI
}

export const DEFAULT_PROFILE: UserProfile = {
  name: '운동인',
  gender: null,
  height: '',
  weight: '',
};

export async function loadProfile(uid: string): Promise<UserProfile> {
  if (!uid) return DEFAULT_PROFILE;
  try {
    const docRef = doc(db, 'users', uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        ...DEFAULT_PROFILE,
        name: data.displayName || data.name || DEFAULT_PROFILE.name,
        gender: data.gender || DEFAULT_PROFILE.gender,
        height: data.height || DEFAULT_PROFILE.height,
        weight: data.weight || DEFAULT_PROFILE.weight,
        photoUri: data.photoURL || data.photoUri || undefined,
      };
    }
    return DEFAULT_PROFILE;
  } catch (error) {
    console.error('Error loading profile:', error);
    return DEFAULT_PROFILE;
  }
}

export async function saveProfile(uid: string, profile: UserProfile): Promise<void> {
  if (!uid) return;
  try {
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, profile, { merge: true });
  } catch (error) {
    console.error('Error saving profile:', error);
    throw error;
  }
}
