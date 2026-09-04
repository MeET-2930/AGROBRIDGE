import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Colors from '../theme/colors';

export default function PrimaryButton({
  title, onPress, style, textStyle, disabled = false, loading = false, variant = 'primary',
}) {
  let btnBg = Colors.primary;
  let textColor = Colors.white;
  let borderColor = 'transparent';
  if (variant === 'secondary') btnBg = Colors.secondary;
  else if (variant === 'outline') { btnBg = Colors.white; textColor = Colors.navy; borderColor = Colors.border; }
  else if (variant === 'danger') btnBg = Colors.error;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: btnBg, borderColor, borderWidth: variant === 'outline' ? 1.5 : 0 },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? Colors.navy : Colors.white} />
      ) : (
        <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  disabled: { opacity: 0.55 },
  text: { fontSize: 16, fontWeight: '700', letterSpacing: 0.4 },
});