import { Workout } from '../types';

/** Returns true if the workout date is strictly before today (YYYY-MM-DD comparison) */
export function isWorkoutExpired(workout: Workout): boolean {
  const workoutDateStr = workout.date.slice(0, 10);
  // Get local today date string in YYYY-MM-DD format
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  return workoutDateStr < todayStr;
}
