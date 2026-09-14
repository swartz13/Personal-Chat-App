import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { collection, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { directChatId, subscribeToChats } from '../services/chat';
import Avatar from '../components/Avatar';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { Chat, FamilyUser } from '../types';
import { colors, fonts, radius, spacing } from '../theme';
import { useAppTheme } from '../hooks/useAppTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

/** Row to display in the list: an existing chat or a user not yet chatted with. */
interface ChatListItem {
  key: string;
  chatId: string;
  peerUid?: string;
  title: string;
  subtitle: string;
  time: string;
  isGroup: boolean;
  photo?: string | null;
}

function formatTime(at: any) {
  const date = at?.toDate?.();
  if (!date) return '';
  const today = new Date();
  const isSameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  return isSameDay
    ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
}

export default function ChatListScreen({ navigation }: Props) {
  const { user } = useAuth();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<FamilyUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return subscribeToChats(user.uid, (incomingChats) => {
      setChats(incomingChats);
      setLoading(false);
    });
  }, [user]);

  // User list to be able to show contact names and profile pictures.
  useEffect(() => {
    return onSnapshot(
      collection(db, 'users'),
      (snapshot) => setUsers(snapshot.docs.map((d) => d.data() as FamilyUser)),
      (error) => console.warn('[list] failed to get users', error)
    );
  }, []);

  const items = useMemo<ChatListItem[]>(() => {
    if (!user) return [];

    const usersMap = new Map(users.map((u) => [u.uid, u]));
    const result: ChatListItem[] = [];
    const covered = new Set<string>();

    for (const chat of chats) {
      if (chat.type === 'group') {
        result.push({
          key: chat.id,
          chatId: chat.id,
          title: chat.name || 'Family Group',
          subtitle: chat.lastMessage
            ? `${chat.lastMessage.senderName}: ${chat.lastMessage.text}`
            : 'No messages yet',
          time: formatTime(chat.lastMessage?.at),
          isGroup: true,
        });
        continue;
      }

      const otherUid = chat.members.find((m) => m !== user.uid);
      if (!otherUid) continue;
      covered.add(otherUid);
      const contact = usersMap.get(otherUid);

      result.push({
        key: chat.id,
        chatId: chat.id,
        peerUid: otherUid,
        title: contact?.displayName || 'Family member',
        subtitle: chat.lastMessage?.text || 'No messages yet',
        time: formatTime(chat.lastMessage?.at),
        isGroup: false,
        photo: contact?.photoURL,
      });
    }

    // Users with whom no chat has been started should also appear in the list.
    for (const contact of users) {
      if (contact.uid === user.uid || covered.has(contact.uid)) continue;
      result.push({
        key: `new_${contact.uid}`,
        chatId: directChatId(user.uid, contact.uid),
        peerUid: contact.uid,
        title: contact.displayName || 'Family member',
        subtitle: 'Start chat',
        time: '',
        isGroup: false,
        photo: contact.photoURL,
      });
    }

    return result;
  }, [chats, users, user]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, backgroundColor: theme.headerBackground }]}>
        <Text style={styles.headerTitle}>Family</Text>
        <View style={styles.headerButtons}>
          <Pressable onPress={() => navigation.navigate('CallHistory')} hitSlop={10}>
            <Ionicons name="time-outline" size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={10}>
            <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.surface, borderColor: theme.border },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() =>
                navigation.navigate('Chat', {
                  chatId: item.chatId,
                  title: item.title,
                  isGroup: item.isGroup,
                  peerPhoto: item.photo,
                  peerUid: item.peerUid,
                })
              }
            >
              <Avatar uri={item.photo} size={52} group={item.isGroup} />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.rowSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>
              {item.time ? (
                <Text style={[styles.rowTime, { color: theme.textMuted }]}>{item.time}</Text>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 24, fontFamily: fonts.bold, letterSpacing: 0.3 },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  list: { paddingVertical: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 17, fontFamily: fonts.semiBold, color: colors.text },
  rowSubtitle: { fontSize: 14, color: colors.textMuted },
  rowTime: { fontSize: 12, color: colors.textMuted },
});
