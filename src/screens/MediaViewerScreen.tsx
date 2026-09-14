import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MediaViewer'>;

/** Maximum allowed zoom scale. */
const MAX_SCALE = 5;

/**
 * Image that can be zoomed and panned with fingers.
 * Zoomed with two fingers, panned with one, double tap to zoom in/out.
 * Automatically resets position when released if zoom is close to 1.
 */
function ZoomableImage({ url }: { url: string }) {
  const scale = useSharedValue(1);
  const previousScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const previousX = useSharedValue(0);
  const previousY = useSharedValue(0);

  /** Resets image to its initial position. */
  function reset() {
    'worklet';
    scale.value = withTiming(1);
    previousScale.value = 1;
    x.value = withTiming(0);
    y.value = withTiming(0);
    previousX.value = 0;
    previousY.value = 0;
  }

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const newScale = previousScale.value * event.scale;
      scale.value = Math.min(Math.max(newScale, 0.6), MAX_SCALE);
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        reset();
        return;
      }
      previousScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow panning while zoomed in.
      if (scale.value <= 1) return;
      x.value = previousX.value + event.translationX;
      y.value = previousY.value + event.translationY;
    })
    .onEnd(() => {
      previousX.value = x.value;
      previousY.value = y.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.02) {
        reset();
        return;
      }
      scale.value = withTiming(2.5);
      previousScale.value = 2.5;
    });

  const gestures = Gesture.Simultaneous(pinch, pan, doubleTap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gestures}>
      <Animated.View style={[styles.media, style]}>
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
      </Animated.View>
    </GestureDetector>
  );
}

export default function MediaViewerScreen({ route, navigation }: Props) {
  const { url, kind, senderName } = route.params;
  const insets = useSafeAreaInsets();

  // Set up video player only when a video is opened.
  const player = useVideoPlayer(kind === 'video' ? url : null, (playerInstance) => {
    playerInstance.loop = false;
    playerInstance.play();
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerTexts}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {senderName}
          </Text>
          {kind === 'image' ? (
            <Text style={styles.headerHint}>Pinch to zoom</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.content}>
        {kind === 'image' ? (
          <ZoomableImage url={url} />
        ) : (
          <VideoView
            player={player}
            style={styles.media}
            contentFit="contain"
            nativeControls
            allowsPictureInPicture={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: { padding: spacing.xs },
  headerTexts: { flex: 1 },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  headerHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  media: { width: '100%', height: '80%' },
});
