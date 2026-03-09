import { Routine } from '../types';
import { storageGet, storageSet } from '../utils/storage';

const ROUTINES_KEY = '@ptmaster_routines';

/** 구버전(exerciseIds: string[]) → 신버전(exercises: RoutineExercise[]) 마이그레이션 */
function migrate(raw: any): Routine {
  if (raw.exercises && Array.isArray(raw.exercises)) return raw as Routine;
  return {
    id: raw.id,
    name: raw.name,
    exercises: (raw.exerciseIds ?? []).map((id: string) => ({
      exerciseId: id,
      sets: [{ weight: 0, reps: 0 }],
    })),
  };
}

export async function loadRoutines(): Promise<Routine[]> {
  try {
    const json = await storageGet(ROUTINES_KEY);
    const raw: any[] = json ? JSON.parse(json) : [];
    return raw.map(migrate);
  } catch {
    return [];
  }
}

export async function saveRoutines(routines: Routine[]): Promise<void> {
  await storageSet(ROUTINES_KEY, JSON.stringify(routines));
}

export async function addRoutine(routine: Routine): Promise<void> {
  const routines = await loadRoutines();
  routines.push(routine);
  await saveRoutines(routines);
}

export async function updateRoutine(updated: Routine): Promise<void> {
  const routines = await loadRoutines();
  const idx = routines.findIndex((r) => r.id === updated.id);
  if (idx !== -1) {
    routines[idx] = updated;
    await saveRoutines(routines);
  }
}

export async function deleteRoutine(id: string): Promise<void> {
  const routines = await loadRoutines();
  await saveRoutines(routines.filter((r) => r.id !== id));
}
