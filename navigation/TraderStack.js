import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TraderDashboard from '../screens/trader/TraderDashboard';
import AuctionBiddingScreen from '../screens/trader/AuctionBiddingScreen';
import MyPurchasesScreen from '../screens/trader/MyPurchasesScreen';

const Stack = createNativeStackNavigator();

export default function TraderStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TraderDashboard" component={TraderDashboard} />
      <Stack.Screen name="AuctionBidding" component={AuctionBiddingScreen} />
      <Stack.Screen name="MyPurchases" component={MyPurchasesScreen} />
    </Stack.Navigator>
  );
}