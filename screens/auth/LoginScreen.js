import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';

import AppHeader from '../../components/AppHeader';
import ScreenTitle from '../../components/ScreenTitle';
import PrimaryButton from '../../components/PrimaryButton';
import Colors from '../../theme/colors';

export default function LoginScreen({
  navigation,
  route,
}) {
  const role =
    route?.params?.role || 'farmer';

  const [phone, setPhone] =
    useState('');

  const canContinue =
    phone.length === 10;

  const continueToOtp = () => {
    if (!canContinue) {
      Alert.alert(
        'गलत नंबर',
        'कृपया 10 अंकों का मोबाइल नंबर दर्ज करें।'
      );
      return;
    }

    navigation.navigate('Otp', {
      role,
      phone,
      isNewRegistration: false,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        navigation={navigation}
        showBack
      />

      <View style={styles.content}>
        <ScreenTitle
          title="मोबाइल लॉग इन"
          subtitle="पंजीकृत मोबाइल से लॉग इन करें"
        />

        <Text style={styles.label}>
          मोबाइल नंबर
        </Text>

        <View style={styles.row}>
          <Text style={styles.cc}>
            +91
          </Text>

          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            maxLength={10}
            value={phone}
            onChangeText={(text) =>
              setPhone(
                text.replace(/\D/g, '')
              )
            }
            placeholder="9876543210"
            placeholderTextColor="#999"
          />
        </View>

        <PrimaryButton
          title="ओटीपी भेजें"
          disabled={!canContinue}
          onPress={continueToOtp}
          style={{
            marginTop: 20,
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  content: {
    flex: 1,
    padding: 20,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.navy,
    marginBottom: 8,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },

  cc: {
    fontWeight: '800',
    color: Colors.navy,
    marginRight: 10,
  },

  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
});