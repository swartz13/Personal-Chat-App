import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../i18n/LanguageContext';
import { colors, radius, spacing } from '../theme';
import { useAppTheme } from '../hooks/useAppTheme';
import type { CallType } from '../types';

export interface Contact {
  uid: string;
  displayName: string;
}

interface Props {
  visible: boolean;
  type: CallType;
  contacts: Contact[];
  onSelect: (contact: Contact) => void;
  onCancel: () => void;
}

export default function ContactPicker({ visible, type, contacts, onSelect, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing.lg, backgroundColor: theme.surface },
          ]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <Ionicons
              name={type === 'video' ? 'videocam' : 'call'}
              size={20}
              color={theme.accent}
            />
            <Text style={[styles.title, { color: theme.text }]}>
              {type === 'video' ? t('contactPicker.videoCall') : t('contactPicker.voiceCall')}
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{t('contactPicker.whoToCall')}</Text>

          {contacts.map((contact) => (
            <Pressable
              key={contact.uid}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => onSelect(contact)}
            >
              <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
                <Text style={styles.avatarText}>
                  {contact.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.name, { color: theme.text }]}>{contact.displayName}</Text>
            </Pressable>
          ))}

          <Pressable style={[styles.cancel, { backgroundColor: theme.background }]} onPress={onCancel}>
            <Text style={[styles.cancelText, { color: theme.textMuted }]}>{t('common.cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  rowPressed: { backgroundColor: colors.background },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  name: { fontSize: 16, color: colors.text, fontWeight: '500' },
  cancel: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  cancelText: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
});
