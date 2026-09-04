import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import {
  OFFICER_DUTIES,
  getCurrentUserSession,
  updateOfficerPosting,
  updateGovId,
} from '../../services/auth';

import { fetchCentres } from '../../services/centres';

/*
 * Officer profile and posting.
 *
 * Officers registered before centre selection existed have no
 * centreId, which means they cannot see any tokens. This screen
 * lets them set it, and change duty if they are reassigned.
 *
 * The government ID section records an Aadhaar (or other ID)
 * number against the account. Real verification against UIDAI
 * comes later; for now it is stored so the officer record is
 * ready for it.
 */
export default function OfficerProfileScreen({ navigation, route }) {
  const mustPickCentre = route?.params?.mustPickCentre;

  const [session, setSession] = useState(null);
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);

  const [centreId, setCentreId] = useState('');
  const [centreName, setCentreName] = useState('');
  const [duty, setDuty] = useState('gate');
  const [savingPosting, setSavingPosting] = useState(false);

  const [govIdNumber, setGovIdNumber] = useState('');
  const [savingId, setSavingId] = useState(false);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const user = await getCurrentUserSession();

      if (alive && user) {
        setSession(user);
        setCentreId(user.centreId || '');
        setCentreName(user.centreName || '');
        setDuty(user.officerDuty || 'gate');
        setGovIdNumber(user.govIdNumber || '');
      }

      try {
        const list = await fetchCentres();
        if (alive) setCentres(list);
      } catch (error) {
        console.error('Centre load error:', error);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, []);

  const savePosting = async () => {
    if (!centreId) {
      Alert.alert('मंडी चुनें', 'कृपया अपनी मंडी चुनें।');
      return;
    }

    setSavingPosting(true);

    try {
      await updateOfficerPosting({ centreId, centreName, officerDuty: duty });

      Alert.alert('सहेजा गया', 'आपकी मंडी और ड्यूटी अपडेट हो गई।', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('त्रुटि', error?.message || 'सहेजा नहीं जा सका।');
    } finally {
      setSavingPosting(false);
    }
  };

  const saveGovId = async () => {
    setSavingId(true);

    try {
      await updateGovId({ govIdType: 'aadhaar', govIdNumber });
      Alert.alert('सहेजा गया', 'पहचान संख्या दर्ज हो गई।');
    } catch (error) {
      Alert.alert('त्रुटि', error?.message || 'सहेजा नहीं जा सका।');
    } finally {
      setSavingId(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader navigation={navigation} showBack />
        <ActivityIndicator
          color={Colors.primary}
          size="large"
          style={{ marginTop: 40 }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack title="प्रोफ़ाइल" />

      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title="अधिकारी प्रोफ़ाइल"
          subtitle="मंडी, ड्यूटी और पहचान"
        />

        {mustPickCentre ? (
          <View style={styles.alert}>
            <Ionicons name="alert-circle" size={22} color="#E65100" />
            <Text style={styles.alertText}>
              काम शुरू करने से पहले अपनी मंडी चुनें।
            </Text>
          </View>
        ) : null}

        {/* Identity */}
        <View style={styles.card}>
          <Row label="नाम" value={session?.name} />
          <Row label="मोबाइल" value={`+91 ${session?.phone || ''}`} />
          <Row label="कर्मचारी आईडी" value={session?.employeeId || '—'} />
          <Row
            label="सत्यापन"
            value={session?.isVerified ? 'सत्यापित' : 'लंबित'}
          />
        </View>

        {/* Posting */}
        <Text style={styles.sectionTitle}>आपकी मंडी</Text>
        <Text style={styles.help}>
          आपको केवल इसी मंडी के टोकन और काम दिखाई देंगे।
        </Text>

        {centres.length === 0 ? (
          <Text style={styles.warn}>कोई मंडी नहीं मिली।</Text>
        ) : (
          centres.map((centre) => {
            const on = centreId === centre.id;

            return (
              <TouchableOpacity
                key={centre.id}
                style={[styles.pick, on && styles.pickOn]}
                onPress={() => {
                  setCentreId(centre.id);
                  setCentreName(centre.name);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.pickTitle, on && { color: Colors.primary }]}
                  >
                    {centre.name}
                  </Text>
                  <Text style={styles.pickSub} numberOfLines={1}>
                    {centre.address}
                  </Text>
                </View>

                {on ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={Colors.primary}
                  />
                ) : null}
              </TouchableOpacity>
            );
          })
        )}

        <Text style={styles.sectionTitle}>ड्यूटी पद</Text>

        {OFFICER_DUTIES.map((d) => {
          const on = duty === d.id;

          return (
            <TouchableOpacity
              key={d.id}
              style={[styles.pick, on && styles.pickOn]}
              onPress={() => setDuty(d.id)}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.pickTitle, on && { color: Colors.primary }]}
                >
                  {d.name}
                </Text>
                <Text style={styles.pickSub}>{d.desc}</Text>
              </View>

              {on ? (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={Colors.primary}
                />
              ) : null}
            </TouchableOpacity>
          );
        })}

        <PrimaryButton
          title="मंडी और ड्यूटी सहेजें"
          loading={savingPosting}
          onPress={savePosting}
          style={{ marginTop: 8 }}
        />

        {/* Government ID */}
        <Text style={styles.sectionTitle}>पहचान सत्यापन</Text>
        <Text style={styles.help}>
          आधार संख्या दर्ज करें। सरकारी सत्यापन बाद में जोड़ा जाएगा।
        </Text>

        <TextInput
          style={styles.input}
          value={govIdNumber}
          onChangeText={(t) => setGovIdNumber(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={12}
          placeholder="12 अंकों की आधार संख्या"
          placeholderTextColor="#999"
        />

        <PrimaryButton
          title="पहचान सहेजें"
          variant="outline"
          loading={savingId}
          onPress={saveGovId}
          style={{ marginTop: 12, marginBottom: 10 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },

  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF8E1',
    borderColor: '#FFB300',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  alertText: { flex: 1, color: '#E65100', fontWeight: '800', fontSize: 13 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rowLabel: { fontSize: 12, color: Colors.subText },
  rowValue: { fontSize: 12, color: Colors.navy, fontWeight: '700' },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.navy,
    marginTop: 20,
    marginBottom: 4,
  },
  help: {
    fontSize: 11,
    color: Colors.subText,
    marginBottom: 10,
    lineHeight: 16,
  },
  warn: {
    backgroundColor: '#FFF3E0',
    color: '#E65100',
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '700',
  },

  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 13,
    marginBottom: 8,
  },
  pickOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  pickTitle: { fontWeight: '800', color: Colors.navy, fontSize: 13 },
  pickSub: { color: Colors.subText, fontSize: 11, marginTop: 3 },

  input: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.text,
  },
});
