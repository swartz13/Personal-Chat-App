import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallSession, type CallPhase } from '../hooks/useCallSession';
import { useTranslation } from '../i18n/LanguageContext';
import type { CallType } from '../types';
import { colors, radius, spacing } from '../theme';

interface Props {
  callId: string;
  /** Are we the caller? */
  isCaller: boolean;
  type: CallType;
  /** Peer's display name. */
  peerName: string;
  /** Called when the call ends and the screen is about to close. */
  onClose: () => void;
}

/** Round control button. */
function ControlButton({
  icon,
  onPress,
  active = true,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.controlButton,
        !active && styles.controlButtonOff,
        danger && styles.controlButtonDanger,
      ]}
      hitSlop={8}
    >
      <Ionicons name={icon} size={26} color="#FFFFFF" />
    </Pressable>
  );
}

/** PIP window dimensions. */
const PIP_WIDTH = 110;
const PIP_HEIGHT = 160;

export default function CallScreen({ callId, isCaller, type, peerName, onClose }: Props) {
  // Prevents the screen from sleeping during the call.
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  /** Is the remote peer shown on the large screen? Changes when the PIP window is tapped. */
  const [isRemoteLarge, setIsRemoteLarge] = useState(true);

  function getStatusText(phase: CallPhase, caller: boolean) {
    switch (phase) {
      case 'preparing':
        return t('call.preparing');
      case 'ringing':
        return caller ? t('call.ringing') : t('call.connecting');
      case 'connecting':
        return t('call.connecting');
      case 'connected':
        return null;
      case 'ended':
        return t('call.ended');
    }
  }

  // PIP window is draggable; starts at top right.
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lastPosition = useRef({ x: 0, y: 0 });
  const moveDistance = useRef(0);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3,
        onPanResponderGrant: () => {
          moveDistance.current = 0;
          pan.setOffset(lastPosition.current);
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: (e, gestureState) => {
          moveDistance.current = Math.abs(gestureState.dx) + Math.abs(gestureState.dy);
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        },
        onPanResponderRelease: (_, gestureState) => {
          pan.flattenOffset();
          // Keep the window within screen bounds.
          const window = Dimensions.get('window');
          const minX = -(window.width - PIP_WIDTH - spacing.lg * 2);
          const maxY = window.height - PIP_HEIGHT - 220;

          const newX = Math.min(0, Math.max(minX, lastPosition.current.x + gestureState.dx));
          const newY = Math.min(maxY, Math.max(0, lastPosition.current.y + gestureState.dy));

          lastPosition.current = { x: newX, y: newY };
          Animated.spring(pan, {
            toValue: lastPosition.current,
            useNativeDriver: false,
            friction: 7,
          }).start();
        },
      }),
    [pan]
  );

  const {
    localStream,
    remoteStream,
    phase,
    error,
    micEnabled,
    cameraEnabled,
    toggleMic,
    toggleCamera,
    switchCamera,
    hangUp,
  } = useCallSession({ callId, isCaller, type });

  // Close the screen shortly after the call ends.
  useEffect(() => {
    if (phase !== 'ended') return;
    const timer = setTimeout(onClose, 1200);
    return () => clearTimeout(timer);
  }, [phase, onClose]);

  const statusText = getStatusText(phase, isCaller);
  const isVideo = type === 'video';
  const hasRemoteVideo = isVideo && remoteStream;

  // Stream shown on the large screen; the other in the PIP window.
  const mainStream = isRemoteLarge ? remoteStream : localStream;
  const pipStream = !isVideo
    ? null
    : isRemoteLarge
      ? cameraEnabled
        ? localStream
        : null
      : remoteStream;

  return (
    <View style={styles.container}>
      {hasRemoteVideo ? (
        <RTCView
          streamURL={(mainStream as any).toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={!isRemoteLarge}
          // Do NOT provide zOrder for the large video: a value of 0 on Android
          // puts the video behind the window and the opaque background covers it.
        />
      ) : (
        <View style={styles.placeholder}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{peerName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.peerName}>{peerName}</Text>
          {statusText ? <Text style={styles.status}>{statusText}</Text> : null}
          {phase === 'ringing' || phase === 'connecting' ? (
            <ActivityIndicator color="#FFFFFF" style={{ marginTop: spacing.md }} />
          ) : null}
        </View>
      )}

      {/* Top info bar when remote peer is shown in video call */}
      {hasRemoteVideo ? (
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.topBarName}>{peerName}</Text>
        </View>
      ) : null}

      {/* PIP window: draggable, swaps with large screen on tap */}
      {isVideo && pipStream ? (
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.selfView,
            { top: insets.top + spacing.xl * 2 },
            { transform: pan.getTranslateTransform() },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              // Prevent accidental swap during dragging.
              if (moveDistance.current < 8) setIsRemoteLarge((prev) => !prev);
            }}
          >
            <RTCView
              streamURL={(pipStream as any).toURL()}
              style={StyleSheet.absoluteFill}
              objectFit="cover"
              mirror={isRemoteLarge}
              // On Android, PIP window stays behind when video layers overlap;
              // a higher zOrder brings it to the front.
              zOrder={1}
            />
          </Pressable>
        </Animated.View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.lg }]}>
        <ControlButton
          icon={micEnabled ? 'mic' : 'mic-off'}
          onPress={toggleMic}
          active={micEnabled}
        />
        {isVideo ? (
          <ControlButton
            icon={cameraEnabled ? 'videocam' : 'videocam-off'}
            onPress={toggleCamera}
            active={cameraEnabled}
          />
        ) : null}
        {isVideo ? <ControlButton icon="camera-reverse" onPress={switchCamera} /> : null}
        <ControlButton icon="call" onPress={hangUp} danger />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B141A' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
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
  peerName: { color: '#FFFFFF', fontSize: 24, fontWeight: '600' },
  status: { color: 'rgba(255,255,255,0.7)', fontSize: 16 },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  topBarName: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  selfView: {
    position: 'absolute',
    right: spacing.lg,
    width: 110,
    height: 160,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#1F2C34',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  errorBox: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 140,
    backgroundColor: 'rgba(217,48,37,0.92)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: '#FFFFFF', textAlign: 'center', fontSize: 14 },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonOff: { backgroundColor: 'rgba(255,255,255,0.45)' },
  controlButtonDanger: { backgroundColor: colors.danger, transform: [{ rotate: '135deg' }] },
});
