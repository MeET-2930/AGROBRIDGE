import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';

import { loginWithPhone, registerUser } from '../../services/auth';

export default function OtpScreen({ navigation, route }) {
  const { tr, trError } = useLang();
  const p = route?.params || {};

  const [otp, setOtp] = useState('1234');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (otp !== '1234') {
      Alert.alert(tr('otp_wrong'), tr('otp_wrongSub'));
      return;
    }

    setLoading(true);

    try {
      let session;

      if (p.isNewRegistration) {
        session = await registerUser({
          role: p.role,
          name: p.name,
          phone: p.phone,
          employeeId: p.employeeId,
          officerDuty: p.officerDuty,
          centreId: p.centreId,
          centreName: p.centreName,
          licenseNumber: p.licenseNumber,
          businessName: p.businessName,
          adminCode: p.adminCode,
          govIdType: p.govIdType,
          govIdNumber: p.govIdNumber,
          govIdVerifiedAt: p.govIdVerifiedAt,
        });
      } else {
        session = await loginWithPhone(p.phone, p.role);
      }

      const target =
        session.role === 'officer' ? 'Officer' : session.role === 'trader' ? 'Trader' : session.role === 'arhtiya' ? 'Arhtiya' : 'Farmer';

      navigation.getParent()?.reset({ index: 0, routes: [{ name: target }] });
    } catch (error) {
      Alert.alert(tr('otp_problem'), trError(error, 'otp_genericError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <View style={styles.content}>
        <ScreenTitle title={tr('otp_title')} subtitle={`+91 ${p.phone || ''}`} />

        <Text style={styles.testText}>{tr('otp_test')}</Text>

        <TextInput
          style={styles.otp}
          keyboardType="number-pad"
          maxLength={4}
          value={otp}
          onChangeText={(text) => setOtp(text.replace(/\D/g, ''))}
          editable={!loading}
        />

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
        ) : (
          <PrimaryButton
            title={tr('otp_verify')}
            onPress={handleVerify}
            disabled={otp.length !== 4}
            style={{ marginTop: 20 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: 20 },
  testText: { textAlign: 'center', color: Colors.subText, fontSize: 13, marginTop: 14 },
  otp: {
    marginTop: 20, alignSelf: 'center', width: 180, height: 56, borderWidth: 2,
    borderColor: Colors.primary, borderRadius: 12, textAlign: 'center', fontSize: 28,
    fontWeight: '800', letterSpacing: 10, backgroundColor: Colors.white, color: Colors.navy,
  },
});
