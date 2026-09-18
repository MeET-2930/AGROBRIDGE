/*
 * screens/officer/WeighingScreen.js  (install43)
 * ---------------------------------------------------------------
 * Weighbridge: ONE vehicle at a time. Every vehicle admitted at the
 * gate gets its own gross/tare card; the token total is the sum.
 * Declared vs actual is shown per vehicle and for the whole token.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { recordWeighing, yardRef } from '../../services/bookings';

import { useLang } from '../../i18n/LanguageContext';
import { gradeLabel } from '../../services/centres';

export default function WeighingScreen({ navigation, route }) {
  const { tr, lang, trError } = useLang();
  const { token } = route.params || {};

  const declared = Number(token?.declaredQuintals || token?.approxQuantityQuintals) || 0;
  const initial = (token?.vehicles?.length ? token.vehicles : [{ serial: 1, plate: token?.vehicleNumber || '' }])
    .map((v, i) => ({
      serial: v.serial || i + 1,
      plate: v.plate || '',
      gross: v.grossWeightQuintals != null ? String(v.grossWeightQuintals) : '',
      tare: v.tareWeightQuintals != null ? String(v.tareWeightQuintals) : '0',
    }));

  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);

  const setField = (i, field, value) =>
    setRows((list) => list.map((r, k) => (k === i ? { ...r, [field]: value } : r)));

  const netOf = (r) => Math.round(((parseFloat(r.gross) || 0) - (parseFloat(r.tare) || 0)) * 100) / 100;
  const total = Math.round(rows.reduce((s, r) => s + Math.max(0, netOf(r)), 0) * 100) / 100;
  const variance = declared > 0 ? Math.round(((total - declared) / declared) * 100) : 0;
  const bigVariance = declared > 0 && Math.abs(variance) > 20;
  const perVehicleDeclared = rows.length ? Math.round((declared / rows.length) * 10) / 10 : declared;
  const allWeighed = rows.every((r) => netOf(r) > 0);

  const submit = async () => {
    const bad = rows.findIndex((r) => netOf(r) <= 0);
    if (bad >= 0) {
      Alert.alert(tr('gs_vehicleN', { n: bad + 1 }), tr('wg_netZero'));
      return;
    }
    setBusy(true);
    try {
      await recordWeighing(token.tokenId, {
        vehicles: rows.map((r) => ({
          serial: r.serial,
          plate: r.plate,
          grossWeightQuintals: parseFloat(r.gross) || 0,
          tareWeightQuintals: parseFloat(r.tare) || 0,
        })),
      });
      Alert.alert(tr('recorded'), tr('wg_recordedSub'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert(tr('error'), trError(error, 'notRecorded'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle
          title={tr('wg_title')}
          subtitle={tr('tokenAndName', { t: token ? `#${yardRef(token)}` : '', n: token?.farmerName || '' })}
        />

        <View style={styles.info}>
          <Text style={styles.infoText}>{tr('wg_declared', { q: declared })}</Text>
          <Text style={styles.infoText}>
            {tr('wg_gradeLine', { g: token?.grade ? gradeLabel(token.grade, lang) : '—' })}
          </Text>
          <Text style={styles.infoText}>{tr('gs_nVehicles', { n: rows.length })}</Text>
        </View>

        {rows.map((r, i) => {
          const net = netOf(r);
          return (
            <View key={r.serial} style={styles.vehicleCard}>
              <View style={styles.vehicleHead}>
                <Text style={styles.vehicleTitle}>{tr('gs_vehicleN', { n: r.serial })}</Text>
                <Text style={styles.plate}>{r.plate || '—'}</Text>
              </View>

              <View style={styles.pair}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{tr('wg_gross')}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={r.gross}
                    onChangeText={(v) => setField(i, 'gross', v)}
                    placeholder="0"
                    placeholderTextColor="#999"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{tr('wg_tare')}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={r.tare}
                    onChangeText={(v) => setField(i, 'tare', v)}
                    placeholder="0"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              <View style={styles.netRow}>
                <Text style={styles.netSmallLabel}>{tr('wg_net')}</Text>
                <Text style={[styles.netSmall, net <= 0 && { color: Colors.error }]}>{net > 0 ? net : '—'} {tr('quintalShort')}</Text>
                {rows.length > 1 && declared > 0 ? (
                  <Text style={styles.netSmallHint}>{tr('wg_perVehicleDeclared', { q: perVehicleDeclared })}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
        <Text style={styles.hint}>{tr('wg_tareHint')}</Text>

        <View style={styles.netBox}>
          <Text style={styles.netLabel}>{tr('wg_total')}</Text>
          <Text style={styles.netValue}>{total} {tr('quintal')}</Text>
          {declared > 0 ? (
            <Text style={[styles.variance, bigVariance && styles.varianceWarn]}>
              {tr('wg_variance', { v: `${variance > 0 ? '+' : ''}${variance}` })}
            </Text>
          ) : null}
        </View>

        {bigVariance ? <Text style={styles.warn}>{tr('wg_warn')}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title={tr('wg_submit')}
          loading={busy}
          disabled={!allWeighed}
          onPress={submit}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 30 },
  info: { backgroundColor: Colors.accent, borderRadius: 10, padding: 12, marginBottom: 8 },
  infoText: { color: Colors.navy, fontWeight: '700', fontSize: 13 },
  vehicleCard: { backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, padding: 12, marginTop: 12 },
  vehicleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vehicleTitle: { fontWeight: '900', color: Colors.navy, fontSize: 14 },
  plate: { fontWeight: '800', color: Colors.primary, fontSize: 14, letterSpacing: 1 },
  pair: { flexDirection: 'row', gap: 10 },
  label: { fontWeight: '700', color: Colors.navy, marginTop: 10, marginBottom: 6, fontSize: 12 },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  netRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10 },
  netSmallLabel: { color: Colors.subText, fontWeight: '700', fontSize: 12 },
  netSmall: { color: Colors.navy, fontWeight: '900', fontSize: 16 },
  netSmallHint: { color: Colors.subText, fontSize: 11, marginLeft: 'auto' },
  hint: { fontSize: 12, color: Colors.subText, marginTop: 8 },
  netBox: { marginTop: 18, backgroundColor: Colors.navy, borderRadius: 14, padding: 18, alignItems: 'center' },
  netLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700' },
  netValue: { color: Colors.white, fontSize: 32, fontWeight: '900', marginTop: 4 },
  variance: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 6, fontWeight: '700' },
  varianceWarn: { color: '#FFD54F' },
  warn: { marginTop: 12, backgroundColor: '#FFF3E0', color: '#E65100', padding: 12, borderRadius: 10, fontSize: 13, fontWeight: '700' },
  footer: { padding: 20, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
});
