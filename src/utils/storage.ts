/**
 * Platform-aware storage wrapper
 * 웹에서는 localStorage를 직접 사용, 네이티브에서는 AsyncStorage 사용
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return AsyncStorage.getItem(key);
}

export async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
    return;
  }
  await AsyncStorage.setItem(key, value);
}

export async function storageRemove(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.removeItem(key);
    } catch {}
    return;
  }
  await AsyncStorage.removeItem(key);
}
