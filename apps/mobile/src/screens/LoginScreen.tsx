import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onNavigateToRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      await login({
        email: email.trim(),
        password: password.trim(),
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillAdminCredentials = () => {
    setEmail('adwaitakamble007@gmail.com');
    setPassword('Sondev@1234');
    setErrorMessage(null);
  };

  const fillDemoCredentials = () => {
    setEmail('demo@simplybooking.com');
    setPassword('password123');
    setErrorMessage(null);
  };

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Header */}
          <View style={styles.brandContainer}>
            <View style={styles.logoRow}>
              <View style={styles.leafIconContainer}>
                <Text style={styles.leafIcon}>🌿</Text>
              </View>
              <Text style={styles.brandTitle}>SIMPLY </Text>
              <Text style={styles.brandBadge}>Booking</Text>
            </View>
            <Text style={styles.tagline}>Manage your hotel with ease.</Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.screenTitle}>Login to your account</Text>
            <Text style={styles.screenSubtitle}>Enter your registered email and password to access your hotel dashboard.</Text>

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="name@company.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Password</Text>
                <TouchableOpacity
                  onPress={() => Alert.alert('Reset Password', 'Please contact support@simplybooking.com to reset your hotel owner password.')}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Quick Auto-fill Helpers */}
            <TouchableOpacity
              style={[styles.demoHelper, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}
              onPress={fillAdminCredentials}
              activeOpacity={0.7}
            >
              <Text style={[styles.demoHelperText, { color: '#B45309' }]}>👑 Auto-fill Primary Admin (adwaitakamble007@gmail.com)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.demoHelper}
              onPress={fillDemoCredentials}
              activeOpacity={0.7}
            >
              <Text style={styles.demoHelperText}>⚡ Auto-fill Pune Resort Staff Demo Account</Text>
            </TouchableOpacity>

            {/* Register Footer */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={onNavigateToRegister} activeOpacity={0.7}>
                <Text style={styles.registerLinkText}>Register</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  leafIconContainer: {
    marginRight: 6,
  },
  leafIcon: {
    fontSize: 28,
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 1.5,
  },
  brandBadge: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    marginLeft: 4,
  },
  tagline: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
  },
  screenSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
  },
  eyeButton: {
    padding: 6,
  },
  eyeIcon: {
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  demoHelper: {
    marginTop: 16,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  demoHelperText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
  },
  registerLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
});
