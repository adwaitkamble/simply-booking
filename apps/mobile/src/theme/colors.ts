export const colors = {
  // Slate Luxury Palette
  primary: '#0F172A',      // Slate 900
  primaryLight: '#1E293B', // Slate 800
  primaryMuted: '#334155', // Slate 700
  
  // Interactive Accent (Sapphire Blue)
  accent: '#3B82F6',       // Blue 500
  accentDark: '#2563EB',   // Blue 600
  accentLight: '#EFF6FF',  // Blue 50
  accentMuted: '#93C5FD',  // Blue 300
  
  // Base & Surface
  background: '#F8FAFC',   // Slate 50
  surface: '#FFFFFF',      // Pure White Card
  surfaceSubtle: '#F1F5F9',// Slate 100
  
  // Borders & Dividers
  border: '#E2E8F0',       // Slate 200
  borderDark: '#CBD5E1',   // Slate 300
  borderFocus: '#3B82F6',  // Blue 500
  
  // Typography
  textPrimary: '#0F172A',  // Slate 900
  textSecondary: '#64748B',// Slate 500
  textMuted: '#94A3B8',    // Slate 400
  textWhite: '#FFFFFF',    // White
  
  // Semantic Status
  success: '#10B981',      // Emerald 500 (Clean, Confirmed, 201)
  successDark: '#059669',  // Emerald 600
  successLight: '#ECFDF5', // Emerald 50
  successBorder: '#A7F3D0',// Emerald 200
  
  warning: '#F59E0B',      // Amber 500 (Dirty, Warning)
  warningDark: '#D97706',  // Amber 600
  warningLight: '#FFFBEB', // Amber 50
  warningBorder: '#FDE68A',// Amber 200
  
  error: '#EF4444',        // Red 500 (Maintenance, Conflict 409)
  errorDark: '#DC2626',    // Red 600
  errorLight: '#FEF2F2',   // Red 50
  errorBorder: '#FECACA',  // Red 200
  
  // Channel / Metrics Accent
  purple: '#8B5CF6',       // Violet 500
  purpleDark: '#7C3AED',   // Violet 600
  purpleLight: '#F5F3FF',  // Violet 50
  purpleBorder: '#DDD6FE', // Violet 200
} as const;

export type ColorKey = keyof typeof colors;
