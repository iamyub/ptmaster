/**
 * Platform-aware storage wrapper
 * 웹에서는 localStorage를 직접 사용, 네이티브에서는 AsyncStorage 사용
 * 에러는 호출자(storage 모듈)에서 처리하도록 전파
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return window.localStorage.getItem(key);
  }
  return AsyncStorage.getItem(key);
}

export async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

export async function storageRemove(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.removeItem(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}
