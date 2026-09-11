import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import PrimaryButton from '../../components/PrimaryButton';
import GatePassCard from '../../components/GatePassCard';
import Colors from '../../theme/colors';
import { downloadGatePassPdf } from '../../services/receipt';
import { useLang } from '../../i18n/LanguageContext';

/*
 * Shown once, right after booking. The farmer gets the token
 * number AND the gate pass (QR + 6-digit number) together.
 */
export default function TokenConfirmationScreen({ navigation, route }) {
  const { tr, lang, trError } = useLang();
  const { booking } = route.params || {};
  const [downloading, setDownloading] = useState(false);

  const savePass = async () => {
    setDownloading(true);
    try {
      await downloadGatePassPdf(booking, lang);
    } catch (error) {
      console.error('Gate pass PDF error:', error);
      Alert.alert(tr('pdfFailed'), trError(error, 'pleaseRetry'));
    } finally {
      setDownloading(false);
    }
  };

  /*
   * This screen is opened with navigation.reset, so it is the ONLY
   * screen in the stack and goBack/popToTop do nothing. Instead we
   * reset to the first route of the farmer stack (the dashboard),
   * whatever it happens to be called.
   */
  const goHome = () => {
    const state = navigation.getState();
    const home = state?.routeNames?.[0] || 'FarmerDashboard';
    navigation.reset({ index: 0, routes: [{ name: home }] });
  };

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader navigation={navigation} />
        <Text style={styles.empty}>{tr('tc_noBooking')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.success}>
          <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
          <Text style={styles.successTitle}>{tr('tc_booked')}</Text>
          <Text style={styles.successSub}>{tr('tc_yourToken')}</Text>
          <Text style={styles.tokenNumber}>{booking.tokenNumber}</Text>
          <Text style={styles.eta}>
            {tr('tc_eta', { t: booking.estimatedTurnTime || booking.slotWindow })}
          </Text>
        </View>

        <GatePassCard token={booking} />

        <PrimaryButton
          title={tr('tc_savePass')}
          variant="outline"
          loading={downloading}
          onPress={savePass}
        />

        <View style={styles.tips}>
          <Text style={styles.tipTitle}>{tr('tc_whatAtGate')}</Text>
          <Text style={styles.tip}>{tr('tc_tip1')}</Text>
          <Text style={styles.tip}>{tr('tc_tip2')}</Text>
          <Text style={styles.tip}>{tr('tc_tip3')}</Text>
          <Text style={styles.tipNote}>
            {tr('tc_tipNote')}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title={tr('goDashboard')}
          onPress={goHome}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 30 },
  empty: { textAlign: 'center', marginTop: 40, color: Colors.subText },

  success: { alignItems: 'center', marginBottom: 18, marginTop: 6 },
  successTitle: { fontSize: 20, fontWeight: '900', color: Colors.navy, marginTop: 8 },
  successSub: { fontSize: 13, color: Colors.subText, marginTop: 10, fontWeight: '700' },
  tokenNumber: { fontSize: 44, fontWeight: '900', color: Colors.primary },
  eta: { fontSize: 14, color: Colors.navy, fontWeight: '700', marginTop: 2 },

  tips: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginTop: 14,
  },
  tipTitle: { fontWeight: '900', color: Colors.navy, marginBottom: 8 },
  tip: { color: Colors.text, marginBottom: 4, fontSize: 14 },
  tipNote: { color: Colors.subText, fontSize: 12, marginTop: 6 },

  footer: {
    padding: 18,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
