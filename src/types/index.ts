export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  equipment: string;
  description?: string;
}

export type ExerciseCategory =
  | '가슴'
  | '등'
  | '어깨'
  | '팔'
  | '하체'
  | '복근';

export interface WorkoutSet {
  id: string;
  weight: number;
  reps: number;
  completed: boolean;
}

export interface WorkoutExercise {
  id: string;
  exercise: Exercise;
  sets: WorkoutSet[];
  notes?: string;
}

export interface Workout {
  id: string;
  title: string;
  date: string; // ISO string
  duration?: number; // minutes
  exercises: WorkoutExercise[];
  notes?: string;
}

export interface RoutineSet {
  weight: number;
  reps: number;
}

export interface RoutineExercise {
  exerciseId: string;
  sets: RoutineSet[];
}

export interface Routine {
  id: string;
  name: string;
  exercises: RoutineExercise[];
}

export type RootStackParamList = {
  MainTabs: undefined;
  WorkoutDetail: { workoutId: string };
  AddWorkout: { routineExercises?: RoutineExercise[]; routineName?: string } | undefined;
  AddExercise: { workoutId: string };
  ExerciseDetail: { exerciseId: string };
  ManageRoutines: { routineId?: string; openForm?: boolean } | undefined;
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Exercises: undefined;
  Profile: undefined;
};
