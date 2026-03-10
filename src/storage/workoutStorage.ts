import { 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  getDoc
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Workout } from '../types';

/**
 * 유저별 운동 기록 컬렉션 참조 반환
 */
function getWorkoutsRef(uid: string) {
  return collection(db, 'users', uid, 'workouts');
}

export async function loadWorkouts(uid: string): Promise<Workout[]> {
  if (!uid) return [];
  try {
    const q = query(getWorkoutsRef(uid), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Workout);
  } catch (error) {
    console.error('Error loading workouts:', error);
    return [];
  }
}

export async function addWorkout(uid: string, workout: Workout): Promise<void> {
  if (!uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'workouts', workout.id);
    await setDoc(docRef, workout);
  } catch (error) {
    console.error('Error adding workout:', error);
    throw error;
  }
}

export async function updateWorkout(uid: string, updated: Workout): Promise<void> {
  if (!uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'workouts', updated.id);
    await setDoc(docRef, updated, { merge: true });
  } catch (error) {
    console.error('Error updating workout:', error);
    throw error;
  }
}

export async function deleteWorkout(uid: string, id: string): Promise<void> {
  if (!uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'workouts', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting workout:', error);
    throw error;
  }
}
