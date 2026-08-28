import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { shadows } from '../theme';

export interface TeamMemberData {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Staff';
  isActive: boolean;
  isPrimaryOwner: boolean;
}

interface TeamMemberCardProps {
  member: TeamMemberData;
  canEdit?: boolean;
  onToggleStatus: (memberId: string, newActive: boolean) => void;
  onDelete: (memberId: string, memberName: string) => void;
  onEdit?: (member: TeamMemberData) => void;
}

export const TeamMemberCard: React.FC<TeamMemberCardProps> = ({
  member,
  canEdit = true,
  onToggleStatus,
  onDelete,
  onEdit,
}) => {
  const { id, name, email, role, isActive, isPrimaryOwner } = member;

  const handleToggle = (value: boolean) => {
    onToggleStatus(id, value);
  };

  const handleDeletePress = () => {
    if (isPrimaryOwner) return;

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to remove team member "${name}"?`)) {
        onDelete(id, name);
      }
    } else {
      Alert.alert(
        'Remove Team Member',
        `Are you sure you want to remove ${name} from your team?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => onDelete(id, name) },
        ]
      );
    }
  };

  const isAdminMember = role === 'Admin' || isPrimaryOwner || (email || '').toLowerCase() === 'adwaitakamble007@gmail.com';

  return (
    <View style={[styles.cardContainer, isAdminMember && styles.primaryAdminCard]}>
      <View style={styles.leftInfoCol}>
        {/* Top Row: Name + Role Badge */}
        <View style={styles.nameRow}>
          <Text style={styles.nameText} numberOfLines={1}>
            {name}
          </Text>

          <View
            style={[
              styles.roleBadge,
              isAdminMember ? styles.adminBadge : styles.staffBadge,
            ]}
          >
            <Text
              style={[
                styles.roleBadgeText,
                isAdminMember ? styles.adminBadgeText : styles.staffBadgeText,
              ]}
            >
              {isAdminMember ? '👑 Primary Admin' : 'Staff'}
            </Text>
          </View>
        </View>

        {/* Bottom Row: Email */}
        <Text style={styles.emailText} numberOfLines={1}>
          {email}
        </Text>
      </View>

      {/* Right Action Row: Active Switch + Edit + Delete Button */}
      <View style={styles.rightActionRow}>
        <Switch
          value={isActive}
          onValueChange={handleToggle}
          disabled={!canEdit}
          trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
          thumbColor={isActive ? '#0066FF' : '#94A3B8'}
        />

        {canEdit && onEdit && (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => onEdit(member)}
            activeOpacity={0.7}
          >
            <Text style={styles.editIcon}>⚙️</Text>
          </TouchableOpacity>
        )}

        {canEdit && !isPrimaryOwner && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDeletePress}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.card,
  },
  primaryAdminCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
    borderWidth: 1.5,
  },
  leftInfoCol: {
    flex: 1,
    marginRight: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  adminBadge: {
    backgroundColor: '#FFEDD5',
  },
  staffBadge: {
    backgroundColor: '#DBEAFE',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  adminBadgeText: {
    color: '#C2410C',
  },
  staffBadgeText: {
    color: '#1E40AF',
  },
  emailText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  rightActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    padding: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editIcon: {
    fontSize: 14,
  },
  deleteBtn: {
    padding: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteIcon: {
    fontSize: 14,
  },
});
