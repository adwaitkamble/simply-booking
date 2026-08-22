import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { ApiClient } from '../api/client';
import { TeamMemberCard, TeamMemberData } from '../components/TeamMemberCard';
import { shadows } from '../theme';

interface MyTeamScreenProps {
  onBack?: () => void;
  onUpgrade?: () => void;
  onOpenEditUser?: (user?: any) => void;
}

export const MyTeamScreen: React.FC<MyTeamScreenProps> = ({ onBack, onOpenEditUser }) => {
  const [members, setMembers] = useState<TeamMemberData[]>([]);
  const [stats, setStats] = useState<{ used: number; limit: number; isLimitReached: boolean }>({
    used: 0,
    limit: 50,
    isLimitReached: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Admin' | 'Staff'>('Staff');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const loadTeamData = useCallback(async () => {
    try {
      setError(null);
      const data = await ApiClient.fetchTeamData();
      setStats(data.stats);
      setMembers(data.members);
    } catch (err: any) {
      console.warn('Failed to load team data:', err);
      setError(err?.message || 'Failed to fetch team data from PostgreSQL backend');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    loadTeamData();
  }, [loadTeamData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadTeamData();
  };

  // Status Toggle Handler with Optimistic UI & Error Rollback
  const handleToggleStatus = async (memberId: string, newActive: boolean) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, isActive: newActive } : m))
    );

    try {
      await ApiClient.updateMemberStatus(memberId, newActive);
    } catch (err: any) {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, isActive: !newActive } : m))
      );
      if (Platform.OS === 'web') {
        window.alert(`Failed to update status: ${err?.message}`);
      } else {
        Alert.alert('Status Error', err?.message || 'Failed to update member status');
      }
    }
  };

  // Delete Member Handler
  const handleDeleteMember = async (memberId: string, memberName: string) => {
    const previousMembers = [...members];
    setMembers((prev) => prev.filter((m) => m.id !== memberId));

    try {
      await ApiClient.deleteTeamMember(memberId);
      loadTeamData();
    } catch (err: any) {
      setMembers(previousMembers);
      if (Platform.OS === 'web') {
        window.alert(`Failed to remove team member: ${err?.message}`);
      } else {
        Alert.alert('Error', err?.message || 'Failed to remove team member');
      }
    }
  };

  // Submit Invite Member Form
  const handleInviteSubmit = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError('Please fill in both name and email.');
      return;
    }

    setInviting(true);
    setInviteError(null);

    try {
      await ApiClient.inviteTeamMember({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
      loadTeamData();
    } catch (err: any) {
      setInviteError(err?.message || 'Failed to invite team member');
    } finally {
      setInviting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Solid Blue Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => onBack?.()}
            activeOpacity={0.7}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>My Team</Text>
            <Text style={styles.headerSubtitle}>
              {stats.used} Team Member{stats.used === 1 ? '' : 's'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <Text style={styles.refreshIcon}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      {isLoading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0d6efd" />
          <Text style={styles.loadingText}>Loading team members from database...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadTeamData}>
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#0d6efd']}
              tintColor="#0d6efd"
            />
          }
          ListHeaderComponent={
            <View style={styles.actionToolbar}>
              <Text style={styles.sectionHeading}>Property Staff & Admins</Text>
              <TouchableOpacity
                style={styles.addMemberBtn}
                onPress={() => (onOpenEditUser ? onOpenEditUser() : setShowInviteModal(true))}
                activeOpacity={0.8}
              >
                <Text style={styles.addMemberBtnText}>+ Add Member</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TeamMemberCard
              member={item}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeleteMember}
              onEdit={onOpenEditUser ? (m) => onOpenEditUser(m) : undefined}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>No Staff Members Added</Text>
              <Text style={styles.emptySub}>
                Click "+ Add Member" above to add staff members to your hotel property.
              </Text>
            </View>
          }
        />
      )}

      {/* Invite Member Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Team Member</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {inviteError ? (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{inviteError}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Shruti Pendse"
              value={inviteName}
              onChangeText={setInviteName}
            />

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. spendse@gmail.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={inviteEmail}
              onChangeText={setInviteEmail}
            />

            <Text style={styles.inputLabel}>Select Role</Text>
            <View style={styles.rolePickerRow}>
              {(['Staff', 'Admin'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.roleChip,
                    inviteRole === r && styles.roleChipSelected,
                  ]}
                  onPress={() => setInviteRole(r)}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      inviteRole === r && styles.roleChipTextSelected,
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitInviteBtn, inviting && styles.btnDisabled]}
              onPress={handleInviteSubmit}
              disabled={inviting}
              activeOpacity={0.85}
            >
              {inviting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitInviteBtnText}>Save Team Member</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerTitleCol: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DBEAFE',
    marginTop: 2,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  actionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  addMemberBtn: {
    backgroundColor: '#0d6efd',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addMemberBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#0d6efd',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    ...shadows.modal,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#64748B',
  },
  modalErrorBox: {
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  modalErrorText: {
    fontSize: 12,
    color: '#EF4444',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  roleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleChipSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0d6efd',
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  roleChipTextSelected: {
    color: '#0d6efd',
    fontWeight: '900',
  },
  submitInviteBtn: {
    backgroundColor: '#0d6efd',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitInviteBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
