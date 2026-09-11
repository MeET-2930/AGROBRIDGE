/*
 * services/deviceNotify.js   (install28)
 * ---------------------------------------------------------------
 * The part of notifications that touches the PHONE.
 *
 * Three levels, picked automatically:
 *   1. expo-notifications present in the binary  -> real Android
 *      notifications (status bar, sound, works when app is closed,
 *      scheduled slot reminders).                     [after next eas build]
 *   2. Web browser                                  -> browser notification
 *      (Chrome asks permission the first time).
 *   3. Anything else (Expo Go, current APK)         -> vibration + the
 *      in-app banner drawn by NotificationContext.
 *
 * expo-notifications is loaded with a dynamic require so the app still
 * bundles and runs when the package is not installed.
 * ---------------------------------------------------------------
 */
import { Platform, Vibration } from 'react-native';

let Notifications = null;
let ready = false;
let permitted = false;
const CHANNEL = 'agrobridge';

function loadModule() {
  if (Notifications !== null) return Notifications;
  try {
    const name = 'expo-notifications';           // variable name = Metro does not pre-resolve it
    // eslint-disable-next-line import/no-dynamic-require, global-require
    Notifications = require(name);
  } catch (e) {
    Notifications = false;                       // not installed in this build
  }
  return Notifications;
}

/** Call once at start-up. Safe to call again. */
export async function initDeviceNotifications() {
  if (ready) return capability();
  ready = true;

  if (Platform.OS === 'web') {
    permitted = typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted';
    return capability();
  }

  const N = loadModule();
  if (!N) return capability();

  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHANNEL, {
        name: 'AgroBridge',
        importance: N.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 200, 300],
        sound: 'default',
        lightColor: '#F5A623',
      });
    }
    const cur = await N.getPermissionsAsync();
    let status = cur.status;
    if (status !== 'granted') {
      const req = await N.requestPermissionsAsync();
      status = req.status;
    }
    permitted = status === 'granted';
  } catch (e) {
    console.log('device notifications unavailable:', e?.message);
    permitted = false;
  }
  return capability();
}

export function capability() {
  const N = loadModule();
  return {
    native: !!N && permitted,           // real OS notifications
    web: Platform.OS === 'web' && permitted,
    fallback: !( (!!N && permitted) || (Platform.OS === 'web' && permitted) ),
  };
}

/** Browser permission must be asked from a user tap (e.g. the bell). */
export async function askWebPermission() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) return false;
  try {
    const r = await window.Notification.requestPermission();
    permitted = r === 'granted';
  } catch (e) { permitted = false; }
  return permitted;
}

/**
 * Show one notification NOW. Returns true if the OS/browser showed it,
 * false if the caller must show the in-app banner instead.
 */
export async function showNow({ title, body, data }) {
  if (Platform.OS === 'web') {
    if (permitted && typeof window !== 'undefined') {
      try {
        const n = new window.Notification(title, { body, icon: '/favicon.ico', tag: data?.id });
        n.onclick = () => { window.focus(); if (webTapHandler) webTapHandler(data); n.close(); };
        return true;
      } catch (e) { /* fall through */ }
    }
    return false;
  }

  const N = loadModule();
  if (N && permitted) {
    try {
      await N.scheduleNotificationAsync({
        content: { title, body, data: data || {}, sound: 'default', ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
        trigger: null,
      });
      return true;
    } catch (e) { /* fall through */ }
  }

  try { Vibration.vibrate([0, 250, 150, 250]); } catch (e) { /* ignore */ }
  return false;
}

/**
 * Schedule a notification for a future time (slot reminders).
 * Returns an id or null when the build cannot schedule (Expo Go / web).
 */
export async function scheduleAt(when, { title, body, data }) {
  const N = loadModule();
  if (!N || !permitted) return null;
  const date = when instanceof Date ? when : new Date(when);
  if (!(date.getTime() > Date.now() + 5000)) return null;
  try {
    return await N.scheduleNotificationAsync({
      content: { title, body, data: data || {}, sound: 'default', ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
      trigger: { type: 'date', date },
    });
  } catch (e) {
    try {   // older SDK trigger shape
      return await N.scheduleNotificationAsync({ content: { title, body, data: data || {} }, trigger: date });
    } catch (e2) { return null; }
  }
}

export async function cancelScheduled(ids = []) {
  const N = loadModule();
  if (!N) return;
  await Promise.all(ids.filter(Boolean).map((id) => N.cancelScheduledNotificationAsync(id).catch(() => {})));
}

/* ---- taps on OS notifications -> app navigation ---- */
let webTapHandler = null;

export function onNotificationTap(handler) {
  webTapHandler = handler;
  const N = loadModule();
  if (!N) return () => {};
  try {
    const sub = N.addNotificationResponseReceivedListener((resp) => {
      handler(resp?.notification?.request?.content?.data || {});
    });
    // App opened from a killed state by tapping a notification:
    N.getLastNotificationResponseAsync?.().then((resp) => {
      if (resp) handler(resp?.notification?.request?.content?.data || {});
    }).catch(() => {});
    return () => sub.remove();
  } catch (e) {
    return () => {};
  }
}
