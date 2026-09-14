import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CallHistoryScreen from '../screens/CallHistoryScreen';
import MediaViewerScreen from '../screens/MediaViewerScreen';
import { useStartupColor } from '../hooks/useStartupColor';

export type RootStackParamList = {
  Login: undefined;
  ChatList: undefined;
  Chat: {
    chatId: string;
    title: string;
    isGroup: boolean;
    /** Profile picture and ID of the peer in one-on-one chat. */
    peerPhoto?: string | null;
    peerUid?: string;
  };
  Settings: undefined;
  CallHistory: undefined;
  MediaViewer: { url: string; kind: 'image' | 'video'; senderName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, initializing } = useAuth();
  const { palette } = useStartupColor();

  if (initializing) {
    return (
      <View style={[styles.splash, { backgroundColor: palette.dark }]}>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="ChatList" component={ChatListScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
            <Stack.Screen
              name="MediaViewer"
              component={MediaViewerScreen}
              options={{ animation: 'fade' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
