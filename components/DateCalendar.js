/*
 * components/DateCalendar.js   (install49)
 * ---------------------------------------------------------------
 * A small month calendar. No external library - works in the in-app
 * preview, on web and on Android alike.
 *
 *   <DateCalendar value="2026-09-21" onChange={setDate}
 *                 minDate="2026-09-19" maxDate="2026-09-26" />
 *
 * Days outside [minDate, maxDate] are greyed out and not tappable, so
 * the booking horizon (7 days grain / 1 day perishables) is enforced
 * visually as well as by the engine.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../theme/colors';
import { localDateString, parseLocalDate, todayLocal } from '../services/dates';

const DOW = {
  hi: ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'],
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  pa: ['ਐ', 'ਸੋ', 'ਮੰ', 'ਬੁੱ', 'ਵੀ', 'ਸ਼ੁੱ', 'ਸ਼'],
  mr: ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'],
};
const LOCALE = { hi: 'hi-IN', en: 'en-IN', pa: 'pa-IN', mr: 'mr-IN' };

export default function DateCalendar({ value, onChange, minDate, maxDate, lang = 'hi' }) {
  const start = parseLocalDate(value || todayLocal());
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth() });

  const first = new Date(view.y, view.m, 1);
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const lead = first.getDay();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.y, view.m, d));
  while (cells.length % 7) cells.push(null);

  const monthLabel = first.toLocaleDateString(LOCALE[lang] || 'hi-IN', { month: 'long', year: 'numeric' });
  const inRange = (ds) => (!minDate || ds >= minDate) && (!maxDate || ds <= maxDate);
  const today = todayLocal();

  const prevMonth = () => setView(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
  const nextMonth = () => setView(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <TouchableOpacity onPress={prevMonth} style={styles.nav}><Ionicons name="chevron-back" size={20} color={Colors.navy} /></TouchableOpacity>
        <Text style={styles.month}>{monthLabel}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.nav}><Ionicons name="chevron-forward" size={20} color={Colors.navy} /></TouchableOpacity>
      </View>
      <View style={styles.row}>
        {(DOW[lang] || DOW.hi).map((d, i) => <Text key={i} style={styles.dow}>{d}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }).map((_, r) => (
        <View key={r} style={styles.row}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            if (!d) return <View key={i} style={styles.cell} />;
            const ds = localDateString(d);
            const ok = inRange(ds);
            const on = ds === value;
            return (
              <TouchableOpacity
                key={i} disabled={!ok} onPress={() => onChange(ds)}
                style={[styles.cell, ok && styles.cellOk, on && styles.cellOn, ds === today && !on && styles.cellToday]}
              >
                <Text style={[styles.day, !ok && styles.dayOff, on && styles.dayOn]}>{d.getDate()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 10, marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  nav: { padding: 6 },
  month: { fontWeight: '800', color: Colors.navy, fontSize: 15 },
  row: { flexDirection: 'row' },
  dow: { flex: 1, textAlign: 'center', color: Colors.subText, fontWeight: '700', fontSize: 12, paddingVertical: 4 },
  cell: { flex: 1, aspectRatio: 1, margin: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cellOk: { backgroundColor: Colors.background },
  cellOn: { backgroundColor: Colors.navy },
  cellToday: { borderWidth: 1.5, borderColor: Colors.primary },
  day: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  dayOff: { color: '#C4C9D4', fontWeight: '600' },
  dayOn: { color: Colors.white },
});
