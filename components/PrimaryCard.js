/*
 * components/PrimaryCard.js   (install29)
 * Big tappable row used on role selection / login-or-register.
 *   icon   = Ionicons name (old behaviour)        e.g. "log-in-outline"
 *   image  = require('../assets/...png') (install29) - line-art role icon
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../theme/colors';

export default function PrimaryCard({ title, subtitle, icon, image, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.iconWrap, image && styles.iconWrapImage]}>
        {image ? (
          <Image source={image} style={styles.image} resizeMode="contain" />
        ) : (
          <Ionicons name={icon || 'ellipse-outline'} size={26} color={Colors.secondary} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.subText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.border, elevation: 2,
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapImage: { width: 68, height: 68, borderRadius: 34, backgroundColor: Colors.white },
  image: { width: 64, height: 64 },
  title: { fontSize: 17, fontWeight: '800', color: Colors.navy },
  subtitle: { fontSize: 13.5, color: Colors.subText, marginTop: 3, lineHeight: 17 },
});
