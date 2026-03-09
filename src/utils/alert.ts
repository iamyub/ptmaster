/**
 * Platform-aware Alert utility
 * 웹에서는 커스텀 모달, 네이티브에서는 Alert.alert 사용
 */
import { Alert, Platform } from 'react-native';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type ShowFn = (title: string, message?: string, buttons?: AlertButton[]) => void;

let _webShowAlert: ShowFn | null = null;

export function registerWebAlert(fn: ShowFn) {
  _webShowAlert = fn;
}

export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS === 'web') {
    _webShowAlert?.(title, message, buttons);
    return;
  }
  Alert.alert(title, message ?? '', buttons as any);
}
