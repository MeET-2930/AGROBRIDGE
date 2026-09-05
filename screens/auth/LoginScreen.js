import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, Alert } from 'react-native';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';
import { useLang } from '../../i18n/LanguageContext';

export default function LoginScreen({ navigation, route }) {
  const { tr } = useLang();
  const role = route?.params?.role || 'farmer';
  const [phone, setPhone] = useState('');
  const canContinue = phone.length === 10;

  const continueToOtp = () => {
    if (!canContinue) {
      Alert.alert(tr('login_badNumber'), tr('login_badNumberSub'));
      return;
    }
    navigation.navigate('Otp', { role, phone, isNewRegistration: false });
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <View style={styles.content}>
        <ScreenTitle title={tr('login_title')} subtitle={tr('login_sub')} />

        <Text style={styles.label}>{tr('login_mobile')}</Text>

        <View style={styles.row}>
          <Text style={styles.cc}>+91</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            maxLength={10}
            value={phone}
            onChangeText={(text) => setPhone(text.replace(/\D/g, ''))}
            placeholder="9876543210"
            placeholderTextColor="#999"
          />
        </View>

        <PrimaryButton
          title={tr('sendOtp')}
          disabled={!canContinue}
          onPress={continueToOtp}
          style={{ marginTop: 20 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: 20 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.navy, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, height: 52,
  },
  cc: { fontWeight: '800', color: Colors.navy, marginRight: 10 },
  input: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.text },
});
