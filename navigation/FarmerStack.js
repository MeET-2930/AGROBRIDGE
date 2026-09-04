import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FarmerDashboard from '../screens/farmer/FarmerDashboard';
import CropSelectionScreen from '../screens/farmer/CropSelectionScreen';
import CentreSelectionScreen from '../screens/farmer/CentreSelectionScreen';
import SlotSelectionScreen from '../screens/farmer/SlotSelectionScreen';
import TokenConfirmationScreen from '../screens/farmer/TokenConfirmationScreen';
import TokenDetailScreen from '../screens/farmer/TokenDetailScreen';
import PaymentsScreen from '../screens/farmer/PaymentsScreen';
import HistoryScreen from '../screens/farmer/HistoryScreen';

const Stack = createNativeStackNavigator();

export default function FarmerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FarmerDashboard" component={FarmerDashboard} />
      <Stack.Screen name="CropSelection" component={CropSelectionScreen} />
      <Stack.Screen name="CentreSelection" component={CentreSelectionScreen} />
      <Stack.Screen name="SlotSelection" component={SlotSelectionScreen} />
      <Stack.Screen name="TokenConfirmation" component={TokenConfirmationScreen} />
      <Stack.Screen name="TokenDetail" component={TokenDetailScreen} />
      <Stack.Screen name="Payments" component={PaymentsScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
    </Stack.Navigator>
  );
}