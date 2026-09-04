import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthStack from './AuthStack';
import FarmerStack from './FarmerStack';
import OfficerStack from './OfficerStack';
import TraderStack from './TraderStack';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Auth">
      <Stack.Screen name="Auth" component={AuthStack} />
      <Stack.Screen name="Farmer" component={FarmerStack} />
      <Stack.Screen name="Officer" component={OfficerStack} />
      <Stack.Screen name="Trader" component={TraderStack} />
    </Stack.Navigator>
  );
}