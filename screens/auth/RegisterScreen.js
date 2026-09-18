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
import { isValidAadhaar, formatAadhaar, sendAadhaarOtp, verifyAadhaarOtp, DEMO_AADHAAR } from '../../services/aadhaar';

export default function RegisterScreen({ navigation, route }) {
  const { tr, lang } = useLang();
  const role = route?.params?.role || 'farmer';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [officerDuty, setOfficerDuty] = useState('gate');
  const [adminCode, setAdminCode] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  // install45: Aadhaar e-KYC (mock) - required for every role
  const [aadhaar, setAadhaar] = useState('');
  const [aadTxn, setAadTxn] = useState(null);
  const [aadOtp, setAadOtp] = useState('');
  const [aadVerified, setAadVerified] = useState(null);   // { govIdNumber, verifiedAt }
  const [aadBusy, setAadBusy] = useState(false);
  const [aadError, setAadError] = useState('');

  const aadhaarSend = async () => {
    setAadError(''); setAadBusy(true);
    try { setAadTxn(await sendAadhaarOtp(aadhaar)); }
    catch (e) { setAadError(tr('aad_invalid')); }
    finally { setAadBusy(false); }
  };
  const aadhaarVerify = async () => {
    setAadError(''); setAadBusy(true);
    try { setAadVerified(await verifyAadhaarOtp(aadhaar, aadOtp, aadTxn?.txnId)); }
    catch (e) { setAadError(tr('aad_wrongOtp')); }
    finally { setAadBusy(false); }
  };

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
    Boolean(aadVerified) &&
    (role !== 'officer' ||
      (employeeId.trim().length > 0 && centreId.length > 0 &&
        (officerDuty !== 'admin' || adminCode.trim().length > 0))) &&
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

        {/* install45: Aadhaar e-KYC (mock) */}
        <Text style={styles.label}>{tr('aad_title')}</Text>
        <Text style={styles.help}>{tr('aad_help')}</Text>
        {aadVerified ? (
          <View style={styles.aadOk}>
            <Ionicons name="shield-checkmark" size={20} color="#16A34A" />
            <View style={{ flex: 1 }}>
              <Text style={styles.aadOkText}>{tr('aad_verified')}</Text>
              <Text style={styles.aadOkSub}>{aadVerified.govIdNumber} • {tr('aad_mockTag')}</Text>
            </View>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input} value={formatAadhaar(aadhaar)}
              onChangeText={(v) => { setAadhaar(v); setAadTxn(null); setAadError(''); }}
              keyboardType="numeric" maxLength={14} placeholder="XXXX XXXX XXXX" placeholderTextColor="#999"
              editable={!aadTxn}
            />
            {!aadTxn ? (
              <PrimaryButton
                title={aadBusy ? '…' : tr('aad_sendOtp')} disabled={!isValidAadhaar(aadhaar) || aadBusy}
                style={{ marginTop: 10 }} onPress={aadhaarSend}
              />
            ) : (
              <>
                <Text style={styles.help}>{tr('aad_otpSent', { m: aadTxn.maskedMobile })}</Text>
                <TextInput
                  style={styles.input} value={aadOtp} onChangeText={setAadOtp}
                  keyboardType="numeric" maxLength={6} placeholder={tr('aad_otpPh')} placeholderTextColor="#999"
                />
                <PrimaryButton
                  title={aadBusy ? '…' : tr('aad_verify')} disabled={aadOtp.length < 4 || aadBusy}
                  style={{ marginTop: 10 }} onPress={aadhaarVerify}
                />
                <TouchableOpacity onPress={() => { setAadTxn(null); setAadOtp(''); }} style={{ marginTop: 8 }}>
                  <Text style={styles.link}>{tr('aad_changeNumber')}</Text>
                </TouchableOpacity>
              </>
            )}
            {aadError ? <Text style={styles.aadErr}>{aadError}</Text> : null}
            <Text style={styles.help}>{tr('aad_demoHint', { n: DEMO_AADHAAR.join(' · ') })}</Text>
          </>
        )}

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

            {officerDuty === 'admin' ? (
              <>
                <Text style={styles.label}>{tr('reg_adminCode')}</Text>
                <Text style={styles.help}>{tr('reg_adminCodeHelp')}</Text>
                <TextInput style={styles.input} value={adminCode} onChangeText={setAdminCode}
                  placeholder="AGB-ADMIN-XXXX" placeholderTextColor="#999" autoCapitalize="characters" />
              </>
            ) : null}
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
              licenseNumber, businessName, adminCode, isNewRegistration: true,
              govIdType: aadVerified?.govIdType, govIdNumber: aadVerified?.govIdNumber, govIdVerifiedAt: aadVerified?.verifiedAt,
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
  label: { fontSize: 14, fontWeight: '700', color: Colors.navy, marginBottom: 6, marginTop: 14 },
  help: { fontSize: 12, color: Colors.subText, marginBottom: 8, lineHeight: 16 },
  warn: { backgroundColor: '#FFF3E0', color: '#E65100', padding: 10, borderRadius: 8, fontSize: 13, fontWeight: '700' },
  input: {
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, height: 50, fontSize: 15, color: Colors.text,
  },
  centreCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderWidth: 1.5,
    borderColor: Colors.border, borderRadius: 12, padding: 13, marginBottom: 8,
  },
  centreCardOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  centreName: { fontWeight: '800', color: Colors.navy, fontSize: 14 },
  centreAddr: { color: Colors.subText, fontSize: 12, marginTop: 3 },
  chip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderWidth: 1.5,
    borderColor: Colors.border, borderRadius: 10, padding: 12, marginBottom: 8,
  },
  chipOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipText: { fontWeight: '700', color: Colors.navy, fontSize: 14 },
  chipDesc: { color: Colors.subText, fontSize: 12, marginTop: 3 },
  aadOk: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#DCFCE7', borderRadius: 12, padding: 12 },
  aadOkText: { color: '#166534', fontWeight: '800', fontSize: 14 },
  aadOkSub: { color: '#166534', fontSize: 12, marginTop: 2 },
  aadErr: { color: Colors.error, fontSize: 12, marginTop: 6, fontWeight: '700' },
  link: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
});
