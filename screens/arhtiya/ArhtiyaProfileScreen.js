/*
 * screens/arhtiya/ArhtiyaProfileScreen.js  (install55)
 * ---------------------------------------------------------------
 * Licence + firm (read-only, set at registration), the mandi he
 * works at, and WHICH SHED / DHERA is his. Heaps of his farmers'
 * lots are booked to that shed so the floor accounting per shed
 * works (Officer -> Engine -> Yard & sheds).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';
import { fetchCentres, fetchCentreById, centreLabel } from '../../services/centres';
import { getCurrentUserSession, updateTraderCentre, updateArhtiyaShed } from '../../services/auth';
import { shedFill } from '../../services/bookings';
import { useLang } from '../../i18n/LanguageContext';

export default function ArhtiyaProfileScreen({ navigation }) {
  const { tr, lang, trError } = useLang();
  const [session, setSession] = useState(null);
  const [centres, setCentres] = useState([]);
  const [centreId, setCentreId] = useState('');
  const [centreName, setCentreName] = useState('');
  const [sheds, setSheds] = useState([]);
  const [shedId, setShedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUserSession();
      setSession(u);
      setCentreId(u?.centreId || '');
      setCentreName(u?.centreName || '');
      setShedId(u?.shedId || '');
      try { setCentres(await fetchCentres()); } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!centreId) { setSheds([]); return; }
    fetchCentreById(centreId).then((c) => setSheds(shedFill(c))).catch(() => setSheds([]));
  }, [centreId]);

  const save = async () => {
    setSaving(true);
    try {
      if (centreId !== session?.centreId) await updateTraderCentre({ centreId, centreName });
      await updateArhtiyaShed(shedId);
      Alert.alert(tr('saved'), tr('ar_profileSaved'), [{ text: tr('ok'), onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert(tr('error'), trError(e, 'notSaved'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title={tr('ar_profile')} subtitle={session?.name || ''} />

        <View style={styles.card}>
          <Row l={tr('tr_firm')} v={session?.businessName} />
          <Row l={tr('tr_license')} v={session?.licenseNumber} />
          <Row l={tr('mobile')} v={session?.phone ? `+91 ${session.phone}` : ''} />
        </View>

        <Text style={styles.label}>{tr('ar_mandi')}</Text>
        {loading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          centres.map((c) => {
            const on = centreId === c.id;
            return (
              <TouchableOpacity key={c.id} style={[styles.chip, on && styles.chipOn]} onPress={() => { setCentreId(c.id); setCentreName(c.name); setShedId(''); }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.chipText, on && { color: Colors.primary }]}>{centreLabel(c, lang)}</Text>
                  <Text style={styles.chipDesc}>{c.address}</Text>
                </View>
                {on ? <Ionicons name="checkmark-circle" size={22} color={Colors.primary} /> : null}
              </TouchableOpacity>
            );
          })
        )}

        <Text style={styles.label}>{tr('ar_myShed')}</Text>
        <Text style={styles.help}>{tr('ar_myShedHelp')}</Text>
        {sheds.length === 0 ? (
          <Text style={styles.help}>{tr('ar_noSheds')}</Text>
        ) : (
          sheds.map((s) => {
            const on = shedId === s.id;
            return (
              <TouchableOpacity key={s.id} style={[styles.chip, on && styles.chipOn]} onPress={() => setShedId(s.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.chipText, on && { color: Colors.primary }]}>{s.name || s.id}</Text>
                  <Text style={styles.chipDesc}>{tr('ar_shedFill', { u: Math.round(s.usedQ), c: s.floorCapacityQ, p: s.percent })}</Text>
                </View>
                {on ? <Ionicons name="checkmark-circle" size={22} color={Colors.primary} /> : null}
              </TouchableOpacity>
            );
          })
        )}

        <PrimaryButton title={tr('save')} loading={saving} disabled={!centreId} onPress={save} style={{ marginTop: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ l, v }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowL}>{l}</Text>
      <Text style={styles.rowV}>{v || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 30 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rowL: { color: Colors.subText, fontSize: 13 },
  rowV: { color: Colors.navy, fontWeight: '800', fontSize: 14 },
  label: { fontWeight: '800', color: Colors.navy, marginBottom: 8, marginTop: 10 },
  help: { fontSize: 12, color: Colors.subText, marginBottom: 8, lineHeight: 17 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  chipOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipText: { fontWeight: '800', color: Colors.navy },
  chipDesc: { fontSize: 12, color: Colors.subText, marginTop: 2 },
});
