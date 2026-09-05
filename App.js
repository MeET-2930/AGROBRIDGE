/*
 * App.js  -  AGROBRIDGE root
 * ---------------------------------------------------------------
 * Wraps everything in LanguageProvider (so every screen can call
 * useLang()), restores the saved session, then opens the right
 * portal: Auth / Farmer / Officer / Trader.
 * ---------------------------------------------------------------
 */
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
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LanguageProvider, useLang } from './i18n/LanguageContext';
import Colors from './theme/colors';
import { restoreUserSession } from './services/auth';

// Auth
import WelcomeScreen from './screens/auth/WelcomeScreen';
import RoleSelectionScreen from './screens/auth/RoleSelectionScreen';
import UserStatusScreen from './screens/auth/UserStatusScreen';
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import OtpScreen from './screens/auth/OtpScreen';

// Farmer
import FarmerDashboard from './screens/farmer/FarmerDashboard';
import CropSelectionScreen from './screens/farmer/CropSelectionScreen';
import CentreSelectionScreen from './screens/farmer/CentreSelectionScreen';
import SlotSelectionScreen from './screens/farmer/SlotSelectionScreen';
import TokenConfirmationScreen from './screens/farmer/TokenConfirmationScreen';
import TokenDetailScreen from './screens/farmer/TokenDetailScreen';
import HistoryScreen from './screens/farmer/HistoryScreen';
import PaymentsScreen from './screens/farmer/PaymentsScreen';

// Officer & Trader portals
import OfficerStack from './navigation/OfficerStack';
import TraderStack from './navigation/TraderStack';

const Root = createNativeStackNavigator();
const AuthNav = createNativeStackNavigator();
const FarmerNav = createNativeStackNavigator();

function AuthStack() {
  return (
    <AuthNav.Navigator screenOptions={{ headerShown: false }}>
      <AuthNav.Screen name="Welcome" component={WelcomeScreen} />
      <AuthNav.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <AuthNav.Screen name="UserStatus" component={UserStatusScreen} />
      <AuthNav.Screen name="Login" component={LoginScreen} />
      <AuthNav.Screen name="Register" component={RegisterScreen} />
      <AuthNav.Screen name="Otp" component={OtpScreen} />
    </AuthNav.Navigator>
  );
}

function FarmerStack() {
  return (
    <FarmerNav.Navigator screenOptions={{ headerShown: false }}>
      <FarmerNav.Screen name="FarmerDashboard" component={FarmerDashboard} />
      <FarmerNav.Screen name="CropSelection" component={CropSelectionScreen} />
      <FarmerNav.Screen name="CentreSelection" component={CentreSelectionScreen} />
      <FarmerNav.Screen name="SlotSelection" component={SlotSelectionScreen} />
      <FarmerNav.Screen name="TokenConfirmation" component={TokenConfirmationScreen} />
      <FarmerNav.Screen name="TokenDetail" component={TokenDetailScreen} />
      <FarmerNav.Screen name="History" component={HistoryScreen} />
      <FarmerNav.Screen name="Payments" component={PaymentsScreen} />
    </FarmerNav.Navigator>
  );
}

/*
 * Language bottom-sheet. Mounted once; any screen opens it through
 * setPickerOpen(true) from useLang().
 */
function GlobalLanguageModalHost() {
  const { pickerOpen, setPickerOpen, languages, lang, setLang, stopSpeak } = useLang();

  return (
    <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
      <Pressable style={styles.overlay} onPress={() => setPickerOpen(false)}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>भाषा बदलें / Select Language</Text>

          <ScrollView>
            {languages.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[styles.langRow, lang === l.code && styles.langRowActive]}
                onPress={() => {
                  setLang(l.code);
                  setPickerOpen(false);
                  stopSpeak();
                }}
              >
                <Text style={[styles.langNative, lang === l.code && styles.langActiveText]}>{l.native}</Text>
                <Text style={styles.langLabel}>{l.label}</Text>
                {lang === l.code ? (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.secondary} />
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

/*
 * Root frame: thin saffron strip on top, thin green strip at the
 * bottom, app in between - on EVERY screen.
 */
function RootApp({ initialRoute }) {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={{ height: 5, backgroundColor: Colors.primary }} />

      <View style={{ flex: 1 }}>
        <NavigationContainer>
          <StatusBar style="dark" />
          <Root.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
            <Root.Screen name="Auth" component={AuthStack} />
            <Root.Screen name="Farmer" component={FarmerStack} />
            <Root.Screen name="Officer" component={OfficerStack} />
            <Root.Screen name="Trader" component={TraderStack} />
          </Root.Navigator>
          <GlobalLanguageModalHost />
        </NavigationContainer>
      </View>

      <View style={{ height: 5, backgroundColor: Colors.secondary }} />
    </View>
  );
}

export default function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Auth');

  useEffect(() => {
    restoreUserSession()
      .then((session) => {
        if (session?.role === 'officer') setInitialRoute('Officer');
        else if (session?.role === 'trader') setInitialRoute('Trader');
        else if (session?.role === 'farmer') setInitialRoute('Farmer');
      })
      .catch(() => {})
      .finally(() => setSessionReady(true));
  }, []);

  if (!sessionReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingScreen}>
          <Text style={styles.logo}>AGROBRIDGE</Text>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>ऐप तैयार हो रहा है...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <RootApp initialRoute={initialRoute} />
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 30, fontWeight: '900', color: Colors.secondary, letterSpacing: 2, marginBottom: 24 },
  loadingText: { marginTop: 12, color: Colors.subText, fontWeight: '600' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: 20, maxHeight: '55%',
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy, marginBottom: 14 },
  langRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10,
  },
  langRowActive: { backgroundColor: Colors.accent, marginHorizontal: -6, paddingHorizontal: 6, borderRadius: 10 },
  langNative: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.navy },
  langLabel: { fontSize: 12, color: Colors.subText, marginRight: 8 },
  langActiveText: { color: Colors.secondary },
});
