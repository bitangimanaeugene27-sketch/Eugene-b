export const THEME = {
  colors: {
    primary: '#3B82F6',        // Vibrant Blue
    primaryDark: '#1D4ED8',
    primaryLight: '#60A5FA',
    
    accent: '#8B5CF6',         // Purple accent
    success: '#10B981',        // Emerald green (Accept Call / Online)
    danger: '#EF4444',         // Rose red (Decline / End Call)
    warning: '#F59E0B',        // Amber
    
    // Dark Palette (Default)
    background: '#0B0F19',     // Deep midnight dark
    surface: '#151D30',        // Elevated card / modal background
    surfaceHover: '#1E2942',
    border: '#23304E',         // Subtle container borders
    
    // Typography
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    
    white: '#FFFFFF',
    black: '#000000',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 6,
    md: 12,
    lg: 18,
    xl: 28,
    full: 9999,
  },
  typography: {
    title: {
      fontSize: 24,
      fontWeight: '700' as const,
      color: '#F8FAFC',
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: '#94A3B8',
    },
    body: {
      fontSize: 14,
      fontWeight: '400' as const,
      color: '#F8FAFC',
    },
    caption: {
      fontSize: 12,
      fontWeight: '400' as const,
      color: '#64748B',
    },
  },
};

export default THEME;
