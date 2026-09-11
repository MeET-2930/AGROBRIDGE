/*
 * utils/webAlert.js   (install34)
 * On the website React Native's Alert.alert does NOTHING - so every
 * "Are you sure?" dialog (sell at MSP, start auction, cancel booking, log out)
 * silently died on the web build. This maps Alert.alert to the browser's
 * own dialogs. Imported once from App.js; no-op on Android/iOS.
 */
import { Alert, Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const list = Array.isArray(buttons) && buttons.length ? buttons : [{ text: 'OK' }];
    const cancel = list.find((b) => b.style === 'cancel');
    const actions = list.filter((b) => b !== cancel);
    const primary = actions[actions.length - 1] || null;   // RN convention: last button = confirm

    if (list.length === 1) {
      window.alert(text);
      list[0].onPress && list[0].onPress();
      return;
    }
    const ok = window.confirm(text + (primary?.text ? `\n\n[OK] = ${primary.text}` : ''));
    if (ok) primary?.onPress && primary.onPress();
    else cancel?.onPress && cancel.onPress();
  };
}
