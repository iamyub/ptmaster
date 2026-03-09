import { storageGet, storageSet } from '../utils/storage';

const PROFILE_KEY = '@ptmaster_profile';

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

export async function loadProfile(): Promise<UserProfile> {
  try {
    const json = await storageGet(PROFILE_KEY);
    return json ? { ...DEFAULT_PROFILE, ...JSON.parse(json) } : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await storageSet(PROFILE_KEY, JSON.stringify(profile));
}
