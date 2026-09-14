import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { uploadMedia, type PickedMedia } from './media';
import type { UserSettings } from '../types';

/** Updates the display name shown in chat. */
export async function updateDisplayName(uid: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Display name cannot be empty.');
  await setDoc(doc(db, 'users', uid), { displayName: trimmed }, { merge: true });
}

/** Uploads and saves a new profile photo, returns the URL. */
export async function updatePhoto(uid: string, media: PickedMedia) {
  const uploaded = await uploadMedia('profile', uid, media);
  await setDoc(doc(db, 'users', uid), { photoURL: uploaded.url }, { merge: true });
  return uploaded.url;
}

/** Removes the profile photo. */
export async function removePhoto(uid: string) {
  await setDoc(doc(db, 'users', uid), { photoURL: null }, { merge: true });
}

/**
 * Updates appearance preferences.
 * Settings are stored in the user document so they sync across all devices.
 */
export async function updateSettings(uid: string, settings: Partial<UserSettings>) {
  await setDoc(doc(db, 'users', uid), { settings }, { merge: true });
}

/**
 * App color presets. Each option generates a cohesive palette:
 * header bar uses the dark shade, buttons use the vibrant shade,
 * and page backgrounds use a distinguishable but readable light tint.
 */
export const APP_COLOR_PRESETS = [
  { id: 'green', label: 'Green', dark: '#075E54', vibrant: '#128C7E', background: '#D7E9E3', surface: '#FFFFFF', border: '#BFD9D1', text: '#0E1B18', textMuted: '#54706A', isLight: true },
  { id: 'emerald', label: 'Emerald', dark: '#00695C', vibrant: '#00897B', background: '#D2EBE6', surface: '#FFFFFF', border: '#B7DBD4', text: '#0B1F1C', textMuted: '#4F736D', isLight: true },
  { id: 'blue', label: 'Blue', dark: '#0D3E8F', vibrant: '#1976D2', background: '#D8E4F7', surface: '#FFFFFF', border: '#BDCFEE', text: '#0F1A2B', textMuted: '#556785', isLight: true },
  { id: 'sky', label: 'Sky', dark: '#01579B', vibrant: '#0288D1', background: '#D4E8F7', surface: '#FFFFFF', border: '#B6D6EC', text: '#0B1B26', textMuted: '#4E6B7C', isLight: true },
  { id: 'purple', label: 'Purple', dark: '#4A1E7A', vibrant: '#7B3FB0', background: '#E3D8F2', surface: '#FFFFFF', border: '#CFBEE6', text: '#1C1226', textMuted: '#6B5A80', isLight: true },
  { id: 'lilac', label: 'Lilac', dark: '#6A1B9A', vibrant: '#9C27B0', background: '#EDD9F2', surface: '#FFFFFF', border: '#DCC0E6', text: '#22102A', textMuted: '#7A5C85', isLight: true },
  { id: 'pink', label: 'Pink', dark: '#AD1457', vibrant: '#D81B60', background: '#F7D9E6', surface: '#FFFFFF', border: '#EFC0D4', text: '#2A0E1B', textMuted: '#8A5A6E', isLight: true },
  { id: 'red', label: 'Red', dark: '#8A1F26', vibrant: '#C62F38', background: '#F5D9DB', surface: '#FFFFFF', border: '#E8BFC2', text: '#26100F', textMuted: '#875C5E', isLight: true },
  { id: 'orange', label: 'Orange', dark: '#A8380D', vibrant: '#E4611C', background: '#F7DED2', surface: '#FFFFFF', border: '#EBC6B4', text: '#241309', textMuted: '#87614F', isLight: true },
  { id: 'amber', label: 'Amber', dark: '#8F5000', vibrant: '#D98300', background: '#F8E4C6', surface: '#FFFFFF', border: '#EDD0A6', text: '#241905', textMuted: '#856B44', isLight: true },
  { id: 'charcoal', label: 'Charcoal', dark: '#263238', vibrant: '#4A6572', background: '#DCE3E7', surface: '#FFFFFF', border: '#C4CFD5', text: '#141B1F', textMuted: '#5C6B73', isLight: true },
  { id: 'night', label: 'Night', dark: '#0B141A', vibrant: '#159A87', background: '#0F1B21', surface: '#17242B', border: '#22333B', text: '#E9EDEF', textMuted: '#8FA0AA', isLight: false },
] as const;

/** Returns the palette for the selected app color. */
export function appColorOf(value?: string | null) {
  return APP_COLOR_PRESETS.find((r) => r.id === value) ?? APP_COLOR_PRESETS[0];
}

/** Chat screen message area background presets. */
export const BACKGROUND_PRESETS = [
  { id: 'default', label: 'Default', color: '#ECE5DD' },
  { id: 'light', label: 'Light', color: '#F7F7F7' },
  { id: 'beige', label: 'Beige', color: '#EFE6D9' },
  { id: 'green', label: 'Green', color: '#DDE8DF' },
  { id: 'mint', label: 'Mint', color: '#D9EDE5' },
  { id: 'blue', label: 'Blue', color: '#DCE6F1' },
  { id: 'ice', label: 'Ice', color: '#DCEDF3' },
  { id: 'purple', label: 'Purple', color: '#E6DFF0' },
  { id: 'pink', label: 'Pink', color: '#F3DFE7' },
  { id: 'gray', label: 'Gray', color: '#E4E7E9' },
  { id: 'coal', label: 'Coal', color: '#1A2429' },
  { id: 'night', label: 'Night', color: '#101B20' },
] as const;

/** Own message bubble color presets. */
export const BUBBLE_PRESETS = [
  { id: 'default', label: 'Default', color: '#DCF8C6' },
  { id: 'mint', label: 'Mint', color: '#CFEFE4' },
  { id: 'blue', label: 'Blue', color: '#CFE3FF' },
  { id: 'ice', label: 'Ice', color: '#DDF1F7' },
  { id: 'purple', label: 'Purple', color: '#E4D7F5' },
  { id: 'lilac', label: 'Lilac', color: '#EEDCF7' },
  { id: 'pink', label: 'Pink', color: '#FBD9E6' },
  { id: 'peach', label: 'Peach', color: '#FFDFD3' },
  { id: 'orange', label: 'Orange', color: '#FFE2C7' },
  { id: 'yellow', label: 'Yellow', color: '#FBF0C4' },
  { id: 'gray', label: 'Gray', color: '#E8EAED' },
  { id: 'dark', label: 'Dark', color: '#2A3942' },
] as const;

/** Checks whether the background value is an image URL or a preset color. */
export function isImageBackground(value?: string | null) {
  return typeof value === 'string' && value.startsWith('http');
}

/** Finds the color for a background preset ID. */
export function backgroundColorOf(value?: string | null) {
  const preset = BACKGROUND_PRESETS.find((a) => a.id === value);
  return preset?.color ?? BACKGROUND_PRESETS[0].color;
}
