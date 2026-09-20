/*
 * screens/arhtiya/MyFarmersScreen.js  (install55)
 * ---------------------------------------------------------------
 * List of farmers linked to this arhtiya. Add one by phone number
 * (the farmer must already be registered in AgroBridge). Tapping a
 * farmer starts the normal booking planner FOR that farmer:
 * CropSelection -> CentreSelection -> Quantity -> SlotSelection.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { fetchMyFarmers, addFarmerToArhtiya } from '../../services/auth';
import { useLang } from '../../i18n/LanguageContext';

export default function MyFarmersScreen({ navigation, route }) {
  const { tr, trError } = useLang();
  const pick = Boolean(route?.params?.pick);
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setFarmers(await fetchMyFarmers()); }
    catch (e) { console.log(e?.message); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const add = async () => {
    const p = phone.replace(/\D/g, '').slice(-10);
    if (p.length !== 10) { Alert.alert(tr('mobile'), tr('err.badPhone')); return; }
    setAdding(true);
    try {
      await addFarmerToArhtiya(p);
      setPhone('');
      await load();
    } catch (e) {
      Alert.alert(tr('error'), trError(e, 'err.noFarmer'));
    } finally {
      setAdding(false);
    }
  };

  const bookFor = (f) => navigation.navigate('CropSelection', { forFarmer: { uid: f.uid, name: f.name, phone: f.phone, farmerRegNo: f.farmerRegNo || '', regSource: f.regSource || '', registeredAcres: f.registeredAcres || {}, nominees: f.nominees || [], bankLast4: f.bankLast4 || '' } });

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle title={pick ? tr('ar_bookFor') : tr('ar_myFarmers')} subtitle={pick ? tr('ar_pickFarmer') : tr('ar_myFarmersSub')} />

        <View style={styles.addBox}>
          <Text style={styles.addTitle}>{tr('ar_addFarmer')}</Text>
          <Text style={styles.addHelp}>{tr('ar_addHelp')}</Text>
          <View style={styles.addRow}>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} placeholder="91000000XX" placeholderTextColor="#999" />
            <PrimaryButton title={tr('add')} loading={adding} onPress={add} style={{ height: 46, paddingHorizontal: 16 }} />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 20 }} />
        ) : farmers.length === 0 ? (
          <Text style={styles.empty}>{tr('ar_noFarmersSub')}</Text>
        ) : (
          farmers.map((f) => (
            <TouchableOpacity key={f.uid} style={styles.card} onPress={() => bookFor(f)}>
              <View style={styles.avatar}><Ionicons name="person" size={20} color={Colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{f.name}</Text>
                <Text style={styles.sub}>+91 {f.phone}{f.farmerRegNo ? ` • ${f.farmerRegNo}` : ` • ${tr('ar_noReg')}`}</Text>
              </View>
              <View style={styles.bookTag}>
                <Text style={styles.bookTagText}>{tr('bookSlot')}</Text>
                <Ionicons name="arrow-forward" size={14} color={Colors.white} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  addBox: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 16 },
  addTitle: { fontWeight: '800', color: Colors.navy, fontSize: 15 },
  addHelp: { color: Colors.subText, fontSize: 12, marginTop: 4, lineHeight: 17 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, height: 46, paddingHorizontal: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.white },
  empty: { textAlign: 'center', color: Colors.subText, marginTop: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '800', color: Colors.navy, fontSize: 15 },
  sub: { color: Colors.subText, fontSize: 12, marginTop: 2 },
  bookTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  bookTagText: { color: Colors.white, fontWeight: '800', fontSize: 12 },
});
