/*
 * screens/farmer/FarmerProfileScreen.js  (install55)
 * ---------------------------------------------------------------
 * The farmer's government-rail profile, all optional:
 *   - registration number (MFMB / Anaaj Kharid / e-Uparjan) + the
 *     DEMO fetch of registered acres and bank status
 *   - up to 3 nominees (who may bring the load to the gate)
 *   - "my arhtiya" link - lets a commission agent book passes for me
 * Opened from the avatar pop-up on the farmer dashboard.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { getCurrentUserSession, updateFarmerProfile, linkArhtiya } from '../../services/auth';
import { getFarmerRecord, isValidRegNo, RAIL_MODE, RAILS } from '../../services/govRail';
import { useLang } from '../../i18n/LanguageContext';

const EMPTY = { name: '', relation: '', phone: '' };

export default function FarmerProfileScreen({ navigation }) {
  const { tr, trError } = useLang();
  const [session, setSession] = useState(null);
  const [regNo, setRegNo] = useState('');
  const [record, setRecord] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [nominees, setNominees] = useState([{ ...EMPTY }]);
  const [arhtiyaPhone, setArhtiyaPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUserSession();
      setSession(u);
      setRegNo(u?.farmerRegNo || '');
      if (u?.registeredAcres && Object.keys(u.registeredAcres).length) setRecord({ source: u.regSource, registeredAcres: u.registeredAcres, bankLast4: u.bankLast4, bankVerified: true });
      setNominees(u?.nominees?.length ? u.nominees.map((n) => ({ ...EMPTY, ...n })) : [{ ...EMPTY }]);
      setArhtiyaPhone(u?.arhtiyaId || '');
    })();
  }, []);

  const fetchRail = async () => {
    if (!isValidRegNo(regNo)) { Alert.alert(tr('qty_regNo'), tr('err.badRegNo')); return; }
    setFetching(true);
    try { setRecord(await getFarmerRecord(regNo, { name: session?.name })); }
    catch (e) { Alert.alert(tr('qty_regNo'), trError(e, 'pleaseRetry')); }
    finally { setFetching(false); }
  };

  const setNom = (i, k, v) => setNominees((l) => l.map((n, j) => (j === i ? { ...n, [k]: v } : n)));

  const save = async () => {
    setSaving(true);
    try {
      await updateFarmerProfile({
        farmerRegNo: regNo,
        regSource: record?.source === 'demo' ? record.rail : regNo ? 'manual' : '',
        registeredAcres: record?.registeredAcres || null,
        bankLast4: record?.bankLast4 || '',
        nominees,
      });
      const cur = session?.arhtiyaId || '';
      const want = arhtiyaPhone.replace(/\D/g, '').slice(-10);
      if (want !== cur) await linkArhtiya(want || null);
      Alert.alert(tr('saved'), tr('fp_saved'), [{ text: tr('ok'), onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert(tr('error'), trError(e, 'notSaved'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle title={tr('fp_title')} subtitle={session?.name || ''} />

        {/* Registration */}
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.cardTitle}>{tr('qty_regNo')}</Text>
            <View style={styles.demoTag}><Text style={styles.demoTagText}>{RAIL_MODE === 'demo' ? tr('qty_demoTag') : 'LIVE'}</Text></View>
          </View>
          <Text style={styles.help}>{tr('fp_regHelp', { r: Object.values(RAILS).filter((x) => x.kind === 'registration').map((x) => x.name).join(' / ') })}</Text>
          <View style={styles.row}>
            <TextInput style={styles.input} value={regNo} onChangeText={(t) => setRegNo(t.toUpperCase())} placeholder="MFMB-2026-XXXXXX" placeholderTextColor="#999" autoCapitalize="characters" />
            <TouchableOpacity style={styles.fetchBtn} onPress={fetchRail} disabled={fetching}>
              {fetching ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.fetchText}>{tr('qty_fetch')}</Text>}
            </TouchableOpacity>
          </View>
          {record ? (
            <View style={styles.recBox}>
              {record.village ? <Text style={styles.recLine}>{record.village}, {record.district} • {record.season}</Text> : null}
              <Text style={styles.recLine}>{tr('qty_recAcres', { a: Object.keys(record.registeredAcres || {}).map((c) => `${tr(`crop_${c}`)} ${record.registeredAcres[c]}`).join(', ') || '-' })}</Text>
              <Text style={styles.recLine}>{record.bankVerified ? tr('qty_recBankOk', { b: record.bankLast4 }) : tr('qty_recBankNo')}</Text>
              {record.source === 'demo' ? <Text style={styles.recDemo}>{tr('qty_recDemo')}</Text> : null}
            </View>
          ) : null}
        </View>

        {/* Nominees */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr('fp_nominees')}</Text>
          <Text style={styles.help}>{tr('fp_nomineesHelp')}</Text>
          {nominees.map((n, i) => (
            <View key={i} style={styles.nomBox}>
              <View style={styles.head}>
                <Text style={styles.nomTitle}>{tr('fp_nomineeN', { n: i + 1 })}</Text>
                {nominees.length > 1 ? (
                  <TouchableOpacity onPress={() => setNominees((l) => l.filter((_, j) => j !== i))}>
                    <Ionicons name="close-circle" size={22} color={Colors.error} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TextInput style={styles.input} value={n.name} onChangeText={(v) => setNom(i, 'name', v)} placeholder={tr('name')} placeholderTextColor="#999" />
              <View style={[styles.row, { marginTop: 8 }]}>
                <TextInput style={[styles.input, { flex: 1 }]} value={n.relation} onChangeText={(v) => setNom(i, 'relation', v)} placeholder={tr('fp_relation')} placeholderTextColor="#999" />
                <TextInput style={[styles.input, { flex: 1 }]} value={n.phone} onChangeText={(v) => setNom(i, 'phone', v)} placeholder={tr('mobile')} placeholderTextColor="#999" keyboardType="phone-pad" maxLength={10} />
              </View>
            </View>
          ))}
          {nominees.length < 3 ? (
            <TouchableOpacity style={styles.addLink} onPress={() => setNominees((l) => [...l, { ...EMPTY }])}>
              <Ionicons name="add-circle-outline" size={18} color={Colors.secondary} />
              <Text style={styles.addLinkText}>{tr('fp_addNominee')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* My arhtiya */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tr('fp_arhtiya')}</Text>
          <Text style={styles.help}>{tr('fp_arhtiyaHelp')}</Text>
          {session?.arhtiyaName ? <Text style={styles.recLine}>{tr('fp_arhtiyaLinked', { a: session.arhtiyaName })}</Text> : null}
          <TextInput style={styles.input} value={arhtiyaPhone} onChangeText={setArhtiyaPhone} placeholder="92000000XX" placeholderTextColor="#999" keyboardType="phone-pad" maxLength={10} />
          <Text style={styles.help}>{tr('fp_arhtiyaUnlink')}</Text>
        </View>

        <PrimaryButton title={tr('save')} loading={saving} onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  help: { fontSize: 12, color: Colors.subText, marginTop: 4, marginBottom: 8, lineHeight: 17 },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, height: 46, paddingHorizontal: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.white },
  fetchBtn: { backgroundColor: Colors.secondary, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', minWidth: 96, alignItems: 'center' },
  fetchText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  demoTag: { backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  demoTagText: { fontSize: 11, fontWeight: '900', color: '#92400E' },
  recBox: { marginTop: 10, backgroundColor: '#F1F5F9', borderRadius: 10, padding: 10 },
  recLine: { fontSize: 13, color: Colors.navy, marginBottom: 3 },
  recDemo: { fontSize: 11, color: '#92400E', fontWeight: '700', marginTop: 4 },
  nomBox: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, marginBottom: 10 },
  nomTitle: { fontWeight: '800', color: Colors.navy, marginBottom: 6 },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addLinkText: { color: Colors.secondary, fontWeight: '800' },
});
