/*
 * screens/arhtiya/BulkBookScreen.js  (install56, "58" arhtiya bulk)
 * ---------------------------------------------------------------
 * One screen, one day, many farmers.
 *   1. pick mandi + crop + date (next 7 open days)
 *   2. tick farmers, type each one's quintals
 *   3. "Book all" -> each farmer gets his own normal pass, filled in
 *      order from the first hour with room. Result list shows who got
 *      which hour and who did not (with the reason). Nothing is moved,
 *      nothing is promised for tomorrow.
 * Below the form: today's/that day's plan for this arhtiya grouped by
 * hour, so he can tell each farmer "come at 10, not 8".
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { fetchMyFarmers, getCurrentUserSession } from '../../services/auth';
import { fetchCentres, centreLabel, CROP_LIST } from '../../services/centres';
import { bulkBookForFarmers, bulkBookNextOpenDay, fetchArhtiyaDay, dayStatus, todayString } from '../../services/bookings';
import { useLang } from '../../i18n/LanguageContext';
import { hasKey } from '../../i18n/translations';

export default function BulkBookScreen({ navigation }) {
  const { tr, lang, trError } = useLang();
  const [me, setMe] = useState(null);
  const [centres, setCentres] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [centreId, setCentreId] = useState(null);
  const [crop, setCrop] = useState('wheat');
  const [date, setDate] = useState(todayString());
  const [picked, setPicked] = useState({}); // uid -> quintals string
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [plan, setPlan] = useState([]);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUserSession();
      setMe(u);
      const cs = await fetchCentres();
      setCentres(cs);
      setCentreId(u?.centreId || cs[0]?.id || null);
      setFarmers(await fetchMyFarmers());
    })();
  }, []);

  const loadPlan = async () => { if (me?.uid) setPlan(await fetchArhtiyaDay(me.uid, date)); };
  useFocusEffect(useCallback(() => { loadPlan(); }, [me, date]));

  const centre = centres.find((c) => c.id === centreId);
  const days = [];
  for (let off = 0; off <= 7; off += 1) {
    const d = new Date(); d.setDate(d.getDate() + off);
    const ds = todayString(d);
    const st = centre ? dayStatus(centre, ds) : { open: true };
    days.push({ ds, off, open: st.open });
  }

  const toggle = (f) => setPicked((p) => { const n = { ...p }; if (n[f.uid] != null) delete n[f.uid]; else n[f.uid] = '20'; return n; });
  const selected = farmers.filter((f) => picked[f.uid] != null);
  const totalQ = selected.reduce((s, f) => s + (Number(picked[f.uid]) || 0), 0);

  const bookAll = async () => {
    if (!selected.length) { Alert.alert(tr('ar_bulkTitle'), tr('ar_bulkPickSome')); return; }
    setBusy(true); setResult(null);
    try {
      const cropObj = CROP_LIST.find((c) => c.id === crop);
      const r = await bulkBookForFarmers({
        arhtiya: me, centreId, crop, cropName: cropObj?.name || crop, date,
        farmers: selected.map((f) => ({ uid: f.uid, name: f.name, phone: f.phone, quintals: Number(picked[f.uid]) || 1, farmerRegNo: f.farmerRegNo, regSource: f.regSource })),
      });
      setResult(r); setNextRes(null);
      setPicked({});
      await loadPlan();
    } catch (e) {
      Alert.alert(tr('error'), trError(e, 'err.generic'));
    } finally { setBusy(false); }
  };

  // install57 (58b): the ones who did not fit -> try the following open days
  const [nextRes, setNextRes] = useState(null);
  const tryNextDay = async () => {
    const left = (result?.results || []).filter((r) => !r.booking);
    if (!left.length) return;
    setBusy(true);
    try {
      const cropObj = CROP_LIST.find((c) => c.id === crop);
      const leftFarmers = left.map((r) => { const f = farmers.find((x) => x.uid === r.uid) || {}; return { uid: r.uid, name: r.name, phone: f.phone, quintals: r.quintals, farmerRegNo: f.farmerRegNo, regSource: f.regSource }; });
      const r = await bulkBookNextOpenDay({ arhtiya: me, centreId, crop, cropName: cropObj?.name || crop, fromDate: date, farmers: leftFarmers });
      setNextRes(r);
      setResult((old) => ({ ...old, results: old.results.filter((x) => x.booking), failed: r.failed }));
    } catch (e) {
      Alert.alert(tr('error'), trError(e, 'err.generic'));
    } finally { setBusy(false); }
  };

  // group plan by hour
  const byHour = {};
  plan.forEach((b) => { (byHour[b.slotTime] = byHour[b.slotTime] || []).push(b); });
  const hours = Object.keys(byHour).sort();

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle title={tr('ar_bulkTitle')} subtitle={tr('ar_bulkSub')} />

        {/* mandi */}
        <Text style={styles.label}>{tr('mandi')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {centres.map((c) => (
            <TouchableOpacity key={c.id} style={[styles.chip, centreId === c.id && styles.chipOn]} onPress={() => setCentreId(c.id)}>
              <Text style={[styles.chipT, centreId === c.id && styles.chipTOn]}>{centreLabel(c, lang)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* crop */}
        <Text style={styles.label}>{tr('crop')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {CROP_LIST.map((c) => (
            <TouchableOpacity key={c.id} style={[styles.chip, crop === c.id && styles.chipOn]} onPress={() => setCrop(c.id)}>
              <Text style={[styles.chipT, crop === c.id && styles.chipTOn]}>{tr(c.nameKey)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* date */}
        <Text style={styles.label}>{tr('ar_bulkDate')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {days.map((d) => (
            <TouchableOpacity key={d.ds} disabled={!d.open} style={[styles.chip, date === d.ds && styles.chipOn, !d.open && styles.chipOff]} onPress={() => { setDate(d.ds); setResult(null); }}>
              <Text style={[styles.chipT, date === d.ds && styles.chipTOn]}>{d.off === 0 ? tr('today') : d.off === 1 ? tr('tomorrow') : d.ds.slice(5)}</Text>
              {!d.open ? <Text style={styles.chipSub}>{tr('ar_closedDay')}</Text> : null}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* farmers */}
        <Text style={styles.label}>{tr('ar_bulkFarmers', { n: selected.length, q: totalQ })}</Text>
        {!farmers.length ? (
          <TouchableOpacity style={styles.empty} onPress={() => navigation.navigate('MyFarmers')}>
            <Text style={styles.emptyT}>{tr('ar_noFarmersYet')}</Text>
          </TouchableOpacity>
        ) : farmers.map((f) => {
          const on = picked[f.uid] != null;
          return (
            <View key={f.uid} style={[styles.frow, on && styles.frowOn]}>
              <TouchableOpacity style={styles.fmain} onPress={() => toggle(f)}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? Colors.secondary : Colors.subText} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fname}>{f.name}</Text>
                  <Text style={styles.fsub}>{f.phone}{f.farmerRegNo ? ` · ${f.farmerRegNo}` : ''}</Text>
                </View>
              </TouchableOpacity>
              {on ? (
                <View style={styles.qbox}>
                  <TextInput style={styles.qin} keyboardType="numeric" value={picked[f.uid]} onChangeText={(v) => setPicked((p) => ({ ...p, [f.uid]: v.replace(/[^0-9.]/g, '') }))} />
                  <Text style={styles.qunit}>{tr('quintalShort')}</Text>
                </View>
              ) : null}
            </View>
          );
        })}

        <PrimaryButton title={busy ? tr('ar_booking') : tr('ar_bulkGo', { n: selected.length })} onPress={bookAll} disabled={busy || !selected.length} style={{ marginTop: 14 }} />
        <Text style={styles.note}>{tr('ar_bulkNote')}</Text>

        {/* result */}
        {result ? (
          <View style={styles.card}>
            <Text style={styles.cardT}>{tr('ar_bulkResult', { b: result.booked, f: result.failed })}</Text>
            {result.results.map((r) => (
              <View key={r.uid} style={styles.rrow}>
                <Ionicons name={r.booking ? 'checkmark-circle' : 'close-circle'} size={20} color={r.booking ? Colors.secondary : Colors.error} />
                <Text style={styles.rname}>{r.name} · {r.quintals} {tr('quintalShort')}</Text>
                <Text style={[styles.rwhen, !r.booking && { color: Colors.error }]}>
                  {r.booking ? `${tr('ar_arrive')} ${r.booking.slotWindow || r.booking.slotTime}` : (hasKey(String(r.reason)) ? tr(String(r.reason)) : tr('ar_fail_full'))}
                </Text>
              </View>
            ))}
            {result.failed > 0 && !nextRes ? (
              <TouchableOpacity style={styles.nextBtn} onPress={tryNextDay} disabled={busy}>
                <Ionicons name="arrow-forward-circle-outline" size={20} color={Colors.white} />
                <Text style={styles.nextBtnT}>{tr('ar_tryNextDay', { n: result.failed })}</Text>
              </TouchableOpacity>
            ) : null}
            {nextRes ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.cardT}>{tr('ar_nextDayResult', { b: nextRes.booked, f: nextRes.failed })}</Text>
                {nextRes.results.map((r) => (
                  <View key={r.uid} style={styles.rrow}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.secondary} />
                    <Text style={styles.rname}>{r.name} · {r.quintals} {tr('quintalShort')}</Text>
                    <Text style={styles.rwhen}>{r.date.slice(5)} · {r.booking.slotWindow || r.booking.slotTime}</Text>
                  </View>
                ))}
                {nextRes.stillLeft.map((f) => (
                  <View key={f.uid} style={styles.rrow}>
                    <Ionicons name="close-circle" size={20} color={Colors.error} />
                    <Text style={styles.rname}>{f.name} · {f.quintals} {tr('quintalShort')}</Text>
                    <Text style={[styles.rwhen, { color: Colors.error }]}>{tr('ar_noRoom7')}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* day plan */}
        <View style={styles.card}>
          <Text style={styles.cardT}>{tr('ar_dayPlan', { d: date })}</Text>
          {!hours.length ? <Text style={styles.fsub}>{tr('ar_dayPlanEmpty')}</Text> : hours.map((h) => (
            <View key={h} style={styles.hblock}>
              <Text style={styles.hlabel}>{byHour[h][0].slotWindow || h}  ·  {byHour[h].reduce((s, b) => s + (Number(b.approxQuantityQuintals) || 0), 0)} {tr('quintalShort')}</Text>
              {byHour[h].map((b) => (
                <TouchableOpacity key={b.tokenId} style={styles.prow} onPress={() => navigation.navigate('TokenDetail', { tokenId: b.tokenId })}>
                  <Text style={styles.pname}>{b.farmerName}</Text>
                  <Text style={styles.psub}>{b.approxQuantityQuintals} {tr('quintalShort')} · {(hasKey(`st_${b.status}`) ? tr(`st_${b.status}`) : b.status)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '800', color: Colors.navy, marginBottom: 6, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, marginRight: 8, alignItems: 'center' },
  chipOn: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  chipOff: { opacity: 0.45 },
  chipT: { fontSize: 14, color: Colors.text, fontWeight: '700' },
  chipTOn: { color: Colors.white },
  chipSub: { fontSize: 10, color: Colors.error },
  frow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 10, marginBottom: 8 },
  frowOn: { borderColor: Colors.secondary, backgroundColor: '#F1F8F1' },
  fmain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fname: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  fsub: { fontSize: 12, color: Colors.subText, marginTop: 2 },
  qbox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qin: { width: 64, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 6, textAlign: 'center', fontSize: 16, fontWeight: '800', color: Colors.navy, backgroundColor: Colors.white },
  qunit: { fontSize: 12, color: Colors.subText },
  empty: { padding: 16, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border, alignItems: 'center' },
  emptyT: { color: Colors.secondary, fontWeight: '800' },
  note: { fontSize: 12, color: Colors.subText, marginTop: 8, lineHeight: 17 },
  card: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginTop: 16 },
  cardT: { fontSize: 15, fontWeight: '900', color: Colors.navy, marginBottom: 8 },
  rrow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.border },
  rname: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '700' },
  rwhen: { fontSize: 13, color: Colors.secondary, fontWeight: '800' },
  nextBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.secondary, borderRadius: 10, paddingVertical: 12, marginTop: 12 },
  nextBtnT: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  hblock: { marginBottom: 10 },
  hlabel: { fontSize: 13, fontWeight: '900', color: Colors.primary, marginBottom: 4 },
  prow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: Colors.border, marginBottom: 4 },
  pname: { fontSize: 14, color: Colors.navy, fontWeight: '700' },
  psub: { fontSize: 12, color: Colors.subText },
});
