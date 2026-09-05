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
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

import { OFFICER_DUTIES } from '../../services/auth';
import { fetchCentres } from '../../services/centres';

export default function RegisterScreen({ navigation, route }) {
  const role = route?.params?.role || 'farmer';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [officerDuty, setOfficerDuty] = useState('gate');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [businessName, setBusinessName] = useState('');

  // Which mandi this officer is posted at.
  const [centres, setCentres] = useState([]);
  const [centreId, setCentreId] = useState('');
  const [centreName, setCentreName] = useState('');
  const [centresLoading, setCentresLoading] = useState(false);

  useEffect(() => {
    if (role !== 'officer' && role !== 'trader') return;

    let alive = true;
    setCentresLoading(true);

    fetchCentres()
      .then((list) => {
        if (!alive) return;
        setCentres(list);
      })
      .catch((error) => console.error('Centre load error:', error))
      .finally(() => {
        if (alive) setCentresLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [role]);

  const pickCentre = (centre) => {
    setCentreId(centre.id);
    setCentreName(centre.name);
  };

  const canContinue =
    name.trim().length > 0 &&
    phone.length === 10 &&
    (role !== 'officer' ||
      (employeeId.trim().length > 0 && centreId.length > 0)) &&
    (role !== 'trader' ||
      (licenseNumber.trim().length > 0 &&
        businessName.trim().length > 0 &&
        centreId.length > 0));

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader navigation={navigation} showBack />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitle title="नया खाता" subtitle="अपना विवरण दर्ज करें" />

        <Text style={styles.label}>पूरा नाम *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="नाम"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>मोबाइल *</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={(text) => setPhone(text.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="10 अंक"
          placeholderTextColor="#999"
        />

        {role === 'officer' && (
          <>
            <Text style={styles.label}>कर्मचारी आईडी *</Text>
            <TextInput
              style={styles.input}
              value={employeeId}
              onChangeText={setEmployeeId}
              placeholder="EMP-8802"
              placeholderTextColor="#999"
              autoCapitalize="characters"
            />

            <Text style={styles.label}>आपकी मंडी *</Text>
            <Text style={styles.help}>
              आप जिस मंडी में तैनात हैं वही चुनें। आपको केवल उसी मंडी के
              टोकन दिखाई देंगे।
            </Text>

            {centresLoading ? (
              <ActivityIndicator
                color={Colors.primary}
                style={{ marginVertical: 14 }}
              />
            ) : centres.length === 0 ? (
              <Text style={styles.warn}>
                कोई मंडी नहीं मिली। कृपया व्यवस्थापक से संपर्क करें।
              </Text>
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
                      <Text
                        style={[
                          styles.centreName,
                          on && { color: Colors.primary },
                        ]}
                      >
                        {centre.name}
                      </Text>
                      <Text style={styles.centreAddr} numberOfLines={1}>
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

            <Text style={styles.label}>ड्यूटी पद *</Text>

            {OFFICER_DUTIES.map((duty) => {
              const on = officerDuty === duty.id;

              return (
                <TouchableOpacity
                  key={duty.id}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setOfficerDuty(duty.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.chipText, on && { color: Colors.primary }]}
                    >
                      {duty.name}
                    </Text>
                    <Text style={styles.chipDesc}>{duty.desc}</Text>
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
          </>
        )}

        {role === 'trader' && (
          <>
            <Text style={styles.label}>लाइसेंस नंबर *</Text>
            <TextInput
              style={styles.input}
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              placeholder="लाइसेंस नंबर"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>फर्म नाम *</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="फर्म का नाम"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>व्यापार की मंडी *</Text>
            <Text style={styles.help}>
              जिस मंडी में आपका लाइसेंस है वही चुनें। आपको उसी मंडी की
              नीलामी दिखेंगी।
            </Text>

            {centresLoading ? (
              <ActivityIndicator
                color={Colors.primary}
                style={{ marginVertical: 14 }}
              />
            ) : centres.length === 0 ? (
              <Text style={styles.warn}>
                कोई मंडी नहीं मिली। कृपया व्यवस्थापक से संपर्क करें।
              </Text>
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
                      <Text
                        style={[
                          styles.centreName,
                          on && { color: Colors.primary },
                        ]}
                      >
                        {centre.name}
                      </Text>
                      <Text style={styles.centreAddr} numberOfLines={1}>
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

          </>
        )}

        <PrimaryButton
          title="ओटीपी पर जाएं"
          disabled={!canContinue}
          style={{ marginTop: 20 }}
          onPress={() =>
            navigation.navigate('Otp', {
              role,
              phone,
              name,
              employeeId,
              officerDuty,
              centreId,
              centreName,
              licenseNumber,
              businessName,
              isNewRegistration: true,
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

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.navy,
    marginBottom: 6,
    marginTop: 14,
  },
  help: {
    fontSize: 11,
    color: Colors.subText,
    marginBottom: 8,
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

  input: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 15,
    color: Colors.text,
  },

  centreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 13,
    marginBottom: 8,
  },
  centreCardOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  centreName: { fontWeight: '800', color: Colors.navy, fontSize: 13 },
  centreAddr: { color: Colors.subText, fontSize: 11, marginTop: 3 },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  chipOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipText: { fontWeight: '700', color: Colors.navy, fontSize: 13 },
  chipDesc: { color: Colors.subText, fontSize: 11, marginTop: 3 },
});
