import React, { forwardRef, useImperativeHandle, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { AlertButton } from '../utils/alert';

export interface WebAlertRef {
  show: (title: string, message?: string, buttons?: AlertButton[]) => void;
}

const WebAlertModal = forwardRef<WebAlertRef>((_, ref) => {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [buttons, setButtons] = useState<AlertButton[]>([{ text: '확인' }]);

  useImperativeHandle(ref, () => ({
    show: (t, m, btns) => {
      setTitle(t);
      setMessage(m ?? '');
      setButtons(btns && btns.length > 0 ? btns : [{ text: '확인' }]);
      setVisible(true);
    },
  }));

  const handlePress = (btn: AlertButton) => {
    setVisible(false);
    btn.onPress?.();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={[styles.btnRow, buttons.length === 1 && styles.btnRowSingle]}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.btn,
                  buttons.length > 1 && i < buttons.length - 1 && styles.btnBorder,
                  btn.style === 'destructive' && styles.btnDestructive,
                  btn.style === 'cancel' && styles.btnCancel,
                ]}
                onPress={() => handlePress(btn)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.btnText,
                    btn.style === 'destructive' && styles.btnTextDestructive,
                    btn.style === 'cancel' && styles.btnTextCancel,
                  ]}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
});

export default WebAlertModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: 18,
    width: '100%',
    maxWidth: 320,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  message: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 18,
    lineHeight: 20,
  },
  btnRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  btnRowSingle: {},
  btn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnBorder: {
    borderRightWidth: 1,
    borderRightColor: '#F0F0F0',
  },
  btnDestructive: {},
  btnCancel: {},
  btnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F8EF7',
  },
  btnTextDestructive: {
    color: '#FF5C5C',
  },
  btnTextCancel: {
    color: '#888',
    fontWeight: '500',
  },
});
