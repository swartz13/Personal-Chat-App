import { useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { appColorOf, backgroundColorOf, isImageBackground } from '../services/profile';
import { saveStartupColor, useStartupColor } from './useStartupColor';

/**
 * Provides the app's appearance settings from a single source.
 *
 * - App color: header bar, buttons, page backgrounds, and text colors.
 *   All screens (home, settings, history) use this palette.
 * - Chat background: only affects the message area in the chat screen.
 *   Does not affect anything else.
 */
export function useAppTheme() {
  const { profile } = useAuth();
  // Until the profile loads from the server, use the last color stored on device;
  // otherwise the app would briefly flash the default green before switching.
  const { palette: lastPalette } = useStartupColor();
  const colorChoice = profile?.settings?.appColor ?? lastPalette.id;
  const chatBgChoice = profile?.settings?.chatBackground ?? 'default';

  // Save the selection to device so the next launch starts with the correct color.
  useEffect(() => {
    // Only store the actual server-provided selection.
    if (profile?.settings?.appColor) saveStartupColor(profile.settings.appColor);
  }, [profile?.settings?.appColor]);

  return useMemo(() => {
    const palette = appColorOf(colorChoice);
    const isImageBg = isImageBackground(chatBgChoice);

    return {
      /** Header bar color (dark shade of the palette). */
      headerBackground: palette.dark,
      /** Button and accent color. */
      accent: palette.vibrant,
      /** Page background (very light shade of the palette). */
      background: palette.background,
      /** Card and list row background. */
      surface: palette.surface,
      /** Divider lines. */
      border: palette.border,
      /** Primary text color. */
      text: palette.text,
      /** Secondary text color. */
      textMuted: palette.textMuted,
      /** Whether the palette is light (for icons and shadows). */
      isLight: palette.isLight,

      /** Background color for the chat screen message area only. */
      chatBackground: isImageBg ? null : backgroundColorOf(chatBgChoice),
      /** Background image for the chat area (if selected). */
      chatImage: isImageBg ? chatBgChoice : null,
    };
  }, [colorChoice, chatBgChoice]);
}
