/*
 * screens/officer/EngineScreen.js   (install44, yard card install52)
 * ---------------------------------------------------------------
 * Mandi Admin: "Capacity engine" - the visible face of the ML.
 *   1. Today's capacity   set q/h (+/-) vs LEARNED q/h (Model B) + switch
 *   2. Model switches     Model A (declared correction), Model C (no-show)
 *   3. Hour board         -> moved to HourBoardScreen (install49)
 *   4. Model health       engine error vs raw declared error, predicted
 *                         vs actual show-rate, model card, Retrain button
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert, Switch, ActivityIndicator, TextInput,
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
  saveYardState, recordLifted, declareYardIncident, saveTransferSettings,
} from '../../services/bookings';

export default function EngineScreen({ navigation }) {
  const { tr, lang, trError } = useLang();
  const [centreId, setCentreId] = useState(null);
  const [crop, setCrop] = useState(CROP_LIST[0]?.id || 'wheat');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showCard, setShowCard] = useState(false);
  // install49: typed values (admin can type a number, not only +/-)
  const [qhText, setQhText] = useState('');
  const [perText, setPerText] = useState('');
  // install52: yard inputs (typed)
  const [yd, setYd] = useState({ floorCapacityQ: '', floorUsedQ: '', bagsInStock: '', labourTeams: '', labourTeamsNormal: '' });
  const [liftText, setLiftText] = useState('');
  useEffect(() => {
    if (data) { setQhText(String(data.setThroughput)); setPerText(String(data.perishableReservePercent)); }
    if (data?.yard?.state) {
      const y = data.yard.state;
      setYd({
        floorCapacityQ: String(y.floorCapacityQ ?? ''), floorUsedQ: String(Math.round(y.floorUsedQ ?? 0)),
        bagsInStock: y.bagsInStock == null ? '' : String(y.bagsInStock),
        labourTeams: y.labourTeams == null ? '' : String(y.labourTeams), labourTeamsNormal: y.labourTeamsNormal == null ? '' : String(y.labourTeamsNormal),
      });
    }
  }, [data?.setThroughput, data?.perishableReservePercent, data?.yard?.state?.updatedAt]);
  const numOrNull = (t) => { const n = parseInt(String(t).replace(/[^0-9]/g, ''), 10); return Number.isNaN(n) ? null : n; };
  const clampInt = (txt, lo, hi) => {
    const n = parseInt(String(txt).replace(/[^0-9]/g, ''), 10);
    if (Number.isNaN(n)) return null;
    return Math.max(lo, Math.min(hi, n));
  };

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
              <TextInput
                style={styles.bigInput}
                value={qhText}
                onChangeText={(t) => setQhText(t.replace(/[^0-9]/g, '').slice(0, 5))}
                onBlur={() => { const n = clampInt(qhText, 25, 20000); if (n != null && n !== data.setThroughput) act(() => setTodayThroughput(centreId, crop, n)); else setQhText(String(data.setThroughput)); }}
                keyboardType="number-pad"
                returnKeyType="done"
                selectTextOnFocus
              />
              <Text style={styles.small}>{tr('en_setQh')} · {tr('en_typeHint')}</Text>
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
            <View style={{ marginTop: 8 }}>
              {(learned.hours || Object.keys(learned.perHour).map(Number)).map((h) => {
                const v = learned.perHour[h];
                const busy = learned.busyDays?.[h] || 0;
                return (
                  <View key={h} style={styles.lhRow}>
                    <Text style={styles.lhHour}>{String(h).padStart(2, '0')}:00</Text>
                    <View style={styles.lhBarWrap}>
                      <View style={[styles.lhBar, { width: `${Math.min(100, Math.round(((v || data.setThroughput) / Math.max(data.setThroughput, ...Object.values(learned.perHour))) * 100))}%`, backgroundColor: v ? '#2563EB' : '#CBD5E1' }]} />
                    </View>
                    <Text style={[styles.lhVal, !v && { color: Colors.subText }]}>{v ? `${v}` : `${data.setThroughput}*`}</Text>
                    <Text style={styles.lhDays}>{tr('en_busyDays', { n: busy })}</Text>
                  </View>
                );
              })}
              <Text style={styles.small}>{tr('en_learnedLegend')}</Text>
            </View>
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
            <View style={{ alignItems: 'center', flex: 1, flexDirection: 'row', justifyContent: 'center' }}>
              <TextInput
                style={[styles.bigInput, { minWidth: 70 }]}
                value={perText}
                onChangeText={(t) => setPerText(t.replace(/[^0-9]/g, '').slice(0, 2))}
                onBlur={() => { const n = clampInt(perText, 0, 60); if (n != null && n !== data.perishableReservePercent) act(() => setPerishableReserve(centreId, n)); else setPerText(String(data.perishableReservePercent)); }}
                keyboardType="number-pad"
                returnKeyType="done"
                selectTextOnFocus
              />
              <Text style={styles.big}>%</Text>
            </View>
            <TouchableOpacity style={styles.stepBtn} disabled={busy} onPress={() => act(() => setPerishableReserve(centreId, data.perishableReservePercent + 5))}>
              <Ionicons name="add" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.small}>{tr('en_perRule')}</Text>
        </View>

        {/* 1c. install52: YARD - floor / bags / labour (root causes R6 + R7) */}
        {data.yard ? (() => {
          const yf = data.yard.factors;
          const inc = data.yard.incident;
          const proj = data.yard.projection;
          const reasonTxt = (data.yard.reasons || []).map((r) => tr(`yd_reason_${r}`)).join(', ') || tr('yd_reason_floor');
          const pctColor = yf.floorUsedPercent >= 85 ? '#DC2626' : yf.floorUsedPercent >= 60 ? '#D97706' : '#16A34A';
          return (
            <View style={[styles.card, inc?.active && { borderColor: '#DC2626' }]}>
              <Text style={styles.title}>{tr('yd_title')}</Text>
              <Text style={styles.sub}>{tr('yd_sub')}</Text>

              <View style={styles.ydStatusRow}>
                <View style={[styles.ydPill, { backgroundColor: pctColor }]}><Text style={styles.ydPillText}>{tr('yd_floorNow', { p: Math.round(yf.floorUsedPercent), free: yf.floorFreeQ })}</Text></View>
              </View>
              <View style={styles.ydBarWrap}><View style={[styles.ydBar, { width: `${Math.min(100, yf.floorUsedPercent)}%`, backgroundColor: pctColor }]} /><View style={[styles.ydMark, { left: '60%' }]} /><View style={[styles.ydMark, { left: '85%', backgroundColor: '#DC2626' }]} /></View>
              <Text style={styles.small}>{tr('yd_labourNow', { f: yf.labourFactor })}{yf.bagCapQ != null ? ` · ${yf.bagCapQ > 0 ? tr('yd_bagsNow', { q: yf.bagCapQ }) : tr('yd_bagsOut')}` : ''}</Text>

              <View style={styles.ydGrid}>
                <YdField label={tr('yd_floorCap')} value={yd.floorCapacityQ} onChange={(v) => setYd({ ...yd, floorCapacityQ: v })} />
                <YdField label={tr('yd_floorUsed')} value={yd.floorUsedQ} onChange={(v) => setYd({ ...yd, floorUsedQ: v })} />
                <YdField label={tr('yd_bags')} value={yd.bagsInStock} onChange={(v) => setYd({ ...yd, bagsInStock: v })} placeholder="—" />
                <View style={{ flexDirection: 'row', flex: 1, minWidth: 150 }}>
                  <YdField label={tr('yd_labour')} value={yd.labourTeams} onChange={(v) => setYd({ ...yd, labourTeams: v })} placeholder="—" style={{ flex: 1 }} />
                  <Text style={styles.ydSlash}>/</Text>
                  <YdField label=" " value={yd.labourTeamsNormal} onChange={(v) => setYd({ ...yd, labourTeamsNormal: v })} placeholder="—" style={{ flex: 1 }} />
                </View>
              </View>
              <TouchableOpacity style={styles.retrain} disabled={busy} onPress={() => act(() => saveYardState(centreId, {
                floorCapacityQ: numOrNull(yd.floorCapacityQ), floorUsedQ: numOrNull(yd.floorUsedQ), bagsInStock: numOrNull(yd.bagsInStock),
                labourTeams: numOrNull(yd.labourTeams), labourTeamsNormal: numOrNull(yd.labourTeamsNormal),
              }), tr('recorded'))}>
                <Text style={styles.retrainText}>{tr('yd_save')}</Text>
              </TouchableOpacity>

              <View style={[styles.stepRow, { marginTop: 14 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ydLabel}>{tr('yd_lifted')}</Text>
                  <TextInput style={styles.ydInput} value={liftText} onChangeText={(t) => setLiftText(t.replace(/[^0-9]/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="0" />
                </View>
                <TouchableOpacity style={[styles.retrain, { marginTop: 18, marginLeft: 10, paddingHorizontal: 14 }]} disabled={busy || !liftText} onPress={() => act(async () => { await recordLifted(centreId, liftText); setLiftText(''); }, tr('recorded'))}>
                  <Text style={styles.retrainText}>{tr('yd_liftedBtn')}</Text>
                </TouchableOpacity>
              </View>

              {/* projection */}
              <Text style={[styles.title, { marginTop: 14, fontSize: 13 }]}>{tr('yd_projTitle')}</Text>
              <Text style={styles.small}>{tr('yd_projHead')}</Text>
              {proj.rows.map((r) => (
                <View key={r.dayOffset} style={styles.ydProjRow}>
                  <Text style={styles.ydProjDay}>{r.dayOffset === 0 ? tr('yd_day0') : tr('yd_dayN', { d: r.dayOffset })}</Text>
                  <Text style={[styles.ydProjCell, { color: r.floorStartPercent >= 85 ? '#DC2626' : r.floorStartPercent >= 60 ? '#D97706' : Colors.navy }]}>{r.floorStartPercent}%</Text>
                  <Text style={styles.ydProjCell}>{r.bookedQ} q</Text>
                  <Text style={styles.ydProjCell}>−{r.liftQ} q</Text>
                  <View style={[styles.ydProjBarWrap]}><View style={[styles.ydProjBar, { width: `${Math.round(r.factor * 100)}%`, backgroundColor: r.factor >= 0.99 ? '#16A34A' : r.factor > 0 ? '#D97706' : '#DC2626' }]} /></View>
                  <Text style={styles.ydProjPct}>{Math.round(r.factor * 100)}%</Text>
                </View>
              ))}
              <Text style={styles.small}>{proj.recoveryDays > 0 ? tr('yd_recovery', { d: proj.recoveryDays }) : tr('yd_recoveryNow')}</Text>
              <Text style={styles.small}>{tr('yd_projRule')}</Text>

              {/* incident */}
              <View style={[styles.ydInc, inc?.active ? styles.ydIncOn : null]}>
                <Text style={[styles.rowValue, inc?.active && { color: '#991B1B' }]}>{inc?.active ? tr('yd_incOn', { r: reasonTxt }) : tr('yd_incOff')}</Text>
                {inc?.active && inc.auto ? <Text style={styles.small}>{tr('yd_incAuto')}</Text> : null}
                {inc?.active ? (
                  <TouchableOpacity style={[styles.retrain, { marginTop: 8 }]} disabled={busy} onPress={() => act(() => declareYardIncident(centreId, false, inc.reason), tr('recorded'))}>
                    <Text style={styles.retrainText}>{tr('yd_clear')}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.resetBtn} disabled={busy} onPress={() => Alert.alert(tr('yd_declare'), tr('yd_declareConfirm'), [
                    { text: tr('no'), style: 'cancel' },
                    { text: tr('yes'), style: 'destructive', onPress: () => act(() => declareYardIncident(centreId, true, 'floor'), tr('dl_yardDone')) },
                  ])}>
                    <Text style={styles.resetText}>{tr('yd_declare')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })() : null}

        {/* 1d. install53: SPARE capacity - walk-ins "Now" + cross-centre transfers */}
        {data.spare ? (() => {
          const sp = data.spare; const d = sp.day; const tf = data.transfer;
          const cur = d.hours[d.nowIdx];
          return (
            <View style={styles.card}>
              <Text style={styles.title}>{tr('sp_title')}</Text>
              <Text style={styles.sub}>{tr('sp_sub')}</Text>
              <Text style={styles.learnedValue}>{tr('sp_now', { m: Math.round(d.nowSpareMinutes), q: cur?.spareQuintals ?? 0 })}</Text>
              <Text style={styles.small}>{tr('sp_later', { m: Math.round(d.laterSpareMinutes) })}{sp.utilisationPercent != null ? ` · ${tr('sp_util', { p: sp.utilisationPercent })}` : ''}</Text>
              <Text style={styles.small}>{tr('sp_used', { w: sp.used.walkIns, t: sp.used.transfersIn, q: sp.used.spareQuintals })}</Text>
              <Text style={[styles.small, { fontWeight: '800', color: sp.offer.minutes > 0 ? '#166534' : Colors.subText }]}>
                {sp.offer.minutes > 0 ? tr('sp_offer', { m: sp.offer.minutes }) : tr('sp_offerNone', { r: tr(`sp_r_${sp.offer.reason || 'tooLittle'}`) })}
              </Text>
              <Text style={[styles.small, { marginTop: 8 }]}>{tr('sp_hourHead')}</Text>
              {d.hours.map((h, i) => (
                <View key={h.slotTime} style={styles.lhRow}>
                  <Text style={[styles.lhHour, i === d.nowIdx && { color: '#166534' }]}>{h.slotTime}</Text>
                  <Text style={styles.spCell}>{Math.round(h.bookedMinutes)}</Text>
                  <Text style={styles.spCell}>{Math.round(h.arrivedMinutes)}</Text>
                  <Text style={styles.spCell}>{Math.round(h.expectedStillMinutes)}</Text>
                  <View style={styles.lhBarWrap}><View style={[styles.lhBar, { width: `${Math.min(100, Math.max(0, h.spareMinutes) / 60 * 100)}%`, backgroundColor: h.state === 'closed' ? '#CBD5E1' : '#16A34A' }]} /></View>
                  <Text style={[styles.lhVal, { color: h.spareMinutes < 0 ? '#DC2626' : '#166534' }]}>{Math.round(h.spareMinutes)}</Text>
                </View>
              ))}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.rowValue}>{tr('sp_accept')}</Text>
                  <Text style={styles.small}>{tr('sp_share')}: {tf.maxTransferSharePercent}%</Text>
                </View>
                <Switch value={tf.acceptTransfers} disabled={busy} onValueChange={(v) => act(() => saveTransferSettings(centreId, { acceptTransfers: v }))} />
              </View>
              <View style={styles.stepRow}>
                <TouchableOpacity style={styles.stepBtn} disabled={busy} onPress={() => act(() => saveTransferSettings(centreId, { maxTransferSharePercent: tf.maxTransferSharePercent - 10 }))}><Ionicons name="remove" size={22} color={Colors.primary} /></TouchableOpacity>
                <Text style={[styles.big, { flex: 1, textAlign: 'center' }]}>{tf.maxTransferSharePercent}%</Text>
                <TouchableOpacity style={styles.stepBtn} disabled={busy} onPress={() => act(() => saveTransferSettings(centreId, { maxTransferSharePercent: tf.maxTransferSharePercent + 10 }))}><Ionicons name="add" size={22} color={Colors.primary} /></TouchableOpacity>
              </View>
              <Text style={styles.small}>{tr('sp_rule')}</Text>
            </View>
          );
        })() : null}

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

        {/* 3. Hour-by-hour board moved to its own screen (install49) */}
        <TouchableOpacity style={styles.linkCard} onPress={() => navigation.navigate('HourBoard', { crop })}>
          <Ionicons name="time-outline" size={22} color={Colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.title}>{tr('en_boardTitle')}</Text>
            <Text style={styles.small}>{tr('hb_openHint')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.subText} />
        </TouchableOpacity>

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

function YdField({ label, value, onChange, placeholder = '', style }) {
  return (
    <View style={[{ flex: 1, minWidth: 140, marginRight: 8, marginBottom: 8 }, style]}>
      <Text style={styles.ydLabel}>{label}</Text>
      <TextInput
        style={styles.ydInput}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, 6))}
        keyboardType="number-pad"
        placeholder={placeholder}
        placeholderTextColor={Colors.subText}
        returnKeyType="done"
        selectTextOnFocus
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  ydStatusRow: { flexDirection: 'row', marginTop: 4 },
  spCell: { width: 34, fontSize: 11, color: Colors.navy, textAlign: 'right' },
  ydPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  ydPillText: { color: Colors.white, fontWeight: '800', fontSize: 12 },
  ydBarWrap: { height: 10, backgroundColor: '#E5E7EB', borderRadius: 5, marginTop: 8, overflow: 'hidden' },
  ydBar: { height: 10, borderRadius: 5 },
  ydMark: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#D97706' },
  ydGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  ydLabel: { color: Colors.subText, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  ydInput: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, height: 40, paddingHorizontal: 10, color: Colors.navy, fontWeight: '800' },
  ydSlash: { alignSelf: 'flex-end', marginBottom: 18, marginHorizontal: 4, color: Colors.subText, fontWeight: '800' },
  ydProjRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  ydProjDay: { width: 44, fontSize: 11, fontWeight: '700', color: Colors.navy },
  ydProjCell: { width: 52, fontSize: 11, color: Colors.navy, textAlign: 'right' },
  ydProjBarWrap: { flex: 1, height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginHorizontal: 6 },
  ydProjBar: { height: 8, borderRadius: 4 },
  ydProjPct: { width: 36, fontSize: 11, fontWeight: '800', color: Colors.navy, textAlign: 'right' },
  ydInc: { marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  ydIncOn: { backgroundColor: '#FEE2E2', marginHorizontal: -16, paddingHorizontal: 16, paddingBottom: 12, borderRadius: 0 },
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
  bigInput: { fontSize: 32, fontWeight: '900', color: Colors.navy, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: Colors.primary, minWidth: 110, paddingVertical: 2 },
  linkCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.primary, marginBottom: 14 },
  learnedBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 10, padding: 12, marginTop: 10 },
  learnedLabel: { color: Colors.subText, fontWeight: '700', fontSize: 12 },
  learnedValue: { color: Colors.navy, fontWeight: '900', fontSize: 20 },
  perHour: { color: Colors.subText, fontSize: 11, marginTop: 8, lineHeight: 16 },
  lhRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  lhHour: { width: 44, fontSize: 12, fontWeight: '700', color: Colors.navy },
  lhBarWrap: { flex: 1, height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginHorizontal: 6 },
  lhBar: { height: 8, borderRadius: 4 },
  lhVal: { width: 44, fontSize: 12, fontWeight: '800', color: '#1D4ED8', textAlign: 'right' },
  lhDays: { width: 56, fontSize: 10, color: Colors.subText, textAlign: 'right' },
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
