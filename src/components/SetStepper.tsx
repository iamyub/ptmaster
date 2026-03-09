import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';

interface Props {
  value: number;
  onChange: (val: number) => void;
  step: number;
  min?: number;
}

/** 무게/횟수 조절용 스테퍼: [−] [숫자입력] [+] */
export default function SetStepper({ value, onChange, step, min = 0 }: Props) {
  const { isDark } = useTheme();
  const decrease = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(Math.max(min, value - step));
  };
  const increase = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(value + step);
  };

  const stepperBg = isDark ? '#252540' : '#F0F2F5';
  const btnBg = isDark ? '#2E2E50' : '#E2E5EA';
  const inputColor = isDark ? '#E8E8FF' : '#1A1A2E';
  const placeholderColor = isDark ? '#555575' : '#ccc';

  return (
    <View style={[styles.stepper, { backgroundColor: stepperBg }]}>
      <TouchableOpacity style={[styles.btn, { backgroundColor: btnBg }]} onPress={decrease} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <Text style={styles.btnText}>−</Text>
      </TouchableOpacity>
      <TextInput
        style={[styles.input, { color: inputColor }]}
        value={value === 0 ? '' : String(value)}
        onChangeText={(v) => {
          const n = parseInt(v, 10);
          if (v === '') onChange(0);
          else if (!isNaN(n)) onChange(Math.max(min, n));
        }}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={placeholderColor}
        selectTextOnFocus
      />
      <TouchableOpacity style={[styles.btn, { backgroundColor: btnBg }]} onPress={increase} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <Text style={styles.btnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    overflow: 'hidden',
    height: 36,
  },
  btn: {
    width: 30,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 18, fontWeight: '700', color: '#4F8EF7', lineHeight: 22 },
  input: {
    flex: 1,
    height: 36,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    padding: 0,
  },
});
