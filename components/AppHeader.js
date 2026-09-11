import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationRouteContext } from '@react-navigation/native';
import Colors from '../theme/colors';
import { useLang } from '../i18n/LanguageContext';
import { hasKey } from '../i18n/translations';
import { LOGO_MARK } from '../theme/brand';
import { useNotifications } from '../notifications/NotificationContext';

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
  showBell = true,
  title,
  tag,
  audioKey,
  audioText,
}) {
  const insets = useSafeAreaInsets();
  const { tr, speak, stopSpeak, speaking, setPickerOpen } = useLang();
  const { unread, session } = useNotifications();
  // Which screen are we on?  -> default help text is  audio_<RouteName>
  // (install21: every screen gets voice help without editing each screen)
  const route = React.useContext(NavigationRouteContext);
  const routeKey = route?.name ? `audio_${route.name}` : null;
  // install31: must come AFTER `route` is defined (was above it -> crash after login on web)
  const bellVisible = showBell && !!session?.uid && route?.name !== 'Notifications';

  const displayTitle = title != null && String(title).trim() !== '' ? String(title) : tr('brand');
  const displaySub = tag != null && String(tag).trim() !== '' ? String(tag) : tr('brandSub');
  const isBrand = !title || displayTitle === 'AgroBridge' || displayTitle === 'AGROBRIDGE' || displayTitle === tr('brand');

  const handleSpeakerPress = () => {
    if (speaking) {            // second tap = stop
      stopSpeak();
      return;
    }
    if (audioText && String(audioText).trim() !== '') {
      speak(String(audioText), true);
    } else if (routeKey && hasKey(routeKey)) {
      speak(routeKey);           // screen-specific help (audio_<RouteName>)
    } else if (audioKey) {
      speak(audioKey);           // older shared keys (audio_crop, audio_slot ...)
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
        <View style={styles.titleRow}>
          {isBrand ? <Image source={LOGO_MARK} style={styles.mark} resizeMode="contain" /> : null}
          <Text style={[styles.title, { color: isBrand ? Colors.secondary : Colors.navy }]} numberOfLines={1}>
            {displayTitle}
          </Text>
        </View>
        <Text style={styles.sub} numberOfLines={1}>{displaySub}</Text>
      </View>

      <View style={[styles.sideSlotRight, bellVisible && { width: 130 }]}>
        {bellVisible ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation?.navigate('Notifications')}
            accessibilityLabel="Notifications"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={18} color={Colors.navy} />
            {unread > 0 ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>
            ) : null}
          </TouchableOpacity>
        ) : null}
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
            <Ionicons name={speaking ? 'stop-circle' : 'volume-medium'} size={18} color={speaking ? Colors.secondary : Colors.navy} />
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mark: { width: 26, height: 26 },
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
  badge: {
    position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: Colors.white,
  },
  badgeText: { color: Colors.white, fontSize: 9.5, fontWeight: '900' },
});
