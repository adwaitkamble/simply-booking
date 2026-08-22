import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { ApiClient } from '../api/client';
import { UserDTO, UserRole, ModulePermissions, ActionPermissions } from '@hotel-pms/types';
import { shadows } from '../theme';

interface EditUserScreenProps {
  initialUser?: UserDTO | null;
  onBack: () => void;
  onSuccess?: () => void;
}

const DEFAULT_MODULES = [
  { key: 'calendar', label: 'Calendar / Gantt Chart' },
  { key: 'rooms', label: 'Rooms & Categories' },
  { key: 'bookings', label: 'Bookings & Reservations' },
  { key: 'invoicing', label: 'Billing & Invoicing' },
  { key: 'housekeeping', label: 'Housekeeping & Staff' },
  { key: 'team', label: 'Team & RBAC Management' },
];

const ACTIONS: (keyof ActionPermissions)[] = ['create', 'edit', 'view', 'delete', 'list'];

const INITIAL_PERMISSIONS: ModulePermissions = {
  calendar: { create: true, edit: true, view: true, delete: false, list: true },
  rooms: { create: true, edit: true, view: true, delete: false, list: true },
  bookings: { create: true, edit: true, view: true, delete: false, list: true },
  invoicing: { create: true, edit: true, view: true, delete: false, list: true },
  housekeeping: { create: true, edit: true, view: true, delete: false, list: true },
  team: { create: false, edit: false, view: true, delete: false, list: true },
};

