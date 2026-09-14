import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { useAppTheme } from '../hooks/useAppTheme';

export type AttachmentKind = 'gallery' | 'camera' | 'document';

interface Props {
  visible: boolean;
  onSelect: (kind: AttachmentKind) => void;
  onCancel: () => void;
}

const OPTIONS: Array<{
  kind: AttachmentKind;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}> = [
  { kind: 'gallery', icon: 'images', label: 'Gallery', color: '#7A5AF8' },
  { kind: 'camera', icon: 'camera', label: 'Camera', color: '#E8467C' },
  { kind: 'document', icon: 'document-text', label: 'Document', color: '#2F80ED' },
];

/**
 * Lets the user select the type of attachment to send.
 * Since the system alert box shows a maximum of three buttons, we use our
 * own modal; so "Cancel" is always visible.
 */
export default function AttachmentPicker({ visible, onSelect, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();

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
          <Text style={[styles.title, { color: theme.text }]}>What would you like to send?</Text>

          <View style={styles.options}>
            {OPTIONS.map((option) => (
              <Pressable
                key={option.kind}
                style={styles.option}
                onPress={() => onSelect(option.kind)}
              >
                <View style={[styles.iconCircle, { backgroundColor: option.color }]}>
                  <Ionicons name={option.icon} size={26} color="#FFFFFF" />
                </View>
                <Text style={[styles.optionLabel, { color: theme.text }]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={[styles.cancel, { backgroundColor: theme.background }]} onPress={onCancel}>
            <Text style={[styles.cancelText, { color: theme.textMuted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  options: { flexDirection: 'row', justifyContent: 'space-around' },
  option: { alignItems: 'center', gap: spacing.sm },
  iconCircle: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 14, color: colors.text },
  cancel: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  cancelText: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
});
