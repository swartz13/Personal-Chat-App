import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { formatFileSize } from '../services/media';
import { RichText } from '../utils/richText';
import { useTranslation } from '../i18n/LanguageContext';
import type { Message } from '../types';
import { colors, radius, spacing } from '../theme';

/** Converts Firestore timestamp to "14:32" format. */
function formatTime(message: Message) {
  const date = message.createdAt?.toDate?.();
  if (!date) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  message: Message;
  isOwn: boolean;
  /** To show full screen when a photo or video is tapped. */
  onOpenMedia: (message: Message) => void;
  /** The own bubble color the user selected from settings. */
  ownColor?: string;
  /** When a message is long pressed (for undo / save options). */
  onLongPress?: (message: Message) => void;
}

export default function MessageBubble({
  message,
  isOwn,
  onOpenMedia,
  ownColor,
  onLongPress,
}: Props) {
  const { t } = useTranslation();
  const isMedia = message.type === 'image' || message.type === 'video';
  const isFile = message.type === 'file';

  return (
    <View style={[styles.row, isOwn ? styles.rowEnd : styles.rowStart]}>
      <Pressable
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={350}
        style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
          isOwn && ownColor ? { backgroundColor: ownColor } : null,
          isMedia && styles.bubbleMedia,
        ]}
      >
        {!isOwn && <Text style={styles.senderName}>{message.senderName}</Text>}

        {message.type === 'image' && message.mediaUrl ? (
          <Pressable onPress={() => onOpenMedia(message)}>
            <Image
              source={{ uri: message.mediaUrl }}
              style={styles.image}
              contentFit="cover"
              transition={150}
            />
          </Pressable>
        ) : null}

        {message.type === 'video' && message.mediaUrl ? (
          <Pressable onPress={() => onOpenMedia(message)} style={styles.videoBox}>
            {message.thumbUrl ? (
              <Image
                source={{ uri: message.thumbUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={150}
              />
            ) : null}
            <View style={styles.playCircle}>
              <Ionicons name="play" size={28} color="#FFFFFF" />
            </View>
          </Pressable>
        ) : null}

        {isFile && message.mediaUrl ? (
          <Pressable onPress={() => onOpenMedia(message)} style={styles.fileRow}>
            <View style={styles.fileIcon}>
              <Ionicons name="document-text" size={22} color={colors.primary} />
            </View>
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={2}>
                {message.fileName || t('chat.document')}
              </Text>
              <Text style={styles.fileSize}>{formatFileSize(message.fileSize)}</Text>
            </View>
            <Ionicons name="download-outline" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {message.text ? <RichText text={message.text} style={styles.text} /> : null}

        <Text style={[styles.time, isMedia && styles.timeOnMedia]}>{formatTime(message)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: spacing.sm },
  rowStart: { justifyContent: 'flex-start' },
  rowEnd: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMedia: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  bubbleOwn: { backgroundColor: colors.bubbleOwn, borderTopRightRadius: radius.sm },
  bubbleOther: { backgroundColor: colors.bubbleOther, borderTopLeftRadius: radius.sm },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
    marginHorizontal: spacing.xs,
  },
  image: {
    width: 220,
    height: 220,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  videoBox: {
    width: 220,
    height: 160,
    borderRadius: radius.sm,
    backgroundColor: '#1F2C34',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  text: { fontSize: 16, color: colors.text, marginHorizontal: spacing.xs },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 200,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: { flex: 1, gap: 2 },
  fileName: { fontSize: 15, fontWeight: '500', color: colors.text },
  fileSize: { fontSize: 12, color: colors.textMuted },
  time: {
    fontSize: 11,
    color: colors.textMuted,
    alignSelf: 'flex-end',
    marginTop: 2,
    marginHorizontal: spacing.xs,
  },
  timeOnMedia: { marginTop: spacing.xs },
});