export const EditUserScreen: React.FC<EditUserScreenProps> = ({
  initialUser,
  onBack,
  onSuccess,
}) => {
  // Basic Info Form State with Dummy Initialization Defaults
  const [name, setName] = useState(initialUser?.name || 'Aryan Aradhye');
  const [email, setEmail] = useState(initialUser?.email || 'aryan@simplybooking.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // User Role & Active Status State
  const [role, setRole] = useState<UserRole>(initialUser?.role || 'Staff');
  const [isActive, setIsActive] = useState<boolean>(initialUser?.isActive ?? true);

  // Granular Access Control Permissions State
  const [permissions, setPermissions] = useState<ModulePermissions>(
    initialUser?.permissions || INITIAL_PERMISSIONS
  );

  // UI Loading & Error State
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Immutable Toggle Handler for Specific Action Boolean
  const toggleActionPermission = (moduleKey: string, actionKey: keyof ActionPermissions) => {
    setPermissions((prev) => {
      const currentModule = prev[moduleKey] || {
        create: false,
        edit: false,
        view: false,
        delete: false,
        list: false,
      };

      return {
        ...prev,
        [moduleKey]: {
          ...currentModule,
          [actionKey]: !currentModule[actionKey],
        },
      };
    });
  };

  // Master Checkbox Handler: Select All / Deselect All for a Module
  const toggleModuleMaster = (moduleKey: string, currentAllChecked: boolean) => {
    const nextState = !currentAllChecked;
    setPermissions((prev) => ({
      ...prev,
      [moduleKey]: {
        create: nextState,
        edit: nextState,
        view: nextState,
        delete: nextState,
        list: nextState,
      },
    }));
  };

  // Check if all actions in a module are selected
  const isModuleAllChecked = (moduleKey: string): boolean => {
    const mod = permissions[moduleKey];
    if (!mod) return false;
    return ACTIONS.every((act) => mod[act] === true);
  };

  // Form Submit Handler
  const handleSaveUser = async () => {
    if (!name.trim()) {
      setErrorMsg('Please enter user full name.');
      return;
    }

    if (!email.trim()) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!initialUser && !password.trim()) {
      setErrorMsg('Password is required for creating a new user account.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      if (initialUser?.id) {
        // Edit existing staff user
        await ApiClient.updateTeamMember(initialUser.id, {
          name: name.trim(),
          email: email.trim(),
          password: password.trim() || undefined,
          role,
          isActive,
          permissions,
        });
      } else {
        // Create new staff user
        await ApiClient.createTeamMember({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          role,
          isActive,
          permissions,
        });
      }

      const msg = initialUser ? 'User permissions updated successfully!' : 'New staff member account created successfully!';
      if (Platform.OS === 'web') {
        window.alert(`Success: ${msg}`);
        onSuccess ? onSuccess() : onBack();
      } else {
        Alert.alert('Success', msg, [
          { text: 'OK', onPress: () => (onSuccess ? onSuccess() : onBack()) },
        ]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save user account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Solid Blue Header (#0d6efd) with Back Arrow */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {initialUser ? 'Edit User Access' : 'Create Staff User'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Error Banner */}
        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          </View>
        ) : null}

        {/* 2. Basic Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>BASIC USER DETAILS</Text>

          {/* Name Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Full Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Aryan Aradhye"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Email Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email Address *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. aryan@simplybooking.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {initialUser ? 'Password (Leave blank to keep unchanged)' : 'Account Password *'}
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.inputField}
                placeholder={initialUser ? 'Enter new password if changing' : 'Enter login password'}
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((prev) => !prev)}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* User Type & Status Controls */}
          <View style={styles.twoColRow}>
            {/* User Type Selection */}
            <View style={styles.col}>
              <Text style={styles.fieldLabel}>Select User Type</Text>
              <View style={styles.rolePickerRow}>
                <TouchableOpacity
                  style={[styles.rolePill, role === 'Staff' && styles.rolePillActive]}
                  onPress={() => setRole('Staff')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.rolePillText, role === 'Staff' && styles.rolePillTextActive]}>
                    Staff Member
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rolePill, role === 'Admin' && styles.rolePillActive]}
                  onPress={() => {
                    const isPrimary = email.toLowerCase().trim() === 'adwaitakamble007@gmail.com' || initialUser?.email?.toLowerCase() === 'adwaitakamble007@gmail.com';
                    if (!isPrimary) {
                      const msg = 'Only 1 Administrator (Adwait Kamble: adwaitakamble007@gmail.com) is allowed per hotel property.';
                      if (Platform.OS === 'web') window.alert(msg);
                      else Alert.alert('Single Admin Policy', msg);
                      return;
                    }
                    setRole('Admin');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.rolePillText, role === 'Admin' && styles.rolePillTextActive]}>
                    Admin
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Account Status Switch */}
            <View style={styles.colRight}>
              <Text style={styles.fieldLabel}>Account Status</Text>
              <View style={styles.statusSwitchRow}>
                <Text style={[styles.statusText, isActive ? styles.activeText : styles.inactiveText]}>
                  {isActive ? 'Active User' : 'Deactivated'}
                </Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: '#CBD5E1', true: '#BFDBFE' }}
                  thumbColor={isActive ? '#0d6efd' : '#94A3B8'}
                />
              </View>
            </View>
          </View>
        </View>

        {/* 3. Access Control Checkboxes (The Core UI) */}
        <View style={styles.card}>
          <View style={styles.accessHeaderRow}>
            <Text style={styles.cardSectionTitle}>ACCESS CONTROL</Text>
            {role === 'Admin' ? (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>⚡ Full Admin Access</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.accessSubText}>
            Define granular module permissions for staff accounts. Admins possess full access automatically.
          </Text>

          {DEFAULT_MODULES.map((mod) => {
            const masterChecked = isModuleAllChecked(mod.key);
            const modPerms = permissions[mod.key] || {
              create: false,
              edit: false,
              view: false,
              delete: false,
              list: false,
            };

            return (
              <View key={mod.key} style={styles.moduleBlock}>
                {/* Module Master Header Row */}
                <TouchableOpacity
                  style={styles.moduleMasterHeader}
                  onPress={() => toggleModuleMaster(mod.key, masterChecked)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, masterChecked && styles.checkboxChecked]}>
                    {masterChecked ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <Text style={styles.moduleTitleText}>{mod.label}</Text>
                  <Text style={styles.masterLabel}>
                    {masterChecked ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>

                {/* Indented Action Checkboxes Sub-Rows */}
                <View style={styles.actionIndentContainer}>
                  {ACTIONS.map((actionKey) => {
                    const isChecked = modPerms[actionKey] === true;
                    return (
                      <TouchableOpacity
                        key={actionKey}
                        style={styles.actionRow}
                        onPress={() => toggleActionPermission(mod.key, actionKey)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkboxSub, isChecked && styles.checkboxChecked]}>
                          {isChecked ? <Text style={styles.checkmarkSub}>✓</Text> : null}
                        </View>
                        <Text style={[styles.actionText, isChecked && styles.actionTextChecked]}>
                          {actionKey.charAt(0).toUpperCase() + actionKey.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* 4. Sticky Bottom Save Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.saveBtn, submitting && styles.saveBtnDisabled]}
          onPress={handleSaveUser}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>
              {initialUser ? 'Save Changes' : 'Save User Account'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.card,
  },
  cardSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
    color: '#0F172A',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  eyeBtn: {
    padding: 6,
  },
  eyeIcon: {
    fontSize: 16,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  col: {
    flex: 1,
  },
  colRight: {
    flex: 1,
    alignItems: 'flex-start',
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 6,
  },
  rolePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  rolePillActive: {
    backgroundColor: '#0d6efd',
    borderColor: '#0d6efd',
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  rolePillTextActive: {
    color: '#FFFFFF',
  },
  statusSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeText: {
    color: '#16A34A',
  },
  inactiveText: {
    color: '#DC2626',
  },
  accessHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adminBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0d6efd',
  },
  accessSubText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 16,
  },
  moduleBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  moduleMasterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  moduleTitleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  masterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d6efd',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSub: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0d6efd',
    borderColor: '#0d6efd',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  checkmarkSub: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  actionIndentContainer: {
    paddingLeft: 32,
    paddingTop: 8,
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  actionTextChecked: {
    color: '#0F172A',
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...shadows.card,
  },
  saveBtn: {
    backgroundColor: '#0d6efd',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
