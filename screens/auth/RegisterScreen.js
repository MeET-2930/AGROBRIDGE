import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';

import { OFFICER_DUTIES } from '../../services/auth';
import { fetchCentres, centreLabel } from '../../services/centres';

export default function RegisterScreen({ navigation, route }) {
  const { tr, lang } = useLang();
  const role = route?.params?.role || 'farmer';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [officerDuty, setOfficerDuty] = useState('gate');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [businessName, setBusinessName] = useState('');

  const [centres, setCentres] = useState([]);
  const [centreId, setCentreId] = useState('');
  const [centreName, setCentreName] = useState('');
  const [centresLoading, setCentresLoading] = useState(false);

  useEffect(() => {
    if (role !== 'officer' && role !== 'trader') return;
    let alive = true;
    setCentresLoading(true);
    fetchCentres()
      .then((list) => alive && setCentres(list))
      .catch((error) => console.error('Centre load error:', error))
      .finally(() => alive && setCentresLoading(false));
    return () => { alive = false; };
  }, [role]);

  const pickCentre = (centre) => {
    setCentreId(centre.id);
    setCentreName(centre.name); // stored name stays Hindi; display uses centreLabel
  };

  const canContinue =
    name.trim().length > 0 &&
    phone.length === 10 &&
    (role !== 'officer' || (employeeId.trim().length > 0 && centreId.length > 0)) &&
    (role !== 'trader' ||
      (licenseNumber.trim().length > 0 && businessName.trim().length > 0 && centreId.length > 0));

  const CentrePicker = ({ helpKey }) => (
    <>
      <Text style={styles.help}>{tr(helpKey)}</Text>
      {centresLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 14 }} />
      ) : centres.length === 0 ? (
        <Text style={styles.warn}>{tr('noneFoundContactAdmin')}</Text>
      ) : (
        centres.map((centre) => {
          const on = centreId === centre.id;
          return (
            <TouchableOpacity
              key={centre.id}
              style={[styles.centreCard, on && styles.centreCardOn]}
              onPress={() => pickCentre(centre)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.centreName, on && { color: Colors.primary }]}>
                  {centreLabel(centre, lang)}
                </Text>
                <Text style={styles.centreAddr} numberOfLines={1}>{centre.address}</Text>
              </View>
              {on ? <Ionicons name="checkmark-circle" size={22} color={Colors.primary} /> : null}
            </TouchableOpacity>
          );
        })
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle title={tr('reg_title')} subtitle={tr('reg_sub')} />

        <Text style={styles.label}>{tr('reg_fullName')}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName}
          placeholder={tr('name')} placeholderTextColor="#999" />

        <Text style={styles.label}>{tr('reg_mobile')}</Text>
        <TextInput style={styles.input} value={phone}
          onChangeText={(text) => setPhone(text.replace(/\D/g, ''))}
          keyboardType="number-pad" maxLength={10}
          placeholder={tr('reg_tenDigits')} placeholderTextColor="#999" />

        {role === 'officer' && (
          <>
            <Text style={styles.label}>{tr('reg_empId')}</Text>
            <TextInput style={styles.input} value={employeeId} onChangeText={setEmployeeId}
              placeholder="EMP-8802" placeholderTextColor="#999" autoCapitalize="characters" />

            <Text style={styles.label}>{tr('reg_yourMandi')}</Text>
            <CentrePicker helpKey="reg_yourMandiHelp" />

            <Text style={styles.label}>{tr('reg_duty')}</Text>
            {OFFICER_DUTIES.map((duty) => {
              const on = officerDuty === duty.id;
              return (
                <TouchableOpacity key={duty.id} style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setOfficerDuty(duty.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.chipText, on && { color: Colors.primary }]}>
                      {tr(duty.nameKey || duty.name)}
                    </Text>
                    <Text style={styles.chipDesc}>{tr(duty.descKey || duty.desc)}</Text>
                  </View>
                  {on ? <Ionicons name="checkmark-circle" size={20} color={Colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {role === 'trader' && (
          <>
            <Text style={styles.label}>{tr('reg_license')}</Text>
            <TextInput style={styles.input} value={licenseNumber} onChangeText={setLicenseNumber}
              placeholder={tr('reg_licensePh')} placeholderTextColor="#999" />

            <Text style={styles.label}>{tr('reg_firm')}</Text>
            <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName}
              placeholder={tr('reg_firmPh')} placeholderTextColor="#999" />

            <Text style={styles.label}>{tr('reg_tradeMandi')}</Text>
            <CentrePicker helpKey="reg_tradeMandiHelp" />
          </>
        )}

        <PrimaryButton
          title={tr('reg_goOtp')}
          disabled={!canContinue}
          style={{ marginTop: 20 }}
          onPress={() =>
            navigation.navigate('Otp', {
              role, phone, name, employeeId, officerDuty, centreId, centreName,
              licenseNumber, businessName, isNewRegistration: true,
            })
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.navy, marginBottom: 6, marginTop: 14 },
  help: { fontSize: 11, color: Colors.subText, marginBottom: 8, lineHeight: 16 },
  warn: { backgroundColor: '#FFF3E0', color: '#E65100', padding: 10, borderRadius: 8, fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, height: 50, fontSize: 15, color: Colors.text,
  },
  centreCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderWidth: 1.5,
    borderColor: Colors.border, borderRadius: 12, padding: 13, marginBottom: 8,
  },
  centreCardOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  centreName: { fontWeight: '800', color: Colors.navy, fontSize: 13 },
  centreAddr: { color: Colors.subText, fontSize: 11, marginTop: 3 },
  chip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderWidth: 1.5,
    borderColor: Colors.border, borderRadius: 10, padding: 12, marginBottom: 8,
  },
  chipOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipText: { fontWeight: '700', color: Colors.navy, fontSize: 13 },
  chipDesc: { color: Colors.subText, fontSize: 11, marginTop: 3 },
});
