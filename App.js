/*
 * App.js  -  AGROBRIDGE root
 * ---------------------------------------------------------------
 * Wraps everything in LanguageProvider (so every screen can call
 * useLang()), restores the saved session, then opens the right
 * portal: Auth / Farmer / Officer / Trader.
 * ---------------------------------------------------------------
 */
import './utils/webAlert';   // install34: makes Alert.alert work on the website
import React, { useEffect, useState } from 'react';
import {
  Image,
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
import * as Font from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LanguageProvider, useLang, StopSpeechOnNavigate } from './i18n/LanguageContext';
import Colors from './theme/colors';
import { LOGO_FULL } from './theme/brand';
import { restoreUserSession } from './services/auth';

// Auth
import WelcomeScreen from './screens/auth/WelcomeScreen';
import RoleSelectionScreen from './screens/auth/RoleSelectionScreen';
import UserStatusScreen from './screens/auth/UserStatusScreen';
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import OtpScreen from './screens/auth/OtpScreen';
import PublicBoardScreen from './screens/common/PublicBoardScreen';   // install56: no-login mandi board

// Farmer
import FarmerDashboard from './screens/farmer/FarmerDashboard';
import CropSelectionScreen from './screens/farmer/CropSelectionScreen';
import CentreSelectionScreen from './screens/farmer/CentreSelectionScreen';
import SlotSelectionScreen from './screens/farmer/SlotSelectionScreen';
import QuantityScreen from './screens/farmer/QuantityScreen';
import TokenConfirmationScreen from './screens/farmer/TokenConfirmationScreen';
import TokenDetailScreen from './screens/farmer/TokenDetailScreen';
import HistoryScreen from './screens/farmer/HistoryScreen';
import PaymentsScreen from './screens/farmer/PaymentsScreen';
import FarmerProfileScreen from './screens/farmer/FarmerProfileScreen';
import HelpScreen from './screens/common/HelpScreen';
import ChatbotScreen from './screens/common/ChatbotScreen';
import NotificationsScreen from './screens/common/NotificationsScreen';
import { NotificationProvider } from './notifications/NotificationContext';

// Officer & Trader portals
import OfficerStack from './navigation/OfficerStack';
import TraderStack from './navigation/TraderStack';
import ArhtiyaStack from './navigation/ArhtiyaStack';

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
      <AuthNav.Screen name="PublicBoard" component={PublicBoardScreen} />
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
      <FarmerNav.Screen name="Quantity" component={QuantityScreen} />
      <FarmerNav.Screen name="TokenConfirmation" component={TokenConfirmationScreen} />
      <FarmerNav.Screen name="TokenDetail" component={TokenDetailScreen} />
      <FarmerNav.Screen name="History" component={HistoryScreen} />
      <FarmerNav.Screen name="Payments" component={PaymentsScreen} />
      <FarmerNav.Screen name="FarmerProfile" component={FarmerProfileScreen} />
      <FarmerNav.Screen name="Help" component={HelpScreen} />
      <FarmerNav.Screen name="Chatbot" component={ChatbotScreen} />
      <FarmerNav.Screen name="Notifications" component={NotificationsScreen} />
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
  const [routeName, setRouteName] = useState(initialRoute);
  const syncRoute = () => setRouteName(navigationRef.getCurrentRoute()?.name || '');

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={{ height: 5, backgroundColor: Colors.primary }} />

      <View style={{ flex: 1 }}>
        <NavigationContainer ref={navigationRef} onReady={syncRoute} onStateChange={syncRoute}>
          <StatusBar style="dark" />
          <StopSpeechOnNavigate routeName={routeName} />
          <NotificationProvider navigationRef={navigationRef} routeName={routeName}>
            <Root.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
              <Root.Screen name="Auth" component={AuthStack} />
              <Root.Screen name="Farmer" component={FarmerStack} />
              <Root.Screen name="Officer" component={OfficerStack} />
              <Root.Screen name="Trader" component={TraderStack} />
              <Root.Screen name="Arhtiya" component={ArhtiyaStack} />
            </Root.Navigator>
            <GlobalLanguageModalHost />
          </NotificationProvider>
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
    /*
     * install26: load the icon font BEFORE showing any screen.
     * On the website the Ionicons font is fetched lazily, so icons showed
     * as empty boxes / question marks until it arrived (or never, on a slow
     * connection). Waiting here (max 4 s) fixes every screen at once.
     */
    const icons = Promise.race([
      Font.loadAsync(Ionicons.font),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]).catch(() => {});

    Promise.all([icons, restoreUserSession().catch(() => null)])
      .then(([, session]) => {
        if (session?.role === 'officer') setInitialRoute('Officer');
        else if (session?.role === 'trader') setInitialRoute('Trader');
        else if (session?.role === 'arhtiya') setInitialRoute('Arhtiya');
        else if (session?.role === 'farmer') setInitialRoute('Farmer');
      })
      .catch(() => {})
      .finally(() => setSessionReady(true));
  }, []);

  if (!sessionReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingScreen}>
          <Image source={LOGO_FULL} style={styles.logoImg} resizeMode="contain" />
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
  logoImg: { width: 220, height: 220, marginBottom: 12 },
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
