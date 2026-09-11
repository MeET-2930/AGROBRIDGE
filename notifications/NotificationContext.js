/*
 * notifications/NotificationContext.js   (install28)
 * ---------------------------------------------------------------
 * Mounted once in App.js (inside LanguageProvider + NavigationContainer).
 *
 *  - Listens to the notification documents for the logged-in user
 *    (farmer: own doc; officer: mandi doc filtered by duty; trader: own
 *    doc + mandi traders doc).
 *  - Every NEW item (arrived after the listener started) -> phone /
 *    browser notification via deviceNotify, or an in-app banner that
 *    slides down for 5 s and can be tapped.
 *  - Keeps unread count (per user, in AsyncStorage) for the bell icon.
 *  - Exposes useNotifications() -> { items, unread, markAllRead, open }.
 *
 * Slot reminders: when a farmer has an active booking we schedule two
 * local notifications (evening before at 19:00, and 60 min before the
 * slot). Works only in a build that has expo-notifications; elsewhere
 * the dashboard still shows the token and the queue light.
 * ---------------------------------------------------------------
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import Colors from '../theme/colors';
import { useLang } from '../i18n/LanguageContext';
import { getCurrentUserSession } from '../services/auth';
import { subscribeUser, subscribeCentreOfficers, subscribeCentreTraders } from '../services/notifications';
import {
  initDeviceNotifications, showNow, onNotificationTap, scheduleAt, cancelScheduled, askWebPermission, capability,
} from '../services/deviceNotify';
import { fetchActiveFarmerBooking, STATUS } from '../services/bookings';

const Ctx = createContext({ items: [], unread: 0, markAllRead: () => {}, open: () => {}, session: null });

export function useNotifications() {
  return useContext(Ctx);
}

const readKey = (uid) => `agrobridge.notif.read.${uid}`;
const remKey = (uid) => `agrobridge.notif.reminders.${uid}`;

/*
 * Props (from App.js):
 *   navigationRef - createNavigationContainerRef(), so we can navigate from
 *                   outside any screen (banner tap, OS notification tap)
 *   routeName     - name of the current screen; changes on login/logout so
 *                   we re-read the session
 */
