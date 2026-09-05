/*
 * services/feedback.js
 * In-app bug reports from testers. Written to Firestore `feedback`,
 * read in the Firebase console (Firestore → feedback).
 */
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { db } from './firebase';
import { getCurrentUserSession } from './auth';

export const APP_VERSION =
  Constants.expoConfig?.version || Constants.manifest?.version || 'dev';

export async function sendFeedback({ text, screen = '', lang = 'hi' }) {
  const session = await getCurrentUserSession();
  await addDoc(collection(db, 'feedback'), {
    text: String(text || '').trim(),
    screen,
    lang,
    role: session?.role || 'guest',
    name: session?.name || null,
    phone: session?.phone || null,
    centreId: session?.centreId || null,
    appVersion: APP_VERSION,
    platform: `${Platform.OS} ${Platform.Version}`,
    createdAt: serverTimestamp(),
    status: 'open',
  });
}
