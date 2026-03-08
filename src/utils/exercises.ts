import { Exercise } from '../types';

export const DEFAULT_EXERCISES: Exercise[] = [
  { id: 'e1', name: '벤치프레스', category: 'chest', muscleGroups: ['가슴', '삼두'] },
  { id: 'e2', name: '인클라인 벤치프레스', category: 'chest', muscleGroups: ['상부가슴'] },
  { id: 'e3', name: '덤벨 플라이', category: 'chest', muscleGroups: ['가슴'] },
  { id: 'e4', name: '풀업', category: 'back', muscleGroups: ['등', '이두'] },
  { id: 'e5', name: '데드리프트', category: 'back', muscleGroups: ['등', '허벅지', '둔근'] },
  { id: 'e6', name: '시티드 로우', category: 'back', muscleGroups: ['등'] },
  { id: 'e7', name: '숄더프레스', category: 'shoulders', muscleGroups: ['어깨'] },
  { id: 'e8', name: '사이드 레터럴 레이즈', category: 'shoulders', muscleGroups: ['측면 어깨'] },
  { id: 'e9', name: '스쿼트', category: 'legs', muscleGroups: ['허벅지', '둔근'] },
  { id: 'e10', name: '레그프레스', category: 'legs', muscleGroups: ['허벅지'] },
  { id: 'e11', name: '런지', category: 'legs', muscleGroups: ['허벅지', '둔근'] },
  { id: 'e12', name: '레그컬', category: 'legs', muscleGroups: ['햄스트링'] },
  { id: 'e13', name: '바이셉 컬', category: 'arms', muscleGroups: ['이두'] },
  { id: 'e14', name: '트라이셉 익스텐션', category: 'arms', muscleGroups: ['삼두'] },
  { id: 'e15', name: '플랭크', category: 'core', muscleGroups: ['복근', '코어'] },
  { id: 'e16', name: '크런치', category: 'core', muscleGroups: ['복근'] },
  { id: 'e17', name: '러닝', category: 'cardio', muscleGroups: ['전신'] },
  { id: 'e18', name: '사이클', category: 'cardio', muscleGroups: ['하체'] },
];

export const CATEGORY_LABELS: Record<string, string> = {
  chest: '가슴',
  back: '등',
  shoulders: '어깨',
  arms: '팔',
  legs: '하체',
  core: '코어',
  cardio: '유산소',
  full_body: '전신',
};
