/*
 * screens/farmer/QuantityScreen.js  (install41, install55)
 * ---------------------------------------------------------------
 * Step 3 of booking: "about how many quintals are you bringing?"
 *
 * install41 moved this BEFORE the slot screen. The mandi's capacity
 * is measured in quintals per hour, so the slot list can only say
 * "this hour has room for YOUR load" once the load is known.
 *
 * install55 adds the government-rail bits that belong to THIS step:
 *   - registration number (MFMB / Anaaj Kharid / e-Uparjan) - fetched
 *     from the DEMO adapter (services/govRail.js) or typed by hand
 *   - area ceiling: registered acres x typical yield x 1.2. Over it
 *     -> a WARNING, never a block (the officer decides at the yard)
 *   - who will come to the gate: the farmer or one of his nominees
 * An ARHTIYA booking for a farmer passes `forFarmer` in the params;
 * the same screen then works on that farmer's profile.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { centreLabel } from '../../services/centres';
import { getCurrentUserSession, updateFarmerProfile } from '../../services/auth';
import { getFarmerRecord, areaCeilingQuintals, isValidRegNo, RAIL_MODE } from '../../services/govRail';
import { useLang } from '../../i18n/LanguageContext';

const QUICK = [5, 10, 20, 50, 100];

export default function QuantityScreen({ navigation, route }) {
  const { tr, lang, trError } = useLang();
  const { crop, centre, forFarmer = null } = route.params || {};

  const [quantity, setQuantity] = useState(10);
  const [profile, setProfile] = useState(null);     // the farmer whose booking this is
  const [regNo, setRegNo] = useState('');
  const [fetching, setFetching] = useState(false);
  const [record, setRecord] = useState(null);       // what the (demo) rail returned
  const [nominee, setNominee] = useState('self');

  useEffect(() => {
    (async () => {
      const me = await getCurrentUserSession();
      const p = forFarmer || me;
      setProfile(p);
      setRegNo(p?.farmerRegNo || '');
      if (p?.registeredAcres && Object.keys(p.registeredAcres).length) {
        setRecord({ source: p.regSource || 'saved', registeredAcres: p.registeredAcres, bankVerified: true, bankLast4: p.bankLast4 || '' });
      }
    })();
  }, [forFarmer?.uid]);

  const change = (delta) => setQuantity((q) => Math.max(1, Math.min(9999, (Number(q) || 0) + delta)));

  const ceiling = record ? areaCeilingQuintals(record.registeredAcres, crop?.id, centre?.yieldTable) : null;
  const overCeiling = ceiling != null && Number(quantity) > ceiling;
  const acres = record?.registeredAcres?.[crop?.id];

  const fetchFromRail = async () => {
    if (!isValidRegNo(regNo)) { Alert.alert(tr('qty_regNo'), tr('err.badRegNo')); return; }
    setFetching(true);
    try {
      const rec = await getFarmerRecord(regNo, { name: profile?.name });
      setRecord(rec);
      // remember it on the farmer's profile (own booking only - the arhtiya cannot edit a farmer's profile)
      if (!forFarmer) await updateFarmerProfile({ farmerRegNo: rec.regNo, regSource: rec.rail, registeredAcres: rec.registeredAcres, bankLast4: rec.bankLast4 }).catch(() => {});
    } catch (e) {
      Alert.alert(tr('qty_regNo'), trError(e, 'pleaseRetry'));
    } finally {
      setFetching(false);
    }
  };

  const next = () => {
    if (!crop?.id || !centre?.id) { navigation.goBack(); return; }
    if (!quantity || quantity <= 0) { Alert.alert(tr('quantity'), tr('ss_enterQty')); return; }
    const extra = {
      farmerRegNo: regNo ? String(regNo).trim().toUpperCase() : null,
      regSource: record?.source === 'demo' ? record.rail : regNo ? 'manual' : null,
      ceilingQ: ceiling,
      ceilingWarned: overCeiling,
      nomineeUsed: nominee === 'self' ? null : nominee,
    };
    const go = () => navigation.navigate('SlotSelection', { crop, centre, quantity: Number(quantity), forFarmer, extra });
    if (overCeiling) {
      Alert.alert(tr('qty_ceilTitle'), tr('qty_ceilBody', { q: quantity, c: ceiling, a: acres }), [
        { text: tr('qty_ceilFix'), style: 'cancel' },
        { text: tr('qty_ceilGo'), onPress: go },
      ]);
      return;
    }
    go();
  };

  const nominees = Array.isArray(profile?.nominees) ? profile.nominees : [];

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack audioKey="audio_qty" />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle title={tr('qty_title')} subtitle={forFarmer ? tr('qty_forFarmer', { n: forFarmer.name }) : tr('qty_sub')} />

        {/* What has been chosen so far - short, so nothing is a surprise on the token */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{tr('qty_summary')}</Text>
          <Row label={tr('crop')} value={crop?.nameKey ? tr(crop.nameKey) : crop?.name || '-'} />
          <Row label={tr('mandi')} value={centreLabel(centre, lang) || '-'} last />
        </View>

        {/* The big number */}
        <View style={styles.quantityBox}>
          <View style={styles.quantityInputRow}>
            <TouchableOpacity style={styles.quantityButton} onPress={() => change(-1)} onLongPress={() => change(-5)}>
              <Text style={styles.quantityButtonText}>−</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.quantityValue}
              value={String(quantity)}
              keyboardType="numeric"
              maxLength={4}
              selectTextOnFocus
              onChangeText={(v) => {
                const n = parseInt(String(v).replace(/\D/g, ''), 10);
                setQuantity(Number.isNaN(n) ? '' : Math.min(9999, n));
              }}
              onBlur={() => { if (!quantity) setQuantity(1); }}
            />

            <TouchableOpacity style={styles.quantityButton} onPress={() => change(1)} onLongPress={() => change(5)}>
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.quantityUnit}>{tr('quintal')}</Text>

          <View style={styles.quickRow}>
            {QUICK.map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.quick, quantity === n && styles.quickOn]}
                onPress={() => setQuantity(n)}
              >
                <Text style={[styles.quickText, quantity === n && styles.quickTextOn]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* install55: area ceiling - a warning line under the number, never a block */}
        {ceiling != null ? (
          <View style={[styles.ceilBox, overCeiling && styles.ceilBoxWarn]}>
            <Ionicons name={overCeiling ? 'warning-outline' : 'leaf-outline'} size={18} color={overCeiling ? '#B45309' : Colors.secondary} />
            <Text style={[styles.ceilText, overCeiling && { color: '#92400E' }]}>
              {overCeiling ? tr('qty_ceilOver', { c: ceiling, a: acres }) : tr('qty_ceilOk', { c: ceiling, a: acres })}
            </Text>
          </View>
        ) : null}

        {/* install55: registration number + DEMO fetch (mock rail, like the Aadhaar mock) */}
        <View style={styles.regBox}>
          <View style={styles.regHead}>
            <Text style={styles.regTitle}>{tr('qty_regNo')}</Text>
            <View style={styles.demoTag}><Text style={styles.demoTagText}>{RAIL_MODE === 'demo' ? tr('qty_demoTag') : 'LIVE'}</Text></View>
          </View>
          <Text style={styles.regHelp}>{tr('qty_regHelp')}</Text>
          <View style={styles.regRow}>
            <TextInput
              style={styles.regInput}
              value={regNo}
              onChangeText={(t) => setRegNo(t.toUpperCase())}
              placeholder="MFMB-2026-XXXXXX"
              placeholderTextColor="#999"
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.regBtn} onPress={fetchFromRail} disabled={fetching}>
              {fetching ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.regBtnText}>{tr('qty_fetch')}</Text>}
            </TouchableOpacity>
          </View>
          {record ? (
            <View style={styles.recBox}>
              <Text style={styles.recLine}>{tr('qty_recAcres', { a: Object.keys(record.registeredAcres || {}).map((c) => `${tr(`crop_${c}`)} ${record.registeredAcres[c]}`).join(', ') || '-' })}</Text>
              <Text style={styles.recLine}>{record.bankVerified ? tr('qty_recBankOk', { b: record.bankLast4 }) : tr('qty_recBankNo')}</Text>
              {record.source === 'demo' ? <Text style={styles.recDemo}>{tr('qty_recDemo')}</Text> : null}
            </View>
          ) : null}
        </View>

        {/* install55: who comes to the gate */}
        {nominees.length > 0 ? (
          <View style={styles.regBox}>
            <Text style={styles.regTitle}>{tr('qty_whoComes')}</Text>
            <View style={styles.chipRow}>
              {[{ name: 'self', label: forFarmer ? forFarmer.name : tr('qty_me') }, ...nominees.map((n) => ({ name: n.name, label: `${n.name}${n.relation ? ` (${n.relation})` : ''}` }))].map((o) => (
                <TouchableOpacity key={o.name} style={[styles.chip, nominee === o.name && styles.chipOn]} onPress={() => setNominee(o.name)}>
                  <Text style={[styles.chipText, nominee === o.name && { color: Colors.white }]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.hint}>{tr('qty_hint')}</Text>
        <Text style={styles.hint}>{tr('qty_whyFirst')}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title={tr('ss_next')} onPress={next} />
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, last }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 30 },

  summary: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  summaryTitle: { fontSize: 13, fontWeight: '800', color: Colors.subText, marginTop: 6, marginBottom: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  rowLabel: { fontSize: 14, color: Colors.subText, fontWeight: '600' },
  rowValue: { fontSize: 14, color: Colors.navy, fontWeight: '800', flex: 1, textAlign: 'right' },

  quantityBox: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    alignItems: 'center',
  },
  quantityInputRow: { flexDirection: 'row', alignItems: 'center', gap: 26 },
  quantityButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: { fontSize: 34, fontWeight: '800', color: Colors.navy, lineHeight: 38 },
  quantityValue: {
    minWidth: 110,
    textAlign: 'center',
    fontSize: 54,
    fontWeight: '900',
    color: Colors.navy,
  },
  quantityUnit: { fontSize: 14, fontWeight: '700', color: Colors.subText, marginTop: 2 },

  quickRow: { flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' },
  quick: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  quickOn: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  quickText: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  quickTextOn: { color: Colors.white },

  ceilBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E8F5E9', borderRadius: 10, padding: 10, marginTop: 12 },
  ceilBoxWarn: { backgroundColor: '#FEF3C7' },
  ceilText: { flex: 1, fontSize: 13, color: Colors.navy, lineHeight: 18 },

  regBox: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginTop: 14 },
  regHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  regTitle: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  regHelp: { fontSize: 12, color: Colors.subText, marginTop: 4, lineHeight: 17 },
  demoTag: { backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  demoTagText: { fontSize: 11, fontWeight: '900', color: '#92400E' },
  regRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  regInput: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, height: 46, paddingHorizontal: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.white },
  regBtn: { backgroundColor: Colors.secondary, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', minWidth: 96, alignItems: 'center' },
  regBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  recBox: { marginTop: 10, backgroundColor: '#F1F5F9', borderRadius: 10, padding: 10 },
  recLine: { fontSize: 13, color: Colors.navy, marginBottom: 3 },
  recDemo: { fontSize: 11, color: '#92400E', fontWeight: '700', marginTop: 4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  chipText: { fontSize: 13, fontWeight: '700', color: Colors.navy },

  hint: { fontSize: 13, color: Colors.subText, textAlign: 'center', marginTop: 14, lineHeight: 18 },

  footer: {
    padding: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
