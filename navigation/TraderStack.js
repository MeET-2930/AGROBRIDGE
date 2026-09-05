import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import TraderDashboard from '../screens/trader/TraderDashboard';
import AuctionBoardScreen from '../screens/trader/AuctionBoardScreen';
import AuctionBiddingScreen from '../screens/trader/AuctionBiddingScreen';
import MyPurchasesScreen from '../screens/trader/MyPurchasesScreen';
import TraderProfileScreen from '../screens/trader/TraderProfileScreen';

const Stack = createNativeStackNavigator();

export default function TraderStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TraderDashboard" component={TraderDashboard} />
      <Stack.Screen name="AuctionBoard" component={AuctionBoardScreen} />
      <Stack.Screen name="AuctionBidding" component={AuctionBiddingScreen} />
      <Stack.Screen name="MyPurchases" component={MyPurchasesScreen} />
      <Stack.Screen name="TraderProfile" component={TraderProfileScreen} />
    </Stack.Navigator>
  );
}
