import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { THEME } from '../../styles/theme';

interface AvatarProps {
  name: string;
  url?: string | null;
  size?: number;
  isOnline?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ name, url, size = 48, isOnline }) => {
  const getInitials = (n: string) => {
    if (!n) return 'U';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.38 }]}>
            {getInitials(name)}
          </Text>
        </View>
      )}

      {isOnline !== undefined && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isOnline ? THEME.colors.success : THEME.colors.textMuted,
              width: Math.max(10, size * 0.25),
              height: Math.max(10, size * 0.25),
              borderRadius: Math.max(10, size * 0.25) / 2,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    backgroundColor: '#1E2942',
    borderColor: THEME.colors.border,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: THEME.colors.primaryLight,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: THEME.colors.background,
  },
});

export default Avatar;
