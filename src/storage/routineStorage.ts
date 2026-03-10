import { 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Routine } from '../types';

/**
 * 유저별 루틴 컬렉션 참조 반환
 */
function getRoutinesRef(uid: string) {
  return collection(db, 'users', uid, 'routines');
}

export async function loadRoutines(uid: string): Promise<Routine[]> {
  if (!uid) return [];
  try {
    const snapshot = await getDocs(getRoutinesRef(uid));
    return snapshot.docs.map(doc => doc.data() as Routine);
  } catch (error) {
    console.error('Error loading routines:', error);
    return [];
  }
}

export async function addRoutine(uid: string, routine: Routine): Promise<void> {
  if (!uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'routines', routine.id);
    await setDoc(docRef, routine);
  } catch (error) {
    console.error('Error adding routine:', error);
    throw error;
  }
}

export async function updateRoutine(uid: string, updated: Routine): Promise<void> {
  if (!uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'routines', updated.id);
    await setDoc(docRef, updated, { merge: true });
  } catch (error) {
    console.error('Error updating routine:', error);
    throw error;
  }
}

export async function deleteRoutine(uid: string, id: string): Promise<void> {
  if (!uid) return;
  try {
    const docRef = doc(db, 'users', uid, 'routines', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting routine:', error);
    throw error;
  }
}
