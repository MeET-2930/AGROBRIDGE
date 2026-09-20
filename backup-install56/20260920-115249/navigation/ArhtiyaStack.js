/*
 * navigation/ArhtiyaStack.js  (install55)
 * ---------------------------------------------------------------
 * The arhtiya (commission agent) is a "bulk farmer": he books passes
 * for the farmers linked to him, using the SAME planner screens the
 * farmer uses (CropSelection -> CentreSelection -> Quantity -> Slot ->
 * TokenConfirmation -> TokenDetail). Those screens read `forFarmer`
 * from the route params and otherwise behave exactly as for a farmer.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ArhtiyaDashboard from '../screens/arhtiya/ArhtiyaDashboard';
import MyFarmersScreen from '../screens/arhtiya/MyFarmersScreen';
import ArhtiyaProfileScreen from '../screens/arhtiya/ArhtiyaProfileScreen';

import CropSelectionScreen from '../screens/farmer/CropSelectionScreen';
import CentreSelectionScreen from '../screens/farmer/CentreSelectionScreen';
import QuantityScreen from '../screens/farmer/QuantityScreen';
import SlotSelectionScreen from '../screens/farmer/SlotSelectionScreen';
import TokenConfirmationScreen from '../screens/farmer/TokenConfirmationScreen';
import TokenDetailScreen from '../screens/farmer/TokenDetailScreen';

import HelpScreen from '../screens/common/HelpScreen';
import NotificationsScreen from '../screens/common/NotificationsScreen';

const Stack = createNativeStackNavigator();

export default function ArhtiyaStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ArhtiyaDashboard" component={ArhtiyaDashboard} />
      <Stack.Screen name="MyFarmers" component={MyFarmersScreen} />
      <Stack.Screen name="ArhtiyaProfile" component={ArhtiyaProfileScreen} />
      <Stack.Screen name="CropSelection" component={CropSelectionScreen} />
      <Stack.Screen name="CentreSelection" component={CentreSelectionScreen} />
      <Stack.Screen name="Quantity" component={QuantityScreen} />
      <Stack.Screen name="SlotSelection" component={SlotSelectionScreen} />
      <Stack.Screen name="TokenConfirmation" component={TokenConfirmationScreen} />
      <Stack.Screen name="TokenDetail" component={TokenDetailScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
