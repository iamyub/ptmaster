import { Workout } from '../types';

/** Returns true if the workout date is before today (YYYY-MM-DD comparison) */
export function isWorkoutExpired(workout: Workout): boolean {
  const workoutDate = workout.date.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return workoutDate < today;
}
