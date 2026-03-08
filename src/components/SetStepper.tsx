import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  value: number;
  onChange: (val: number) => void;
  step: number;
  min?: number;
}

/** 무게/횟수 조절용 스테퍼: [−] [숫자입력] [+] */
export default function SetStepper({ value, onChange, step, min = 0 }: Props) {
  const decrease = () => onChange(Math.max(min, value - step));
  const increase = () => onChange(value + step);

  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.btn} onPress={decrease} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <Text style={styles.btnText}>−</Text>
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        value={value === 0 ? '' : String(value)}
        onChangeText={(v) => {
          const n = parseInt(v, 10);
          if (v === '') onChange(0);
          else if (!isNaN(n)) onChange(Math.max(min, n));
        }}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor="#ccc"
        selectTextOnFocus
      />
      <TouchableOpacity style={styles.btn} onPress={increase} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
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
    backgroundColor: '#F0F2F5',
    borderRadius: 8,
    overflow: 'hidden',
    height: 36,
  },
  btn: {
    width: 30,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E5EA',
  },
  btnText: { fontSize: 18, fontWeight: '700', color: '#4F8EF7', lineHeight: 22 },
  input: {
    flex: 1,
    height: 36,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    padding: 0,
  },
});
