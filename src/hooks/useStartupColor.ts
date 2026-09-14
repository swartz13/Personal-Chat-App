import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appColorOf } from '../services/profile';

const STORAGE_KEY = 'lastAppColor';

/**
 * When the app launches, user settings haven't loaded from the server yet.
 * We store the last selected color on the device and use it for the splash
 * screen, so the app doesn't briefly flash the default green then switch.
 */
export async function saveStartupColor(id: string) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, id);
  } catch {
    // If the color can't be remembered, the app opens with the default — no big deal.
  }
}

export function useStartupColor() {
  const [colorId, setColorId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(setColorId)
      .catch(() => setColorId(null))
      .finally(() => setReady(true));
  }, []);

  return { palette: appColorOf(colorId), ready };
}
