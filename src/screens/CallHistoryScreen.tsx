import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { collection, onSnapshot, or, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import { deleteCallRecord } from '../services/calls';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { Call } from '../types';
import { colors, fonts, radius, spacing } from '../theme';
import { useAppTheme } from '../hooks/useAppTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'CallHistory'>;

function formatDate(at: any) {
  const date = at?.toDate?.();
  if (!date) return '';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CallHistoryScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  function formatDuration(seconds: number) {
    if (seconds <= 0) return '—';
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    if (minutes === 0) return t('history.seconds', { count: remaining });
    return t('history.minutesSeconds', { m: minutes, s: remaining });
  }

  useEffect(() => {
    if (!user) return;

    // Both outgoing and incoming calls.
    const q = query(
      collection(db, 'calls'),
      or(where('callerId', '==', user.uid), where('calleeId', '==', user.uid))
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Call)
          .filter((call) => call.status !== 'ringing')
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setCalls(records);
        setLoading(false);
      },
      (error) => {
        console.warn('[history] failed to get calls', error);
        setLoading(false);
      }
    );
  }, [user]);

  /** Prompts to delete from history on long press. */
  function deleteRecord(callId: string, peerName: string) {
    Alert.alert(t('history.deleteTitle'), t('history.deleteConfirm', { name: peerName }), [
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCallRecord(callId);
          } catch (error) {
            console.warn('[history] failed to delete record', error);
            Alert.alert(t('common.error'), t('common.error'));
          }
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  const rows = useMemo(
    () =>
      calls.map((call) => {
        const isOutgoing = call.callerId === user?.uid;
        const peerName = isOutgoing ? call.calleeName : call.callerName;
        const acceptedTime = (call as any).acceptedAt?.toMillis?.();
        const endedTime = call.endedAt?.toMillis?.();
        const durationSeconds =
          acceptedTime && endedTime ? Math.round((endedTime - acceptedTime) / 1000) : 0;

        return {
          id: call.id,
          peerName,
          isOutgoing,
          isVideo: call.type === 'video',
          isMissed: call.status === 'rejected' || call.status === 'missed' || durationSeconds === 0,
          date: formatDate(call.createdAt),
          duration: formatDuration(durationSeconds),
        };
      }),
    [calls, user, t]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, backgroundColor: theme.headerBackground }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('history.title')}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: theme.textMuted }]}>{t('history.noCalls')}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          ListHeaderComponent={
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              {t('history.holdToDelete')}
            </Text>
          }
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.surface, borderColor: theme.border },
                pressed && { opacity: 0.7 },
              ]}
              onLongPress={() => deleteRecord(item.id, item.peerName)}
              delayLongPress={350}
            >
              <View
                style={[
                  styles.iconCircle,
                  item.isMissed ? styles.iconMissed : { backgroundColor: theme.accent },
                ]}
              >
                <Ionicons
                  name={item.isVideo ? 'videocam' : 'call'}
                  size={18}
                  color="#FFFFFF"
                />
              </View>

              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{item.peerName}</Text>
                <View style={styles.rowMeta}>
                  <Ionicons
                    name={item.isOutgoing ? 'arrow-up-outline' : 'arrow-down-outline'}
                    size={13}
                    color={item.isMissed ? colors.danger : colors.textMuted}
                  />
                  <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                    {item.isOutgoing ? t('history.outgoing') : t('history.incoming')} · {item.date}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.duration,
                  { color: theme.textMuted },
                  item.isMissed && styles.durationMissed,
                ]}
              >
                {item.isMissed ? t('history.missed') : item.duration}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  empty: { color: colors.textMuted, fontSize: 15 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontFamily: fonts.semiBold },
  list: { paddingVertical: spacing.md },
  hint: { fontSize: 12, textAlign: 'center', paddingBottom: spacing.sm },
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
  iconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  iconDone: { backgroundColor: colors.primary },
  iconMissed: { backgroundColor: colors.danger },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.text },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowSubtitle: { fontSize: 13, color: colors.textMuted },
  duration: { fontSize: 13, color: colors.textMuted },
  durationMissed: { color: colors.danger, fontWeight: '600' },
});
