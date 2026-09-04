import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import AppNavigator from './navigation/AppNavigator';
import {
  LanguageProvider,
  useLang,
} from './i18n/LanguageContext';

import Colors from './theme/colors';
import { restoreUserSession } from './services/auth';

function GlobalLanguageModalHost() {
  const {
    pickerOpen,
    setPickerOpen,
    languages,
    lang,
    setLang,
    stopSpeak,
  } = useLang();

  return (
    <Modal
      visible={pickerOpen}
      transparent
      animationType="fade"
      onRequestClose={() =>
        setPickerOpen(false)
      }
    >
      <Pressable
        style={styles.overlay}
        onPress={() =>
          setPickerOpen(false)
        }
      >
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>
            भाषा बदलें / Select Language
          </Text>

          <ScrollView>
            {languages.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[
                  styles.langRow,
                  lang === l.code &&
                    styles.langRowActive,
                ]}
                onPress={() => {
                  setLang(l.code);
                  setPickerOpen(false);
                  stopSpeak();
                }}
              >
                <Text
                  style={[
                    styles.langNative,
                    lang === l.code &&
                      styles.langActiveText,
                  ]}
                >
                  {l.native}
                </Text>

                <Text style={styles.langLabel}>
                  {l.label}
                </Text>

                {lang === l.code ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={Colors.secondary}
                  />
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

function RootApp() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.background,
      }}
    >
      <View
        style={{
          height: 5,
          backgroundColor: Colors.primary,
        }}
      />

      <View style={{ flex: 1 }}>
        <NavigationContainer>
          <StatusBar style="dark" />

          <AppNavigator />

          <GlobalLanguageModalHost />
        </NavigationContainer>
      </View>

      <View
        style={{
          height: 5,
          backgroundColor: Colors.secondary,
        }}
      />
    </View>
  );
}

export default function App() {
  const [sessionReady, setSessionReady] =
    useState(false);

  useEffect(() => {
    const restore = async () => {
      await restoreUserSession();
      setSessionReady(true);
    };

    restore();
  }, []);

  if (!sessionReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingScreen}>
          <Text style={styles.logo}>
            AGROBRIDGE
          </Text>

          <ActivityIndicator
            size="large"
            color={Colors.primary}
          />

          <Text style={styles.loadingText}>
            ऐप तैयार हो रहा है...
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <RootApp />
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logo: {
    fontSize: 30,
    fontWeight: '900',
    color: Colors.secondary,
    letterSpacing: 2,
    marginBottom: 24,
  },

  loadingText: {
    marginTop: 12,
    color: Colors.subText,
    fontWeight: '600',
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    maxHeight: '55%',
  },

  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.navy,
    marginBottom: 14,
  },

  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },

  langRowActive: {
    backgroundColor: Colors.accent,
    marginHorizontal: -6,
    paddingHorizontal: 6,
    borderRadius: 10,
  },

  langNative: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.navy,
  },

  langLabel: {
    fontSize: 12,
    color: Colors.subText,
    marginRight: 8,
  },

  langActiveText: {
    color: Colors.secondary,
  },
});