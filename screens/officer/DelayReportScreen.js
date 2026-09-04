import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, Alert } from 'react-native';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { reportCentreDelay } from '../../services/bookings';
import { getCurrentUserSession } from '../../services/auth';

export default function DelayReportScreen({ navigation }) {
  const [minutes, setMinutes] = useState('20');
  const [reason, setReason] = useState('वर्षा / तौल मशीन');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);

    try {
      const user = await getCurrentUserSession();

      if (!user?.centreId) {
        throw new Error('पहले अपनी मंडी चुनें।');
      }

      await reportCentreDelay(user.centreId, minutes, reason);

      Alert.alert('हो गया', `+${minutes} मिनट विलंब दर्ज`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('त्रुटि', error?.message || 'दर्ज नहीं हुआ।');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <View style={styles.content}>
        <ScreenTitle
          title="विलंब रिपोर्ट (एडमिन)"
          subtitle="सभी शेष ETA अपने आप शिफ्ट होंगे"
        />

        <Text style={styles.label}>अतिरिक्त मिनट</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={minutes}
          onChangeText={setMinutes}
        />

        <Text style={styles.label}>कारण</Text>
        <TextInput style={styles.input} value={reason} onChangeText={setReason} />

        <PrimaryButton
          title="विलंब प्रसारित करें"
          variant="danger"
          loading={busy}
          style={{ marginTop: 20 }}
          onPress={submit}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  label: { fontWeight: '700', color: Colors.navy, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
    color: Colors.text,
  },
});
