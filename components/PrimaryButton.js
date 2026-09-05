/*
 * components/PrimaryButton.js
 * Props: title, onPress, disabled, loading, style, variant
 *   variant = 'primary' (default) | 'outline' | 'danger'
 */
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Colors from '../theme/colors';

export default function PrimaryButton({
  title, onPress, disabled = false, loading = false, style, variant = 'primary',
}) {
  const isOutline = variant === 'outline';
  const isDanger = variant === 'danger';
  const off = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.btn, isOutline && styles.outline, isDanger && styles.danger, off && styles.off, style]}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? Colors.primary : Colors.white} />
      ) : (
        <Text style={[styles.text, isOutline && styles.textOutline]} numberOfLines={1}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  outline: { backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.primary, elevation: 0 },
  danger: { backgroundColor: Colors.error },
  off: { opacity: 0.5 },
  text: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  textOutline: { color: Colors.primary },
});
