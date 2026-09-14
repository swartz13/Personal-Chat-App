import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n/LanguageContext';
import Avatar from '../components/Avatar';
import {
  APP_COLOR_PRESETS,
  BACKGROUND_PRESETS,
  BUBBLE_PRESETS,
  isImageBackground,
  removePhoto,
  updateDisplayName,
  updatePhoto,
  updateSettings,
} from '../services/profile';
import { MediaError, pickFromGallery, uploadMedia } from '../services/media';
import { CALL_CHANNEL, MESSAGE_CHANNEL } from '../services/notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { SupportedLanguage } from '../types';
import { colors, fonts, radius, spacing } from '../theme';
import { useAppTheme } from '../hooks/useAppTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

/** Section with title separating settings groups. */
function Section({
  title,
  children,
  surface,
  titleColor,
}: {
  title: string;
  children: React.ReactNode;
  surface: string;
  titleColor: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: titleColor }]}>{title}</Text>
      <View style={[styles.sectionBody, { backgroundColor: surface }]}>{children}</View>
    </View>
  );
}

export default function SettingsScreen({ navigation }: Props) {
  const { user, profile, logOut } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const [nickname, setNickname] = useState(profile?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  const settings = profile?.settings ?? {};
  const background = settings.chatBackground ?? 'default';
  const appColor = settings.appColor ?? 'green';
  const bubbleColor = settings.bubbleColor ?? BUBBLE_PRESETS[0].color;

  // Sync saved profile language on load if different
  useEffect(() => {
    if (profile?.settings?.language && profile.settings.language !== language) {
      setLanguage(profile.settings.language);
    }
  }, [profile?.settings?.language]);

  async function saveNickname() {
    if (!user || nickname.trim() === profile?.displayName) return;
    setSaving(true);
    try {
      await updateDisplayName(user.uid, nickname);
    } catch (error: any) {
      Alert.alert(t('common.error'), error?.message ?? t('common.error'));
      setNickname(profile?.displayName ?? '');
    } finally {
      setSaving(false);
    }
  }

  async function pickPhoto() {
    if (!user) return;
    try {
      const media = await pickFromGallery();
      if (!media) return;
      if (media.kind !== 'image') {
        Alert.alert(t('settings.photosOnly'), t('settings.videoNotAllowed'));
        return;
      }
      setPhotoLoading(true);
      await updatePhoto(user.uid, media);
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof MediaError ? error.message : t('common.error')
      );
    } finally {
      setPhotoLoading(false);
    }
  }

  function handlePhotoTap() {
    if (!profile?.photoURL) {
      pickPhoto();
      return;
    }
    Alert.alert(t('settings.profilePhoto'), '', [
      { text: t('settings.change'), onPress: pickPhoto },
      {
        text: t('settings.remove'),
        style: 'destructive',
        onPress: () => user && removePhoto(user.uid),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  /**
   * Lets user select notification sounds from the phone's native settings screen.
   */
  async function selectSound(channel: string, title: string) {
    if (Platform.OS !== 'android') return;
    const pkg = Constants.expoConfig?.android?.package ?? 'com.aile.sohbet';

    try {
      await IntentLauncher.startActivityAsync(
        'android.settings.CHANNEL_NOTIFICATION_SETTINGS',
        {
          extra: {
            'android.provider.extra.APP_PACKAGE': pkg,
            'android.provider.extra.CHANNEL_ID': channel,
          },
        }
      );
    } catch (error) {
      console.warn('[settings] could not open sound screen', error);
      Alert.alert(title, t('settings.soundHint'));
    }
  }

  async function pickBackgroundImage() {
    if (!user) return;
    try {
      const media = await pickFromGallery();
      if (!media || media.kind !== 'image') return;
      setPhotoLoading(true);
      const { url } = await uploadMedia('background', user.uid, media);
      await updateSettings(user.uid, { ...settings, chatBackground: url });
    } catch (error) {
      Alert.alert(t('common.error'), t('chat.uploadFailed'));
    } finally {
      setPhotoLoading(false);
    }
  }

  const languagesList: Array<{ key: SupportedLanguage; label: string }> = [
    { key: 'tr', label: 'Türkçe' },
    { key: 'en', label: 'English' },
    { key: 'ru', label: 'Русский' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, backgroundColor: theme.headerBackground }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl * 3 }]}>
        {/* Profile */}
        <View style={styles.profile}>
          <Pressable onPress={handlePhotoTap} style={styles.avatarWrapper}>
            <Avatar uri={profile?.photoURL} size={96} />
            <View style={[styles.cameraBadge, { backgroundColor: theme.accent, borderColor: theme.background }]}>
              {photoLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              )}
            </View>
          </Pressable>
          <Text style={[styles.email, { color: theme.textMuted }]}>{user?.email}</Text>
        </View>

        <Section title={t('settings.nickname')} surface={theme.surface} titleColor={theme.textMuted}>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            {t('settings.nicknameHint')}
          </Text>
          <View style={styles.nicknameRow}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('settings.nicknamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              maxLength={24}
              onBlur={saveNickname}
              onSubmitEditing={saveNickname}
            />
            <Pressable
              style={[
                styles.saveButton,
                { backgroundColor: theme.accent },
                saving && styles.saveButtonBusy,
              ]}
              onPress={saveNickname}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>{t('common.save')}</Text>
              )}
            </Pressable>
          </View>
        </Section>

        <Section title={t('settings.appColor')} surface={theme.surface} titleColor={theme.textMuted}>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            {t('settings.appColorHint')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.swatchRow}
          >
            {APP_COLOR_PRESETS.map((preset) => (
              <Pressable
                key={preset.id}
                onPress={() => {
                  if (user) updateSettings(user.uid, { ...settings, appColor: preset.id });
                }}
                style={[
                  styles.swatch,
                  { backgroundColor: preset.dark, borderColor: preset.vibrant },
                  appColor === preset.id && styles.swatchSelected,
                ]}
              >
                {appColor === preset.id ? (
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </Section>

        <Section title={t('settings.chatBackground')} surface={theme.surface} titleColor={theme.textMuted}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.swatchRow}
          >
            {BACKGROUND_PRESETS.map((preset) => (
              <Pressable
                key={preset.id}
                onPress={() => user && updateSettings(user.uid, { ...settings, chatBackground: preset.id })}
                style={[
                  styles.swatch,
                  { backgroundColor: preset.color },
                  background === preset.id && styles.swatchSelected,
                ]}
              />
            ))}
            <Pressable
              onPress={pickBackgroundImage}
              style={[
                styles.swatch,
                styles.swatchPhoto,
                isImageBackground(background) && styles.swatchSelected,
              ]}
            >
              <Ionicons name="image" size={20} color={colors.textMuted} />
            </Pressable>
          </ScrollView>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            {t('settings.chatBackgroundHint')}
          </Text>
        </Section>

        <Section title={t('settings.bubbleColor')} surface={theme.surface} titleColor={theme.textMuted}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.swatchRow}
          >
            {BUBBLE_PRESETS.map((preset) => (
              <Pressable
                key={preset.id}
                onPress={() => user && updateSettings(user.uid, { ...settings, bubbleColor: preset.color })}
                style={[
                  styles.swatch,
                  { backgroundColor: preset.color },
                  bubbleColor === preset.color && styles.swatchSelected,
                ]}
              />
            ))}
          </ScrollView>
        </Section>

        <Section title={t('settings.sounds')} surface={theme.surface} titleColor={theme.textMuted}>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            {t('settings.soundHint')}
          </Text>

          <Pressable
            style={[styles.row, { borderColor: theme.border }]}
            onPress={() => selectSound(CALL_CHANNEL, t('settings.callRingtone'))}
          >
            <Ionicons name="call-outline" size={20} color={theme.accent} />
            <Text style={[styles.rowText, { color: theme.text }]}>{t('settings.callRingtone')}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </Pressable>

          <Pressable
            style={[styles.row, { borderColor: theme.border }]}
            onPress={() => selectSound(MESSAGE_CHANNEL, t('settings.messageSound'))}
          >
            <Ionicons name="chatbubble-outline" size={20} color={theme.accent} />
            <Text style={[styles.rowText, { color: theme.text }]}>{t('settings.messageSound')}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </Pressable>
        </Section>

        <Section title={t('settings.media')} surface={theme.surface} titleColor={theme.textMuted}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>{t('settings.saveToGallery')}</Text>
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                {t('settings.saveToGalleryHint')}
              </Text>
            </View>
            <Switch
              value={settings.saveToGallery ?? false}
              onValueChange={(value) => {
                if (user) updateSettings(user.uid, { ...settings, saveToGallery: value });
              }}
              trackColor={{ true: theme.accent, false: theme.border }}
            />
          </View>
        </Section>

        {/* Language Selection */}
        <Section title={t('settings.language')} surface={theme.surface} titleColor={theme.textMuted}>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            {t('settings.languageHint')}
          </Text>
          <View style={styles.languageRow}>
            {languagesList.map((item) => {
              const isSelected = language === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={async () => {
                    await setLanguage(item.key);
                    if (user) {
                      updateSettings(user.uid, { ...settings, language: item.key });
                    }
                  }}
                  style={[
                    styles.languageChip,
                    {
                      borderColor: isSelected ? theme.accent : theme.border,
                      backgroundColor: isSelected ? theme.accent : theme.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.languageChipText,
                      { color: isSelected ? '#FFFFFF' : theme.text },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Pressable style={[styles.logout, { backgroundColor: theme.surface }]} onPress={logOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>{t('settings.signOut')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontFamily: fonts.semiBold },
  content: { padding: spacing.lg, gap: spacing.lg },
  profile: { alignItems: 'center', gap: spacing.sm },
  avatarWrapper: { position: 'relative' },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  email: { fontSize: 14, color: colors.textMuted },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  sectionBody: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  languageRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
  languageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  languageChipText: { fontSize: 14, fontWeight: '600' },
  nicknameRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minWidth: 74,
    alignItems: 'center',
  },
  saveButtonBusy: { opacity: 0.7 },
  saveButtonText: { color: '#FFFFFF', fontWeight: '600' },
  swatchRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.md },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchPhoto: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  swatchSelected: { borderColor: colors.primary, borderWidth: 3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, fontSize: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { fontSize: 16, color: colors.text, fontWeight: '500' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
