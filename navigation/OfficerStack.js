import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import OfficerDashboard from '../screens/officer/OfficerDashboard';
import TodaysQueueScreen from '../screens/officer/TodaysQueueScreen';
import StageQueueScreen from '../screens/officer/StageQueueScreen';
import OfficerProfileScreen from '../screens/officer/OfficerProfileScreen';
import AssayScreen from '../screens/officer/AssayScreen';
import WeighingScreen from '../screens/officer/WeighingScreen';
import MarkPaidScreen from '../screens/officer/MarkPaidScreen';
import DelayReportScreen from '../screens/officer/DelayReportScreen';
import ReportsScreen from '../screens/officer/ReportsScreen';
import GateRebookScreen from '../screens/officer/GateRebookScreen';
import GateScanScreen from '../screens/officer/GateScanScreen';
import EngineScreen from '../screens/officer/EngineScreen';
import HelpScreen from '../screens/common/HelpScreen';
import NotificationsScreen from '../screens/common/NotificationsScreen';

const Stack = createNativeStackNavigator();

export default function OfficerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OfficerDashboard" component={OfficerDashboard} />
      <Stack.Screen name="TodaysQueue" component={TodaysQueueScreen} />
      <Stack.Screen name="StageQueue" component={StageQueueScreen} />
      <Stack.Screen name="OfficerProfile" component={OfficerProfileScreen} />
      <Stack.Screen name="Assay" component={AssayScreen} />
      <Stack.Screen name="Weighing" component={WeighingScreen} />
      <Stack.Screen name="MarkPaid" component={MarkPaidScreen} />
      <Stack.Screen name="DelayReport" component={DelayReportScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="GateScan" component={GateScanScreen} />
      <Stack.Screen name="GateRebook" component={GateRebookScreen} />
      <Stack.Screen name="Engine" component={EngineScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
