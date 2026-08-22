import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { ApiClient } from '../api/client';
import { colors, borderRadius, shadows } from '../theme';

interface ChangePasswordScreenProps {
  onBack: () => void;
  onSuccess?: () => void;
}

export const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({
  onBack,
  onSuccess,
}) => {
  // Password States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password Visibility Toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form Submission & Error States
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Focus States for Border Styling
  const [focusedInput, setFocusedInput] = useState<'current' | 'new' | 'confirm' | null>(null);

  // Dynamic Password Validation Rules Check
  const validationRules = useMemo(() => {
    const minLength = newPassword.length >= 8;
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    const isMatched = newPassword.length > 0 && newPassword === confirmPassword;

    const allValid = minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial && isMatched;

    return {
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecial,
      isMatched,
      allValid,
    };
  }, [newPassword, confirmPassword]);

  // Form Submission Handler
  const handleSubmit = async () => {
    if (!currentPassword.trim()) {
      setErrorMsg('Please enter your current password.');
      return;
    }

    if (!validationRules.allValid) {
      setErrorMsg('Please ensure all password policy requirements are satisfied.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const result = await ApiClient.changePassword({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
        confirmPassword: confirmPassword.trim(),
      });

      if (result.success) {
        setSuccessMsg(result.message || 'Password changed successfully!');
        
        if (Platform.OS === 'web') {
          window.alert('Success: Password changed successfully!');
          onSuccess ? onSuccess() : onBack();
        } else {
          Alert.alert(
            'Success',
            'Your password has been changed successfully.',
            [
              {
                text: 'OK',
                onPress: () => (onSuccess ? onSuccess() : onBack()),
              },
            ]
          );
        }
      } else {
        setErrorMsg(result.message || 'Failed to update password.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred while updating your password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Header: Blue background (#0d6efd / #0066FF) with white back arrow & title */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Main Content Area */}
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Security & Password Update</Text>
          <Text style={styles.cardSub}>
            Ensure your account stays secure by using a strong password with letters, numbers, and symbols.
          </Text>

          {/* Error Banner */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>⚠️ {errorMsg}</Text>
            </View>
          ) : null}

          {/* Success Banner */}
          {successMsg ? (
            <View style={styles.successBox}>
              <Text style={styles.successBoxText}>✓ {successMsg}</Text>
            </View>
          ) : null}

          {/* FIELD 1: Current Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Current Password *</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedInput === 'current' && styles.inputWrapperFocused,
              ]}
            >
              <TextInput
                style={styles.inputField}
                placeholder="Enter current password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showCurrentPassword}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                onFocus={() => setFocusedInput('current')}
                onBlur={() => setFocusedInput(null)}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeToggleBtn}
                onPress={() => setShowCurrentPassword((prev) => !prev)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.eyeIcon}>{showCurrentPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* FIELD 2: New Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>New Password *</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedInput === 'new' && styles.inputWrapperFocused,
              ]}
            >
              <TextInput
                style={styles.inputField}
                placeholder="Enter new password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                onFocus={() => setFocusedInput('new')}
                onBlur={() => setFocusedInput(null)}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeToggleBtn}
                onPress={() => setShowNewPassword((prev) => !prev)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.eyeIcon}>{showNewPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* FIELD 3: Confirm New Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Confirm New Password *</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedInput === 'confirm' && styles.inputWrapperFocused,
              ]}
            >
              <TextInput
                style={styles.inputField}
                placeholder="Re-enter new password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => setFocusedInput('confirm')}
                onBlur={() => setFocusedInput(null)}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeToggleBtn}
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.eyeIcon}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Dynamic Validation Rules Helper Text */}
          <View style={styles.rulesContainer}>
            <Text style={styles.rulesHeaderTitle}>PASSWORD REQUIREMENTS</Text>

            <View style={styles.ruleRow}>
              <Text style={[styles.ruleIcon, validationRules.minLength ? styles.ruleIconValid : styles.ruleIconPending]}>
                {validationRules.minLength ? '✓' : '•'}
              </Text>
              <Text style={[styles.ruleText, validationRules.minLength ? styles.ruleTextValid : styles.ruleTextPending]}>
                Minimum 8 characters long
              </Text>
            </View>

            <View style={styles.ruleRow}>
              <Text style={[styles.ruleIcon, validationRules.hasUppercase ? styles.ruleIconValid : styles.ruleIconPending]}>
                {validationRules.hasUppercase ? '✓' : '•'}
              </Text>
              <Text style={[styles.ruleText, validationRules.hasUppercase ? styles.ruleTextValid : styles.ruleTextPending]}>
                At least 1 uppercase letter (A-Z)
              </Text>
            </View>

            <View style={styles.ruleRow}>
              <Text style={[styles.ruleIcon, validationRules.hasLowercase ? styles.ruleIconValid : styles.ruleIconPending]}>
                {validationRules.hasLowercase ? '✓' : '•'}
              </Text>
              <Text style={[styles.ruleText, validationRules.hasLowercase ? styles.ruleTextValid : styles.ruleTextPending]}>
                At least 1 lowercase letter (a-z)
              </Text>
            </View>

            <View style={styles.ruleRow}>
              <Text style={[styles.ruleIcon, validationRules.hasNumber ? styles.ruleIconValid : styles.ruleIconPending]}>
                {validationRules.hasNumber ? '✓' : '•'}
              </Text>
              <Text style={[styles.ruleText, validationRules.hasNumber ? styles.ruleTextValid : styles.ruleTextPending]}>
                At least 1 numeric digit (0-9)
              </Text>
            </View>

            <View style={styles.ruleRow}>
              <Text style={[styles.ruleIcon, validationRules.hasSpecial ? styles.ruleIconValid : styles.ruleIconPending]}>
                {validationRules.hasSpecial ? '✓' : '•'}
              </Text>
              <Text style={[styles.ruleText, validationRules.hasSpecial ? styles.ruleTextValid : styles.ruleTextPending]}>
                At least 1 special character (!@#$%^&*)
              </Text>
            </View>

            <View style={styles.ruleRow}>
              <Text style={[styles.ruleIcon, validationRules.isMatched ? styles.ruleIconValid : styles.ruleIconPending]}>
                {validationRules.isMatched ? '✓' : '•'}
              </Text>
              <Text style={[styles.ruleText, validationRules.isMatched ? styles.ruleTextValid : styles.ruleTextPending]}>
                New passwords match
              </Text>
            </View>
          </View>

          {/* Action Button: Full-width blue button with ActivityIndicator */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!validationRules.allValid || !currentPassword || submitting) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!validationRules.allValid || !currentPassword || submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Update Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#0d6efd',
    paddingTop: Platform.OS === 'ios' ? 48 : 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    ...shadows.card,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.card,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorBoxText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  successBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  successBoxText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  inputWrapperFocused: {
    borderColor: '#0d6efd',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 8,
  },
  eyeToggleBtn: {
    padding: 6,
  },
  eyeIcon: {
    fontSize: 16,
  },
  rulesContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rulesHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  ruleIcon: {
    fontSize: 13,
    fontWeight: '900',
    width: 14,
  },
  ruleIconValid: {
    color: '#16A34A',
  },
  ruleIconPending: {
    color: '#94A3B8',
  },
  ruleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ruleTextValid: {
    color: '#15803D',
    fontWeight: '700',
  },
  ruleTextPending: {
    color: '#64748B',
  },
  submitBtn: {
    backgroundColor: '#0d6efd',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    ...shadows.card,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.7,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
