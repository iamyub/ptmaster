/**
 * Platform-aware Alert utility
 * 웹에서는 커스텀 모달(등록된 경우) 또는 브라우저 기본 다이얼로그 사용
 * 네이티브에서는 Alert.alert 사용
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

function webFallbackAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const fullText = message ? `${title}\n\n${message}` : title;
  if (!buttons || buttons.length <= 1) {
    window.alert(fullText);
    buttons?.[0]?.onPress?.();
    return;
  }
  // 취소/확인 패턴: window.confirm 사용
  const nonCancels = buttons.filter((b) => b.style !== 'cancel');
  const cancel = buttons.find((b) => b.style === 'cancel');
  const confirmed = window.confirm(fullText);
  if (confirmed) {
    nonCancels[nonCancels.length - 1]?.onPress?.();
  } else {
    cancel?.onPress?.();
  }
}

export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS === 'web') {
    if (_webShowAlert) {
      _webShowAlert(title, message, buttons);
    } else {
      // 커스텀 모달 미등록 시 브라우저 기본 다이얼로그로 대체
      webFallbackAlert(title, message, buttons);
    }
    return;
  }
  Alert.alert(title, message ?? '', buttons as any);
}
