/*
 * screens/officer/YardSetupScreen.js  (install55, admin only)
 * ---------------------------------------------------------------
 * The "shape" of the procurement centre that the slot planner must
 * respect but that nobody could set before:
 *   1. Calendar   - weekly closed days (default Sunday), holidays,
 *                   different hours on one day. Slot screen skips
 *                   those days and tells the farmer why.
 *   2. Sheds      - optional. Each shed / arhtiya dhera with its
 *                   floor capacity. Heaps are booked to a shed, so
 *                   floor-full is known PER shed, not only overall.
 *   3. Yield table- q/acre per crop used for the area-based ceiling
 *                   WARNING at booking (never a block).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { getCurrentUserSession } from '../../services/auth';
import { fetchCentreById, CROP_LIST } from '../../services/centres';
import { saveCalendar, saveSheds, saveYieldTable, shedFill, CALENDAR_DEFAULTS } from '../../services/bookings';
import { YIELD_Q_PER_ACRE } from '../../services/govRail';
import { useLang } from '../../i18n/LanguageContext';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export default function YardSetupScreen({ navigation }) {
  const { tr, trError } = useLang();
  const [centreId, setCentreId] = useState('');
  const [centre, setCentre] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [closedDays, setClosedDays] = useState(CALENDAR_DEFAULTS.closedDays);
  const [holidays, setHolidays] = useState([]);
  const [holDate, setHolDate] = useState('');
  const [holLabel, setHolLabel] = useState('');
  const [ovDate, setOvDate] = useState('');
  const [ovStart, setOvStart] = useState('');
  const [ovEnd, setOvEnd] = useState('');
  const [hoursOverride, setHoursOverride] = useState({});

  const [sheds, setSheds] = useState([]);
  const [yields, setYields] = useState({});

  const load = async () => {
    const u = await getCurrentUserSession();
    if (!u?.centreId) { setLoading(false); return; }
    setCentreId(u.centreId);
    const c = await fetchCentreById(u.centreId);
    setCentre(c);
    setClosedDays(Array.isArray(c?.closedDays) ? c.closedDays : CALENDAR_DEFAULTS.closedDays);
    setHolidays(Array.isArray(c?.holidays) ? c.holidays.map((h) => (typeof h === 'string' ? { date: h, label: '' } : h)) : []);
    setHoursOverride(c?.hoursOverride || {});
    setSheds(shedFill(c));
    const y = {};
    CROP_LIST.forEach((cr) => { y[cr.id] = String(c?.yieldTable?.[cr.id] ?? YIELD_Q_PER_ACRE[cr.id] ?? YIELD_Q_PER_ACRE.default); });
    setYields(y);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const act = async (fn, okKey) => {
    setBusy(true);
    try { await fn(); await load(); if (okKey) Alert.alert(tr('saved'), tr(okKey)); }
    catch (e) { Alert.alert(tr('error'), trError(e, 'notSaved')); }
    finally { setBusy(false); }
  };

  const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  const isTime = (t) => /^\d{2}:\d{2}$/.test(t);

  const addHoliday = () => {
    if (!isDate(holDate)) { Alert.alert(tr('ys_holidays'), tr('ys_dateFmt')); return; }
    const next = [...holidays.filter((h) => h.date !== holDate), { date: holDate, label: holLabel.trim() }].sort((a, b) => a.date.localeCompare(b.date));
    setHolDate(''); setHolLabel('');
    act(() => saveCalendar(centreId, { holidays: next }));
  };
  const addOverride = () => {
    if (!isDate(ovDate) || !isTime(ovStart) || !isTime(ovEnd)) { Alert.alert(tr('ys_override'), tr('ys_overrideFmt')); return; }
    const next = { ...hoursOverride, [ovDate]: { start: ovStart, end: ovEnd } };
    setOvDate(''); setOvStart(''); setOvEnd('');
    act(() => saveCalendar(centreId, { hoursOverride: next }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader navigation={navigation} showBack />
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle title={tr('ys_title')} subtitle={centre?.name || ''} />

        {/* 1. Calendar */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr('ys_calendar')}</Text>
          <Text style={styles.help}>{tr('ys_calendarHelp')}</Text>
          <Text style={styles.label}>{tr('ys_weeklyOff')}</Text>
          <View style={styles.chipRow}>
            {DAYS.map((d, i) => {
              const on = closedDays.includes(i);
              return (
                <TouchableOpacity key={d} style={[styles.chip, on && styles.chipOff]} disabled={busy}
                  onPress={() => { const next = on ? closedDays.filter((x) => x !== i) : [...closedDays, i]; setClosedDays(next); act(() => saveCalendar(centreId, { closedDays: next })); }}>
                  <Text style={[styles.chipText, on && { color: Colors.white }]}>{tr(`day_${d}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>{tr('ys_weeklyHint')}</Text>

          <Text style={styles.label}>{tr('ys_holidays')}</Text>
          {holidays.length === 0 ? <Text style={styles.hint}>{tr('ys_noHolidays')}</Text> : holidays.map((h) => (
            <View key={h.date} style={styles.line}>
              <Text style={styles.lineText}>{h.date}{h.label ? ` • ${h.label}` : ''}</Text>
              <TouchableOpacity disabled={busy} onPress={() => act(() => saveCalendar(centreId, { holidays: holidays.filter((x) => x.date !== h.date) }))}>
                <Ionicons name="close-circle" size={22} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1.1 }]} value={holDate} onChangeText={setHolDate} placeholder="2026-10-02" placeholderTextColor="#999" />
            <TextInput style={[styles.input, { flex: 1.4 }]} value={holLabel} onChangeText={setHolLabel} placeholder={tr('ys_holLabelPh')} placeholderTextColor="#999" />
            <TouchableOpacity style={styles.addBtn} onPress={addHoliday} disabled={busy}><Ionicons name="add" size={22} color={Colors.white} /></TouchableOpacity>
          </View>

          <Text style={styles.label}>{tr('ys_override')}</Text>
          <Text style={styles.hint}>{tr('ys_overrideHelp', { s: centre?.operatingStartTime || '08:00', e: centre?.operatingEndTime || '18:00' })}</Text>
          {Object.keys(hoursOverride).sort().map((d) => (
            <View key={d} style={styles.line}>
              <Text style={styles.lineText}>{d} • {hoursOverride[d].start}–{hoursOverride[d].end}</Text>
              <TouchableOpacity disabled={busy} onPress={() => { const n = { ...hoursOverride }; delete n[d]; act(() => saveCalendar(centreId, { hoursOverride: n })); }}>
                <Ionicons name="close-circle" size={22} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1.3 }]} value={ovDate} onChangeText={setOvDate} placeholder="2026-04-15" placeholderTextColor="#999" />
            <TextInput style={styles.input} value={ovStart} onChangeText={setOvStart} placeholder="06:00" placeholderTextColor="#999" />
            <TextInput style={styles.input} value={ovEnd} onChangeText={setOvEnd} placeholder="14:00" placeholderTextColor="#999" />
            <TouchableOpacity style={styles.addBtn} onPress={addOverride} disabled={busy}><Ionicons name="add" size={22} color={Colors.white} /></TouchableOpacity>
          </View>
        </View>

        {/* 2. Sheds */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr('ys_sheds')}</Text>
          <Text style={styles.help}>{tr('ys_shedsHelp')}</Text>
          {sheds.map((s, i) => (
            <View key={s.id} style={styles.shedRow}>
              <View style={{ flex: 1 }}>
                <TextInput style={styles.input} value={s.name} onChangeText={(v) => setSheds((l) => l.map((x, j) => (j === i ? { ...x, name: v } : x)))} placeholder={tr('ys_shedName')} placeholderTextColor="#999" />
                <View style={[styles.row, { marginTop: 6, alignItems: 'center' }]}>
                  <Text style={styles.hint}>{tr('ys_shedCap')}</Text>
                  <TextInput style={[styles.input, { flex: 0.6 }]} value={String(s.floorCapacityQ)} keyboardType="numeric" onChangeText={(v) => setSheds((l) => l.map((x, j) => (j === i ? { ...x, floorCapacityQ: v.replace(/\D/g, '') } : x)))} />
                  <Text style={styles.hint}>{tr('ys_shedUsed', { u: Math.round(s.usedQ || 0), p: s.percent || 0 })}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setSheds((l) => l.filter((_, j) => j !== i))}><Ionicons name="close-circle" size={22} color={Colors.error} /></TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addLink} onPress={() => setSheds((l) => [...l, { id: `S${l.length + 1}`, name: `${tr('ys_shed')} ${l.length + 1}`, floorCapacityQ: 2000, usedQ: 0, percent: 0 }])}>
            <Ionicons name="add-circle-outline" size={18} color={Colors.secondary} />
            <Text style={styles.addLinkText}>{tr('ys_addShed')}</Text>
          </TouchableOpacity>
          <PrimaryButton title={tr('ys_saveSheds')} loading={busy} onPress={() => act(() => saveSheds(centreId, sheds), 'ys_shedsSaved')} style={{ marginTop: 8, height: 44 }} />
        </View>

        {/* 3. Yield table */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr('ys_yield')}</Text>
          <Text style={styles.help}>{tr('ys_yieldHelp')}</Text>
          {CROP_LIST.map((cr) => (
            <View key={cr.id} style={styles.line}>
              <Text style={styles.lineText}>{tr(cr.nameKey)}</Text>
              <TextInput style={[styles.input, { flex: 0, width: 90, textAlign: 'center' }]} keyboardType="numeric" value={yields[cr.id] || ''} onChangeText={(v) => setYields((y) => ({ ...y, [cr.id]: v.replace(/[^\d.]/g, '') }))} />
            </View>
          ))}
          <PrimaryButton title={tr('ys_saveYield')} loading={busy} onPress={() => act(() => saveYieldTable(centreId, yields), 'ys_yieldSaved')} style={{ marginTop: 8, height: 44 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  help: { fontSize: 12, color: Colors.subText, marginTop: 4, marginBottom: 6, lineHeight: 17 },
  hint: { fontSize: 12, color: Colors.subText, marginTop: 4 },
  label: { fontWeight: '800', color: Colors.navy, marginTop: 14, marginBottom: 6, fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.white },
  chipOff: { backgroundColor: Colors.error, borderColor: Colors.error },
  chipText: { fontWeight: '800', color: Colors.navy, fontSize: 13 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  lineText: { color: Colors.navy, fontWeight: '700', fontSize: 14, flex: 1 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, height: 44, paddingHorizontal: 10, fontSize: 14, color: Colors.text, backgroundColor: Colors.white },
  addBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center' },
  shedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  addLinkText: { color: Colors.secondary, fontWeight: '800' },
});
