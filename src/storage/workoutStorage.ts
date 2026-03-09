import { Workout } from '../types';
import { storageGet, storageSet } from '../utils/storage';

const WORKOUTS_KEY = '@ptmaster_workouts';

export async function loadWorkouts(): Promise<Workout[]> {
  try {
    const json = await storageGet(WORKOUTS_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveWorkouts(workouts: Workout[]): Promise<void> {
  await storageSet(WORKOUTS_KEY, JSON.stringify(workouts));
}

export async function addWorkout(workout: Workout): Promise<void> {
  const workouts = await loadWorkouts();
  workouts.unshift(workout);
  await saveWorkouts(workouts);
}

export async function updateWorkout(updated: Workout): Promise<void> {
  const workouts = await loadWorkouts();
  const idx = workouts.findIndex((w) => w.id === updated.id);
  if (idx !== -1) {
    workouts[idx] = updated;
    await saveWorkouts(workouts);
  }
}

export async function deleteWorkout(id: string): Promise<void> {
  const workouts = await loadWorkouts();
  await saveWorkouts(workouts.filter((w) => w.id !== id));
}
