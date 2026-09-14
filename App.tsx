import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LanguageProvider } from './src/i18n/LanguageContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { CallProvider, useCall } from './src/contexts/CallContext';
import RootNavigator from './src/navigation/RootNavigator';
import { useStartupColor } from './src/hooks/useStartupColor';
import CallScreen from './src/screens/CallScreen';
import IncomingCallOverlay from './src/screens/IncomingCallOverlay';

/**
 * Call screen is kept outside navigation: a call can arrive no matter which screen we are on
 * and must appear on top of everything.
 */
function AppShell() {
  const { activeCall, incomingCall, acceptIncoming, rejectIncoming, closeActiveCall } = useCall();

  if (activeCall) {
    return (
      <CallScreen
        callId={activeCall.callId}
        isCaller={activeCall.isCaller}
        type={activeCall.type}
        peerName={activeCall.peerName}
        onClose={closeActiveCall}
      />
    );
  }

  return (
    <>
      <RootNavigator />
      {incomingCall ? (
        <IncomingCallOverlay
          call={incomingCall}
          onAccept={acceptIncoming}
          onReject={rejectIncoming}
        />
      ) : null}
    </>
  );
}

export default function App() {
  // We don't render the screen until the font used in the title is ready so
  // the font doesn't change abruptly later.
  const [fontsLoaded] = useFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const { palette, ready: colorReady } = useStartupColor();

  if (!fontsLoaded || !colorReady) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.dark,
        }}
      >
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }

  return (
    // Outermost wrapper for gestures like pinch-to-zoom to work.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <AuthProvider>
            <CallProvider>
              <StatusBar style="light" />
              <AppShell />
            </CallProvider>
          </AuthProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
