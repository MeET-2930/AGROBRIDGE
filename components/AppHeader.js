import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../theme/colors';
import { useLang } from '../i18n/LanguageContext';

/*
 * Original AGROBRIDGE header: centred brand + subtitle, round
 * green-tinted icon buttons. Padded by the phone's notch height so
 * back / language / speaker are always tappable.
 */
export default function AppHeader({
  navigation,
  showBack = false,
  showSpeaker = true,
  showLang = true,
  title,
  tag,
  audioKey,
  audioText,
}) {
  const insets = useSafeAreaInsets();
  const { tr, speak, stopSpeak, setPickerOpen } = useLang();

  const displayTitle = title != null && String(title).trim() !== '' ? String(title) : tr('brand');
  const displaySub = tag != null && String(tag).trim() !== '' ? String(tag) : tr('brandSub');
  const isBrand = !title || displayTitle === 'AGROBRIDGE' || displayTitle === tr('brand');

  const handleSpeakerPress = () => {
    stopSpeak();
    if (audioText && String(audioText).trim() !== '') {
      speak(String(audioText), true);
    } else if (audioKey) {
      speak(audioKey);
    } else {
      speak('audio_welcome');
    }
  };

  const canGoBack = !!(
    showBack &&
    navigation &&
    typeof navigation.canGoBack === 'function' &&
    navigation.canGoBack()
  );

  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 0) + 10 }]}>
      <View style={styles.sideSlot}>
        {canGoBack ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.navy} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>

      <View style={styles.centerBlock}>
        <Text style={[styles.title, { color: isBrand ? Colors.secondary : Colors.navy }]} numberOfLines={1}>
          {displayTitle}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>{displaySub}</Text>
      </View>

      <View style={styles.sideSlotRight}>
        {showLang ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setPickerOpen(true)}
            accessibilityLabel="Change language"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Ionicons name="language" size={18} color={Colors.navy} />
          </TouchableOpacity>
        ) : null}
        {showSpeaker ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleSpeakerPress}
            accessibilityLabel="Voice assistance"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          >
            <Ionicons name="volume-medium" size={18} color={Colors.navy} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideSlot: { width: 44, alignItems: 'flex-start' },
  sideSlotRight: { width: 88, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  centerBlock: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  sub: { fontSize: 11.5, fontWeight: '600', color: Colors.navy, marginTop: 2, textAlign: 'center' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconPlaceholder: { width: 36, height: 36 },
});
