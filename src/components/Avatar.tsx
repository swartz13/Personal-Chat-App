import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

interface Props {
  uri?: string | null;
  size?: number;
  /** For group chats, a group icon is shown instead of a person. */
  group?: boolean;
}

/**
 * Profile picture. If no image is uploaded, a grey human silhouette
 * on a light background is shown (like on Instagram), letters or face drawings are not used.
 */
export default function Avatar({ uri, size = 48, group = false }: Props) {
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, box]} contentFit="cover" transition={120} />;
  }

  return (
    <View style={[styles.placeholder, box]}>
      <Ionicons
        name={group ? 'people' : 'person'}
        size={size * 0.58}
        color={colors.avatarIcon}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.avatarBackground },
  placeholder: {
    backgroundColor: colors.avatarBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
