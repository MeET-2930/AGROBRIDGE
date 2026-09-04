import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';
import { findByGatePass, markGateEntry, STATUS } from '../../services/bookings';

/*
 * Gate officer: scan the farmer's gate pass QR (or type the
 * 6-digit number), confirm vehicle number, let them in.
 *
 * route.params.rows = today's live list from StageQueueScreen.
 */
export default function GateScanScreen({ navigation, route }) {
  const rows = route.params?.rows || [];

  const [permission, requestPermission] = useCameraPermissions();
  const [typed, setTyped] = useState('');
  const [match, setMatch] = useState(null);
  const [vehicle, setVehicle] = useState('');
  const [busy, setBusy] = useState(false);
  const [how, setHow] = useState('manual');
  const locked = useRef(false);

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission]);

  const resolve = (input, source) => {
    const hit = findByGatePass(rows, input);

    if (!hit) {
      Alert.alert(
        'गेट पास नहीं मिला',
        'आज की कतार में यह पास नहीं है। नंबर जाँचें या मंडी/तारीख देखें।'
      );
      locked.current = false;
      return;
    }

    if (hit.status !== STATUS.BOOKED) {
      Alert.alert('पहले से प्रवेश', `टोकन ${hit.tokenNumber} पहले ही अंदर है।`);
      locked.current = false;
      return;
    }

    setMatch(hit);
    setVehicle(hit.vehicleNumber || '');
    setHow(source);
  };

  const onScan = ({ data }) => {
    if (locked.current || match) return;
    locked.current = true;
    resolve(data, 'qr');
  };

  const confirm = async () => {
    if (!match) return;
    if (!String(vehicle).trim()) {
      Alert.alert('वाहन नंबर', 'कृपया वाहन नंबर दर्ज करें।');
      return;
    }
    setBusy(true);
    try {
      await markGateEntry(match.tokenId, vehicle, how);
      Alert.alert('प्रवेश दर्ज ✓', `${match.tokenNumber} • ${match.farmerName}`, [
        { text: 'अगला स्कैन', onPress: reset },
        { text: 'वापस', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('त्रुटि', error?.message || 'गेट प्रवेश दर्ज नहीं हुआ।');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setMatch(null);
    setTyped('');
    setVehicle('');
    locked.current = false;
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack title="गेट पास स्कैन" />

      {!match ? (
        <View style={{ flex: 1 }}>
          <View style={styles.cameraBox}>
            {permission?.granted ? (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={onScan}
              />
            ) : (
              <View style={styles.noCam}>
                <ActivityIndicator color={Colors.white} />
                <Text style={styles.noCamText}>कैमरा अनुमति चाहिए</Text>
                <TouchableOpacity onPress={requestPermission}>
                  <Text style={styles.noCamLink}>अनुमति दें</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.frame} />
          </View>

          <View style={styles.manual}>
            <Text style={styles.manualTitle}>या गेट पास नंबर टाइप करें</Text>
            <View style={styles.row}>
              <TextInput
                style={styles.input}
                value={typed}
                onChangeText={setTyped}
                placeholder="6 अंक  (या A-03)"
                placeholderTextColor="#999"
                keyboardType="default"
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={styles.go}
                onPress={() => resolve(typed, 'code')}
              >
                <Ionicons name="search" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>
              आज की कतार में {rows.filter((r) => r.status === STATUS.BOOKED).length} वाहन प्रतीक्षा में
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.result}>
          <View style={styles.okBadge}>
            <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
            <Text style={styles.okText}>
              गेट पास सही है ({how === 'qr' ? 'QR' : 'नंबर'})
            </Text>
          </View>

          <Text style={styles.token}>{match.tokenNumber}</Text>
          <Text style={styles.name}>{match.farmerName}</Text>
          <Text style={styles.sub}>+91 {match.farmerPhone}</Text>
          <Text style={styles.sub}>
            {match.cropName || match.crop} • {match.approxQuantityQuintals} क्विं. • {match.slotWindow}
          </Text>

          <Text style={styles.label}>वाहन नंबर</Text>
          <TextInput
            style={styles.inputBig}
            value={vehicle}
            onChangeText={setVehicle}
            placeholder="HR 26 AB 1234"
            placeholderTextColor="#999"
            autoCapitalize="characters"
          />

          <PrimaryButton
            title="प्रवेश दें  →"
            loading={busy}
            onPress={confirm}
            style={{ marginTop: 16 }}
          />
          <TouchableOpacity onPress={reset} style={{ marginTop: 14 }}>
            <Text style={styles.cancel}>रद्द / दोबारा स्कैन</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  cameraBox: {
    height: 300,
    backgroundColor: '#000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 200,
    height: 200,
    borderWidth: 3,
    borderColor: '#16A34A',
    borderRadius: 16,
  },
  noCam: { alignItems: 'center', gap: 8 },
  noCamText: { color: Colors.white, fontWeight: '700' },
  noCamLink: { color: '#4ADE80', fontWeight: '800' },

  manual: { padding: 18 },
  manualTitle: { fontWeight: '800', color: Colors.navy, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    color: Colors.navy,
  },
  go: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { color: Colors.subText, fontSize: 12, marginTop: 10 },

  result: { padding: 18 },
  okBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  okText: { color: '#166534', fontWeight: '800' },
  token: { fontSize: 44, fontWeight: '900', color: Colors.navy, marginTop: 10 },
  name: { fontSize: 18, fontWeight: '800', color: Colors.text },
  sub: { color: Colors.subText, marginTop: 2 },
  label: { marginTop: 18, fontWeight: '800', color: Colors.navy, fontSize: 12 },
  inputBig: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 54,
    fontSize: 20,
    fontWeight: '800',
    color: Colors.navy,
    marginTop: 6,
  },
  cancel: { textAlign: 'center', color: Colors.error, fontWeight: '800' },
});
