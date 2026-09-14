import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Call } from '../types';
import { colors, spacing } from '../theme';

interface Props {
  call: Call;
  onAccept: () => void;
  onReject: () => void;
}

/** Incoming call screen: displayed full screen over any screen. */
/** Phone ring pattern: vibrate one sec, wait a bit, repeat. */
const VIBRATION_PATTERN = [0, 900, 700, 900, 700];

export default function IncomingCallOverlay({ call, onAccept, onReject }: Props) {
  const insets = useSafeAreaInsets();
  const isVideo = call.type === 'video';
  /**
   * The application does not play the ringtone itself: the call notification
   * plays the phone's own ringtone from the RING channel. Thus, the volume,
   * silent mode, and do not disturb settings comply with the phone's own rules.
   * We only provide vibration here.
   */
  useEffect(() => {
    Vibration.vibrate(VIBRATION_PATTERN, true);
    return () => Vibration.cancel();
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]}>
      <View style={[styles.content, { paddingTop: insets.top + spacing.xl * 2 }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{call.callerName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{call.callerName}</Text>
        <Text style={styles.subtitle}>
          {isVideo ? 'Video call is calling…' : 'Voice call is calling…'}
        </Text>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.action}>
          <Pressable style={[styles.button, styles.reject]} onPress={onReject} hitSlop={8}>
            <Ionicons name="call" size={30} color="#FFFFFF" style={styles.rejectIcon} />
          </Pressable>
          <Text style={styles.actionLabel}>Reject</Text>
        </View>

        <View style={styles.action}>
          <Pressable style={[styles.button, styles.accept]} onPress={onAccept} hitSlop={8}>
            <Ionicons name={isVideo ? 'videocam' : 'call'} size={30} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.actionLabel}>Accept</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0B141A', justifyContent: 'space-between', zIndex: 100 },
  content: { alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  avatarText: { color: '#FFFFFF', fontSize: 48, fontWeight: '700' },
  name: { color: '#FFFFFF', fontSize: 26, fontWeight: '600' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 16 },
  actions: { flexDirection: 'row', justifyContent: 'space-evenly' },
  action: { alignItems: 'center', gap: spacing.sm },
  button: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  accept: { backgroundColor: colors.accent },
  reject: { backgroundColor: colors.danger },
  rejectIcon: { transform: [{ rotate: '135deg' }] },
  actionLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
});
