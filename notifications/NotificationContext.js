/*
 * notifications/NotificationContext.js   (install28)
 * ---------------------------------------------------------------
 * Mounted once in App.js (inside LanguageProvider + NavigationContainer).
 *
 *  - Listens to the notification documents for the logged-in user
 *    (farmer: own doc; officer: mandi doc filtered by duty; trader: own
 *    doc + mandi traders doc).
 *  - Every NEW item (arrived after the listener started) -> phone /
 *    browser notification via deviceNotify (no in-app banner).
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
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useLang } from '../i18n/LanguageContext';
import { getCurrentUserSession } from '../services/auth';
import { subscribeUser, subscribeCentreOfficers, subscribeCentreTraders, registerPushToken } from '../services/notifications';
import {
  initDeviceNotifications, showNow, onNotificationTap, scheduleAt, cancelScheduled, askWebPermission, capability, getPushToken, pushError,
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
  const { tr, lang } = useLang();
  const rootRoute = routeName;
  const hasPushRef = useRef(false);

  const [session, setSession] = useState(null);
  const [pushStatus, setPushStatus] = useState({ token: '', error: 'checking...' });
  const [items, setItems] = useState([]);
  const [lastReadAt, setLastReadAt] = useState('');
  const seenRef = useRef(new Set());
  const startedAtRef = useRef('');

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

  // install34: tell Firestore how to reach THIS phone while the app is closed.
  useEffect(() => {
    if (!session?.uid) return;
    let alive = true;
    (async () => {
      await initDeviceNotifications();
      const token = await getPushToken();
      if (!alive) return;
      hasPushRef.current = !!token;
      setPushStatus({ token: token || '', error: token ? '' : pushError });
      if (token) registerPushToken(session.uid, token, lang);
    })();
    return () => { alive = false; };
  }, [session?.uid, lang]);

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
        // Phones with a push token already got this from Expo's push service
        // (even with the app closed) - do not show it twice. Web still needs it.
        if (hasPushRef.current) return;
        showNow({ title, body, data: { id: it.id, route: it.route } });
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
  }, [session?.uid, session?.role, session?.centreId, session?.officerDuty, tr]);

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

  // "Send test" on the Notifications screen: goes through Expo's push servers, so it
  // proves the whole chain (FCM credentials -> Expo -> this phone), even with the app closed.
  const sendTestPush = useCallback(async () => {
    if (!pushStatus.token) return false;
    try {
      const r = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ to: pushStatus.token, title: 'AgroBridge', body: tr('nt_testBody'), channelId: 'agrobridge', priority: 'high', sound: 'default' }),
      });
      const j = await r.json().catch(() => ({}));
      const st = j?.data?.status || j?.data?.[0]?.status;
      if (st !== 'ok') { setPushStatus((p) => ({ ...p, error: JSON.stringify(j?.data?.details || j?.data?.message || j?.errors || j).slice(0, 200) })); return false; }
      return true;
    } catch (e) { setPushStatus((p) => ({ ...p, error: String(e?.message || e) })); return false; }
  }, [pushStatus.token, tr]);

  const value = useMemo(() => ({ items, unread, markAllRead, open, session, pushStatus, sendTestPush }),
    [items, unread, markAllRead, open, session, pushStatus, sendTestPush]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
