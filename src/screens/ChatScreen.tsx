import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { useCall } from '../contexts/CallContext';
import { useTranslation } from '../i18n/LanguageContext';
import { listOtherMembers } from '../services/calls';
import {
  FAMILY_CHAT_ID,
  ensureDirectChat,
  markMessagesAsRead,
  sendMediaMessage,
  sendTextMessage,
  clearChatForMe,
  subscribeToChatState,
  subscribeToMessages,
  unsendMessage,
} from '../services/chat';
import {
  MediaError,
  captureWithCamera,
  pickDocument,
  pickFromGallery,
  saveToGallery,
  uploadMedia,
  type PickedMedia,
} from '../services/media';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import MessageBubble from '../components/MessageBubble';
import Avatar from '../components/Avatar';
import ContactPicker, { type Contact } from '../components/ContactPicker';
import AttachmentPicker, { type AttachmentKind } from '../components/AttachmentPicker';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { CallType, Message } from '../types';
import { colors, fonts, radius, spacing } from '../theme';
import { useAppTheme } from '../hooks/useAppTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export default function ChatScreen({ navigation, route }: Props) {
  const { chatId, title, isGroup, peerPhoto, peerUid } = route.params;
  const { user, profile } = useAuth();
  const { startCall } = useCall();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  /** Which type of attachment is chosen when the picker is open. */
  const [attachOpen, setAttachOpen] = useState(false);
  const [callPicker, setCallPicker] = useState<{ type: CallType; contacts: Contact[] } | null>(
    null
  );
  /** Upload progress between 0-1 while media is uploading; null when not uploading. */
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const sendingRef = useRef(false);
  /** When did the user last clear this chat (messages before this are hidden). */
  const [clearedAt, setClearedAt] = useState<number | null>(null);

  const senderName = profile?.displayName || user?.displayName || t('chat.me');
  const settings = profile?.settings ?? {};
  const bubbleColor = settings.bubbleColor ?? undefined;

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!user || isGroup || !peerUid) return;
    // When entering a new user from the list screen, the chat might not be created yet.
    ensureDirectChat(user.uid, peerUid).catch((caught) =>
      console.warn('[chat] could not create direct chat', caught)
    );
  }, [user, isGroup, peerUid]);

  useEffect(() => {
    if (!user) return;
    return subscribeToChatState(chatId, user.uid, setClearedAt);
  }, [chatId, user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToMessages(
      chatId,
      (next) => {
        setMessages(next);
        setLoading(false);
        setError(null);
      },
      () => {
        setLoading(false);
        setError(t('chat.loadError'));
      }
    );
  }, [user, chatId, t]);

  /** Show messages that arrived after clearing the chat. */
  const visibleMessages = useMemo(() => {
    if (!clearedAt) return messages;
    return messages.filter((msg) => (msg.createdAt?.toMillis?.() ?? 0) > clearedAt);
  }, [messages, clearedAt]);

  // Mark unread messages from the other party as read.
  useEffect(() => {
    if (!user || messages.length === 0) return;
    const unread = messages
      .filter((message) => message.senderId !== user.uid && !message.readBy?.includes(user.uid))
      .map((message) => message.id);
    if (unread.length > 0) {
      markMessagesAsRead(chatId, unread, user.uid);
    }
  }, [messages, user, chatId]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !user || sendingRef.current) return;

    sendingRef.current = true;
    setDraft('');
    try {
      await sendTextMessage(chatId, { uid: user.uid, name: senderName }, text);
    } catch (caught) {
      console.warn('[chat] message could not be sent', caught);
      setDraft(text); // Don't lose the text that couldn't be sent.
      setError(t('chat.sendFailed'));
    } finally {
      sendingRef.current = false;
    }
  }, [draft, user, senderName, chatId, t]);

  /** Uploads the selected photo/video and adds it to the chat as a message. */
  const handleMedia = useCallback(
    async (pickFn: () => Promise<PickedMedia | null>) => {
      if (!user || uploadProgress !== null) return;

      let media: PickedMedia | null = null;
      try {
        media = await pickFn();
      } catch (caught) {
        Alert.alert(t('common.permissionRequired'), caught instanceof MediaError ? caught.message : t('chat.uploadFailed'));
        return;
      }
      if (!media) return;

      setUploadProgress(0);
      try {
        const uploaded = await uploadMedia(chatId, user.uid, media, setUploadProgress);
        await sendMediaMessage(
          chatId,
          { uid: user.uid, name: senderName },
          {
            url: uploaded.url,
            kind: media.kind,
            thumbUrl: uploaded.thumbUrl,
            fileName: media.fileName,
            fileSize: media.fileSize,
          }
        );
      } catch (caught) {
        console.warn('[chat] media could not be sent', caught);
        Alert.alert(
          t('common.error'),
          caught instanceof MediaError
            ? caught.message
            : t('chat.uploadFailed')
        );
      } finally {
        setUploadProgress(null);
      }
    },
    [user, senderName, uploadProgress, chatId, t]
  );

  const handleAttach = useCallback(() => setAttachOpen(true), []);

  const handleAttachChoice = useCallback(
    (kind: AttachmentKind) => {
      setAttachOpen(false);
      if (kind === 'gallery') handleMedia(pickFromGallery);
      else if (kind === 'camera') handleMedia(captureWithCamera);
      else handleMedia(pickDocument);
    },
    [handleMedia]
  );

  /** First asks who to call, then starts the call. */
  const handleCall = useCallback(
    async (type: CallType) => {
      if (!user) return;
      // In a direct chat, we know who we're calling, no need to ask.
      if (!isGroup && peerUid) {
        startCall({ uid: peerUid, name: title }, type);
        return;
      }

      try {
        const members = await listOtherMembers(FAMILY_CHAT_ID, user.uid);
        if (members.length === 0) {
          Alert.alert(
            t('chat.noOneToCall'),
            t('chat.noOneToCallHint')
          );
          return;
        }

        setCallPicker({ type, contacts: members });
      } catch (caught) {
        console.warn('[chat] contact list could not be retrieved', caught);
        Alert.alert(t('common.error'), t('chat.loadError'));
      }
    },
    [user, isGroup, peerUid, title, startCall, t]
  );

  /**
   * Options shown when a message is long-pressed.
   * Unsending is only possible for our own message and if the other party hasn't read it yet;
   * this rule is also enforced on the server side.
   */
  const handleMessageLongPress = useCallback(
    (msg: Message) => {
      if (!user) return;
      const isOwn = msg.senderId === user.uid;

      const isRead = !isOwn || (msg.readBy ?? []).some((reader) => reader !== user.uid);
      const isMedia = msg.type === 'image' || msg.type === 'video';

      const options: Array<{ text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }> =
        [];

      // Text messages can be copied to clipboard.
      if (msg.text) {
        options.push({
          text: t('common.copy'),
          onPress: async () => {
            await Clipboard.setStringAsync(msg.text);
          },
        });
      }

      if (isMedia && msg.mediaUrl) {
        options.push({
          text: t('chat.saveToGallery'),
          onPress: async () => {
            try {
              await saveToGallery(msg.mediaUrl!, msg.fileName ?? undefined);
              Alert.alert(t('common.saved'), t('chat.savedToAlbum'));
            } catch (caught) {
              Alert.alert(
                t('common.error'),
                caught instanceof MediaError ? caught.message : t('chat.saveFailed')
              );
            }
          },
        });
      }

      if (!isRead) {
        options.push({
          text: t('chat.unsend'),
          style: 'destructive',
          onPress: async () => {
            try {
              await unsendMessage(chatId, msg.id);
            } catch (caught) {
              console.warn('[chat] message could not be unsent', caught);
              Alert.alert(t('common.warning'), t('chat.cannotUnsend'));
            }
          },
        });
      }

      if (options.length === 0) {
        Alert.alert(t('common.warning'), t('chat.cannotUnsend'));
        return;
      }

      options.push({ text: t('common.cancel'), style: 'cancel' });
      Alert.alert(t('common.message'), isRead ? t('chat.cannotUnsend') : '', options);
    },
    [user, chatId, t]
  );

  /** Clears the chat only on this phone; it remains for the other party. */
  const handleClearChat = useCallback(() => {
    if (!user) return;
    Alert.alert(
      t('chat.clearChat'),
      t('chat.clearChatConfirm'),
      [
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => clearChatForMe(chatId, user.uid),
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  }, [chatId, user, t]);

  const openMedia = useCallback(
    (message: Message) => {
      if (!message.mediaUrl) return;

      // Documents are opened/downloaded in the phone's native app.
      if (message.type === 'file') {
        Linking.openURL(message.mediaUrl).catch(() =>
          Alert.alert(t('common.couldNotOpen'), t('common.noAppForDocument'))
        );
        return;
      }

      navigation.navigate('MediaViewer', {
        url: message.mediaUrl,
        kind: message.type === 'video' ? 'video' : 'image',
        senderName: message.senderName,
      });
    },
    [navigation]
  );

  const renderItem = useMemo(
    () =>
      ({ item }: { item: Message }) => (
        <MessageBubble
          message={item}
          isOwn={item.senderId === user?.uid}
          onOpenMedia={openMedia}
          ownColor={bubbleColor}
          onLongPress={handleMessageLongPress}
        />
      ),
    [user?.uid, openMedia, bubbleColor, handleMessageLongPress]
  );

  /** Message list or status indicator. */
  const messageArea = loading ? (
    <View style={styles.center}>
      <ActivityIndicator color={theme.accent} />
    </View>
  ) : visibleMessages.length === 0 ? (
    <View style={styles.center}>
      <Text style={[styles.emptyText, { color: theme.textMuted }]}>
        No messages yet. Be the first to write!
      </Text>
    </View>
  ) : (
    <FlatList
      data={visibleMessages}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      inverted
      contentContainerStyle={styles.listContent}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, backgroundColor: theme.headerBackground }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Avatar uri={peerPhoto} size={36} group={isGroup} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerButtons}>
          <Pressable onPress={() => handleCall('audio')} hitSlop={10}>
            <Ionicons name="call" size={22} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={() => handleCall('video')} hitSlop={10}>
            <Ionicons name="videocam" size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={handleClearChat} hitSlop={10}>
            <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={0}>
        {/* Chat background ONLY covers this area where messages are located. */}
        {theme.chatImage ? (
          <ImageBackground
            source={{ uri: theme.chatImage }}
            style={styles.flex}
            resizeMode="cover"
          >
            {messageArea}
          </ImageBackground>
        ) : (
          <View style={[styles.flex, { backgroundColor: theme.chatBackground ?? theme.background }]}>
            {messageArea}
          </View>
        )}

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

        {uploadProgress !== null ? (
          <View style={[styles.uploadBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <ActivityIndicator size="small" color={theme.accent} />
            <Text style={[styles.uploadText, { color: theme.text }]}>
              Sending… {Math.round(uploadProgress * 100)}%
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.composer,
            {
              paddingBottom: (keyboardVisible ? 0 : insets.bottom) + spacing.sm,
              backgroundColor: theme.surface,
              borderTopColor: theme.border,
            },
          ]}
        >
          <Pressable
            onPress={handleAttach}
            hitSlop={8}
            style={styles.attachButton}
            disabled={uploadProgress !== null}
          >
            <Ionicons
              name="add-circle"
              size={34}
              color={uploadProgress !== null ? theme.border : theme.accent}
            />
          </Pressable>

          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
            placeholder={t('chat.typeMessage')}
            placeholderTextColor={theme.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: theme.accent },
              !draft.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!draft.trim()}
          >
            <Text style={styles.sendButtonText}>{t('common.send')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <AttachmentPicker
        visible={attachOpen}
        onSelect={handleAttachChoice}
        onCancel={() => setAttachOpen(false)}
      />

      {callPicker ? (
        <ContactPicker
          visible
          type={callPicker.type}
          contacts={callPicker.contacts}
          onSelect={(contact) => {
            setCallPicker(null);
            startCall({ uid: contact.uid, name: contact.displayName }, callPicker.type);
          }}
          onCancel={() => setCallPicker(null)}
        />
      ) : null}
    </View>
  );
}

/** Common height for buttons and boxes in the composer area. */
const COMPOSER_HEIGHT = 46;

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontFamily: fonts.semiBold, flex: 1 },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  listContent: { padding: spacing.md, flexGrow: 1 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  errorBanner: {
    backgroundColor: '#FDECEA',
    color: colors.danger,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    fontSize: 13,
  },
  uploadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  uploadText: { color: colors.text, fontSize: 13 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  // Common size so that all three items in the composer area have the same height.
  attachButton: {
    width: COMPOSER_HEIGHT,
    height: COMPOSER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: COMPOSER_HEIGHT,
    maxHeight: 120,
    borderRadius: COMPOSER_HEIGHT / 2,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'center',
  },
  sendButton: {
    height: COMPOSER_HEIGHT,
    minWidth: 84,
    borderRadius: COMPOSER_HEIGHT / 2,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
});