export function NotificationProvider({ children, navigationRef, routeName }) {
  const { tr } = useLang();
  const rootRoute = routeName;

  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [lastReadAt, setLastReadAt] = useState('');
  const [banner, setBanner] = useState(null);

  const seenRef = useRef(new Set());
  const startedAtRef = useRef('');
  const slide = useRef(new Animated.Value(-120)).current;
  const bannerTimer = useRef(null);

  useEffect(() => { initDeviceNotifications(); }, []);

  // ---------- who am I ----------
  useEffect(() => {
    let alive = true;
    getCurrentUserSession().then((s) => { if (alive) setSession(s || null); });
    return () => { alive = false; };
  }, [rootRoute]);

  // ---------- open a notification's target screen ----------
  const open = useCallback((item) => {
    const r = item?.route;
    if (!r?.stack || !r?.screen) return;
    try {
      if (navigationRef?.isReady?.()) navigationRef.navigate(r.stack, { screen: r.screen, params: r.params || {} });
    } catch (e) { /* ignore */ }
  }, [navigationRef]);

  useEffect(() => onNotificationTap((data) => { if (data?.route) open({ route: data.route }); }), [open]);

  const hideBanner = useCallback(() => {
    Animated.timing(slide, { toValue: -120, duration: 220, useNativeDriver: true }).start(() => setBanner(null));
  }, [slide]);

  const showBanner = useCallback((item, title, body) => {
    setBanner({ item, title, body });
    Animated.timing(slide, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(hideBanner, 5000);
  }, [slide, hideBanner]);

  // ---------- listeners ----------
  useEffect(() => {
    setItems([]);
    seenRef.current = new Set();
    startedAtRef.current = new Date().toISOString();
    if (!session?.uid) return undefined;

    AsyncStorage.getItem(readKey(session.uid)).then((v) => setLastReadAt(v || '')).catch(() => {});

    const merged = { a: [], b: [] };
    const push = (slot) => (list) => {
      merged[slot] = list;
      const all = [...merged.a, ...merged.b].sort((x, y) => String(y.at).localeCompare(String(x.at)));
      setItems(all);

      // Fire device notification / banner for items newer than our start time.
      all.slice().reverse().forEach((it) => {
        if (seenRef.current.has(it.id)) return;
        seenRef.current.add(it.id);
        if (String(it.at) <= startedAtRef.current) return;         // history, not news
        const title = tr({ key: it.titleKey, params: it.params });
        const body = tr({ key: it.bodyKey, params: it.params });
        showNow({ title, body, data: { id: it.id, route: it.route } }).then((shownByOs) => {
          if (!shownByOs) showBanner(it, title, body);
        });
      });
    };

    const unsubs = [];
    if (session.role === 'officer' && session.centreId) {
      unsubs.push(subscribeCentreOfficers(session.centreId, session.officerDuty || 'gate', push('a')));
    } else if (session.role === 'trader') {
      unsubs.push(subscribeUser(session.uid, push('a')));
      if (session.centreId) unsubs.push(subscribeCentreTraders(session.centreId, push('b')));
    } else {
      unsubs.push(subscribeUser(session.uid, push('a')));
    }
    return () => unsubs.forEach((u) => u && u());
  }, [session?.uid, session?.role, session?.centreId, session?.officerDuty, tr, showBanner]);

  // ---------- slot reminders (farmer, native builds only) ----------
  useEffect(() => {
    if (!session?.uid || session.role !== 'farmer') return;
    if (!capability().native) return;
    let cancelled = false;
    (async () => {
      const b = await fetchActiveFarmerBooking(session.uid);
      const stored = JSON.parse((await AsyncStorage.getItem(remKey(session.uid)).catch(() => null)) || 'null');
      const key = b && b.status === STATUS.BOOKED ? `${b.tokenId}|${b.date}|${b.slotTime}` : null;
      if (stored?.key === key) return;                       // already scheduled for this slot
      if (stored?.ids?.length) await cancelScheduled(stored.ids);
      if (!key || cancelled) { await AsyncStorage.removeItem(remKey(session.uid)); return; }

      const [h] = String(b.slotTime).split(':').map(Number);
      const slotStart = new Date(`${b.date}T${String(h).padStart(2, '0')}:00:00`);
      const eveBefore = new Date(slotStart); eveBefore.setDate(eveBefore.getDate() - 1); eveBefore.setHours(19, 0, 0, 0);
      const hourBefore = new Date(slotStart.getTime() - 60 * 60 * 1000);
      const p = { token: b.tokenNumber, mandi: b.centreName, time: b.slotWindow };
      const route = { stack: 'Farmer', screen: 'TokenDetail', params: { tokenId: b.tokenId } };
      const ids = [
        await scheduleAt(eveBefore, { title: tr('nt_remEve_t'), body: tr('nt_remEve_b', p), data: { route } }),
        await scheduleAt(hourBefore, { title: tr('nt_remHour_t'), body: tr('nt_remHour_b', p), data: { route } }),
      ].filter(Boolean);
      await AsyncStorage.setItem(remKey(session.uid), JSON.stringify({ key, ids }));
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [session?.uid, session?.role, rootRoute, tr]);

  // ---------- unread ----------
  const unread = useMemo(() => items.filter((it) => String(it.at) > lastReadAt).length, [items, lastReadAt]);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    setLastReadAt(now);
    if (session?.uid) AsyncStorage.setItem(readKey(session.uid), now).catch(() => {});
    if (Platform.OS === 'web') askWebPermission();          // first bell tap asks Chrome for permission
  }, [session?.uid]);

  const value = useMemo(() => ({ items, unread, markAllRead, open, session }), [items, unread, markAllRead, open, session]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {banner ? (
        <Animated.View style={[styles.banner, { transform: [{ translateY: slide }] }]} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.bannerInner}
            activeOpacity={0.9}
            onPress={() => { hideBanner(); open(banner.item); }}
          >
            <View style={styles.bannerIcon}><Ionicons name="notifications" size={20} color={Colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>
              <Text style={styles.bannerBody} numberOfLines={2}>{banner.body}</Text>
            </View>
            <TouchableOpacity onPress={hideBanner} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={18} color={Colors.subText} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: Platform.OS === 'web' ? 10 : 40, paddingHorizontal: 12, zIndex: 999, elevation: 30 },
  bannerInner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 8,
    maxWidth: 520, alignSelf: 'center', width: '100%',
  },
  bannerIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  bannerBody: { color: Colors.subText, fontSize: 12.5, marginTop: 2 },
});
