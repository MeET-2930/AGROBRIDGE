/*
 * screens/officer/EngineScreen.js   (install44)
 * ---------------------------------------------------------------
 * Mandi Admin: "Capacity engine" - the visible face of the ML.
 *   1. Today's capacity   set q/h (+/-) vs LEARNED q/h (Model B) + switch
 *   2. Model switches     Model A (declared correction), Model C (no-show)
 *   3. Hour board         booked % (nominal) vs expected %, declared /
 *                         reserved / actual q, vehicles, missed, rebooked,
 *                         close / reopen hour
 *   4. Model health       engine error vs raw declared error, predicted
 *                         vs actual show-rate, model card, Retrain button
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert, Switch, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';
import { getCurrentUserSession } from '../../services/auth';
import { CROP_LIST, cropLabel, centreLabel } from '../../services/centres';
import {
  fetchEngineInsights, saveEngineSettings, setTodayThroughput, setSlotClosed, retrainFromHistory, resetEngineLearning, setPerishableReserve, todayString,
} from '../../services/bookings';

export default function EngineScreen({ navigation }) {
  const { tr, lang, trError } = useLang();
  const [centreId, setCentreId] = useState(null);
  const [crop, setCrop] = useState(CROP_LIST[0]?.id || 'wheat');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showCard, setShowCard] = useState(false);

  const load = useCallback(async (cid = centreId, c = crop) => {
    if (!cid) return;
    try {
      setData(await fetchEngineInsights(cid, todayString(), c));
    } catch (e) {
      Alert.alert(tr('error'), trError(e, 'notRecorded'));
    }
  }, [centreId, crop]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const user = await getCurrentUserSession();
        if (!alive || !user?.centreId) return;
        setCentreId(user.centreId);
        load(user.centreId, crop);
      })();
      return () => { alive = false; };
    }, [crop])
  );

  const act = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      await load();
      if (okMsg) Alert.alert(tr('recorded'), okMsg);
    } catch (e) {
      Alert.alert(tr('error'), trError(e, 'notRecorded'));
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader navigation={navigation} showBack title={tr('en_title')} />
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      </SafeAreaView>
    );
  }

  const st = data.settings;
  const learned = st.learnedThroughput || data.learned;
  const learnedHint = learned?.overall ? `${learned.overall} ± ${learned.band || 0}` : '—';
  const acc = data.accuracy;

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack title={tr('en_title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.centre}>{centreLabel(data.centre.name, lang)} • {data.date}</Text>

        {/* crop picker */}
        <View style={styles.chips}>
          {CROP_LIST.map((c) => (
            <TouchableOpacity key={c.id} style={[styles.chip, crop === c.id && styles.chipOn]} onPress={() => setCrop(c.id)}>
              <Text style={[styles.chipText, crop === c.id && styles.chipTextOn]}>{cropLabel(c, lang)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 1. Today's capacity */}
        <View style={styles.card}>
          <Text style={styles.title}>{tr('en_capTitle')}</Text>
          <Text style={styles.sub}>{tr('en_capSub')}</Text>
          <View style={styles.stepRow}>
            <TouchableOpacity style={styles.stepBtn} disabled={busy} onPress={() => act(() => setTodayThroughput(centreId, crop, data.setThroughput - 25))}>
              <Ionicons name="remove" size={22} color={Colors.primary} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={styles.big}>{data.setThroughput}</Text>
              <Text style={styles.small}>{tr('en_setQh')}</Text>
            </View>
            <TouchableOpacity style={styles.stepBtn} disabled={busy} onPress={() => act(() => setTodayThroughput(centreId, crop, data.setThroughput + 25))}>
              <Ionicons name="add" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.learnedBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.learnedLabel}>{tr('en_learned')}</Text>
              <Text style={styles.learnedValue}>{learnedHint} {tr('en_qh')}</Text>
              <Text style={styles.small}>{tr('en_learnedSub', { d: learned?.days || 0, n: learned?.samples || 0 })}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Switch
                value={st.throughputMode === 'learned'}
                disabled={busy || !learned?.overall}
                onValueChange={(v) => act(() => saveEngineSettings(centreId, { throughputMode: v ? 'learned' : 'set', learnedThroughput: data.learned }))}
              />
              <Text style={styles.small}>{tr('en_useLearned')}</Text>
            </View>
          </View>
          {learned?.perHour && Object.keys(learned.perHour).length ? (
            <Text style={styles.perHour}>
              {Object.keys(learned.perHour).map((h) => `${h}:00 → ${learned.perHour[h]}`).join('   ')}
            </Text>
          ) : (
            <Text style={styles.small}>{tr('en_noLearned')}</Text>
          )}
        </View>

        {/* 1b. Perishable reserve */}
        <View style={styles.card}>
          <Text style={styles.title}>{tr('en_perTitle')}</Text>
          <Text style={styles.sub}>{tr('en_perSub')}</Text>
          <View style={styles.stepRow}>
            <TouchableOpacity style={styles.stepBtn} disabled={busy} onPress={() => act(() => setPerishableReserve(centreId, data.perishableReservePercent - 5))}>
              <Ionicons name="remove" size={22} color={Colors.primary} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={styles.big}>{data.perishableReservePercent}%</Text>
              <Text style={styles.small}>{tr('en_perOfHour')}</Text>
            </View>
            <TouchableOpacity style={styles.stepBtn} disabled={busy} onPress={() => act(() => setPerishableReserve(centreId, data.perishableReservePercent + 5))}>
              <Ionicons name="add" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.small}>{tr('en_perRule')}</Text>
        </View>

        {/* 2. Model switches */}
        <View style={styles.card}>
          <Text style={styles.title}>{tr('en_modelsTitle')}</Text>
          <ToggleRow
            label={tr('en_modelA')} sub={tr('en_modelASub')} value={st.useCorrection !== false} disabled={busy}
            onChange={(v) => act(() => saveEngineSettings(centreId, { useCorrection: v }))}
          />
          <ToggleRow
            label={tr('en_modelC')} sub={tr('en_modelCSub')} value={st.useNoShow !== false} disabled={busy}
            onChange={(v) => act(() => saveEngineSettings(centreId, { useNoShow: v }))}
          />
        </View>

        {/* 3. Hour board */}
        <View style={styles.card}>
          <Text style={styles.title}>{tr('en_boardTitle')}</Text>
          <Text style={styles.sub}>{tr('en_boardSub')}</Text>
          {data.hours.map((h) => (
            <View key={h.slotTime} style={[styles.hourRow, h.closed && styles.hourClosed]}>
              <View style={styles.hourHead}>
                <Text style={styles.hourLabel}>{h.label}</Text>
                <Text style={styles.hourPct}>{h.usedPercent}% {tr('en_booked')} · {h.expectedPercent}% {tr('en_expected')}</Text>
              </View>
              <View style={styles.bar}>
                <View style={[styles.barNominal, { width: `${Math.min(100, h.usedPercent)}%` }]} />
                <View style={[styles.barExpected, { width: `${Math.min(100, h.expectedPercent)}%` }]} />
                <View style={[styles.barBuffer, { left: `${Math.round((h.bookableMinutes / 60) * 100)}%` }]} />
              </View>
              <Text style={styles.hourMeta}>
                {tr('en_declared')} {h.declaredQuintals} · {tr('en_reserved')} {h.reservedQuintals} · {tr('en_actual')} {h.actualQuintals} {tr('quintalShort')}
              </Text>
              <Text style={styles.hourMeta}>
                {tr('en_vehicles')} {h.vehicles} · {tr('en_inside')} {h.inside} · {tr('en_paid')} {h.paid} · {tr('en_missed')} {h.missed} · {tr('en_rebooked')} {h.rebooked} · {h.throughput} {tr('en_qh')}{h.throughputSource !== 'set' ? '*' : ''}
              </Text>
              <TouchableOpacity
                style={[styles.closeBtn, h.closed && styles.reopenBtn]} disabled={busy}
                onPress={() => act(() => setSlotClosed(centreId, data.date, h.slotTime, !h.closed))}
              >
                <Text style={[styles.closeBtnText, h.closed && { color: Colors.primary }]}>{h.closed ? tr('en_reopen') : tr('en_close')}</Text>
              </TouchableOpacity>
            </View>
          ))}
          <Text style={styles.small}>{tr('en_legend')}</Text>
        </View>

        {/* 4. Model health */}
        <View style={styles.card}>
          <Text style={styles.title}>{tr('en_healthTitle')}</Text>
          <Row label={tr('en_errDeclared')} value={acc.declaredErrorPercent != null ? `${acc.declaredErrorPercent}%` : '—'} />
          <Row label={tr('en_errEngine')} value={acc.engineErrorPercent != null ? `${acc.engineErrorPercent}%` : tr('en_needData')} />
          <Row label={tr('en_showPred')} value={acc.predictedShowPercent != null ? `${acc.predictedShowPercent}%` : '—'} />
          <Row label={tr('en_showReal')} value={acc.actualShowPercent != null ? `${acc.actualShowPercent}%` : '—'} />
          <Row label={tr('en_samples')} value={`${acc.weighedCount} / ${acc.closedCount}`} />

          <TouchableOpacity
            style={styles.retrain} disabled={busy}
            onPress={() => act(() => retrainFromHistory(centreId), tr('en_retrained'))}
          >
            {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.retrainText}>{tr('en_retrain')}</Text>}
          </TouchableOpacity>
          <Text style={styles.small}>{tr('en_retrainSub')}</Text>

          <TouchableOpacity
            style={styles.resetBtn} disabled={busy}
            onPress={() => Alert.alert(tr('en_reset'), tr('en_resetConfirm'), [
              { text: tr('cancel'), style: 'cancel' },
              { text: tr('en_reset'), style: 'destructive', onPress: () => act(() => resetEngineLearning(centreId), tr('en_resetDone')) },
            ])}
          >
            <Text style={styles.resetText}>{tr('en_reset')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowCard((v) => !v)} style={styles.cardToggle}>
            <Text style={styles.cardToggleText}>{tr('en_modelCard')}</Text>
            <Ionicons name={showCard ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.primary} />
          </TouchableOpacity>
          {showCard ? (
            <View style={styles.modelCard}>
              <Text style={styles.mono}>{tr('en_trainedOn')}: {st.localParams?.noshow ? tr('en_thisMandi') : data.model.trainedOn} ({st.localParams?.samples || data.model.samples} {tr('en_rows')})</Text>
              <Text style={styles.mono}>Model A · Bayesian shrinkage · k = {st.localParams?.correction?.k ?? data.model.correction.k} · prior {JSON.stringify(st.localParams?.correction?.cropPrior || data.model.correction.cropPrior)}</Text>
              <Text style={styles.mono}>Model B · EWMA · α = {learned?.alpha ?? '—'} · MAE {learned?.mae ?? '—'} q/h</Text>
              <Text style={styles.mono}>Model C · logistic regression · AUC {data.model.noshow.auc} · acc {st.localParams?.noshow?.accuracy ?? data.model.noshow.accuracy}</Text>
              <Text style={styles.mono}>{tr('en_weights')}: {Object.entries(st.localParams?.noshow?.weights || data.model.noshow.weights).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ToggleRow({ label, sub, value, onChange, disabled }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={styles.rowValue}>{label}</Text>
        <Text style={styles.small}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  centre: { fontWeight: '800', color: Colors.navy, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  chipOn: { borderColor: Colors.primary, backgroundColor: Colors.accent },
  chipText: { color: Colors.subText, fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: Colors.primary },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  title: { fontWeight: '800', color: Colors.navy, fontSize: 15, marginBottom: 4 },
  sub: { color: Colors.subText, fontSize: 12, marginBottom: 10, lineHeight: 17 },
  small: { color: Colors.subText, fontSize: 11, marginTop: 4, lineHeight: 15 },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  big: { fontSize: 34, fontWeight: '900', color: Colors.navy },
  learnedBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 10, padding: 12, marginTop: 10 },
  learnedLabel: { color: Colors.subText, fontWeight: '700', fontSize: 12 },
  learnedValue: { color: Colors.navy, fontWeight: '900', fontSize: 20 },
  perHour: { color: Colors.subText, fontSize: 11, marginTop: 8, lineHeight: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  hourRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  hourClosed: { backgroundColor: '#FEE2E2', marginHorizontal: -16, paddingHorizontal: 16 },
  hourHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hourLabel: { fontWeight: '800', color: Colors.navy, fontSize: 13 },
  hourPct: { color: Colors.subText, fontSize: 11, fontWeight: '700' },
  bar: { height: 10, backgroundColor: '#E5E7EB', borderRadius: 5, marginTop: 6, overflow: 'hidden' },
  barNominal: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#BFDBFE', borderRadius: 5 },
  barExpected: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#2563EB', borderRadius: 5 },
  barBuffer: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#DC2626' },
  hourMeta: { color: Colors.subText, fontSize: 11, marginTop: 4 },
  closeBtn: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: Colors.error },
  reopenBtn: { borderColor: Colors.primary },
  closeBtnText: { color: Colors.error, fontWeight: '800', fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rowLabel: { color: Colors.subText, fontSize: 13, flex: 1 },
  rowValue: { color: Colors.navy, fontWeight: '800', fontSize: 13 },
  retrain: { marginTop: 10, backgroundColor: Colors.primary, borderRadius: 10, height: 44, alignItems: 'center', justifyContent: 'center' },
  retrainText: { color: Colors.white, fontWeight: '800' },
  resetBtn: { marginTop: 12, height: 42, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.error, alignItems: 'center', justifyContent: 'center' },
  resetText: { color: Colors.error, fontWeight: '800' },
  cardToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, marginTop: 6 },
  cardToggleText: { color: Colors.primary, fontWeight: '800', fontSize: 13 },
  modelCard: { backgroundColor: Colors.background, borderRadius: 8, padding: 10 },
  mono: { fontSize: 11, color: Colors.navy, marginBottom: 4, lineHeight: 15 },
});
