import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { shadows } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 330);

export type DrawerMenuItemId =
  | 'bookings'
  | 'booking_report'
  | 'rooms'
  | 'invoice_settings'
  | 'tax_settings'
  | 'analytics'
  | 'additional_services'
  | 'my_team'
  | 'password_change'
  | 'subscriptions'
  | 'support'
  | 'logout';

interface MenuItemConfig {
  id: DrawerMenuItemId;
  label: string;
  icon: string;
  badge?: string;
  badgeColor?: string;
  isDestructive?: boolean;
}

const MENU_ITEMS: MenuItemConfig[] = [
  { id: 'bookings', label: 'Bookings', icon: '📖' },
  { id: 'booking_report', label: 'Booking Report', icon: '📄' },
  { id: 'rooms', label: 'Rooms', icon: '🛏️' },
  { id: 'invoice_settings', label: 'Invoice Settings', icon: '👤' },
  { id: 'tax_settings', label: 'Tax Settings', icon: '%' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'additional_services', label: 'Additional Services', icon: '⚙️' },
  { id: 'my_team', label: 'My Team', icon: '👥' },
  { id: 'password_change', label: 'Password Change', icon: '🔒' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📺' },
  { id: 'support', label: 'Support', icon: '🎧' },
  { id: 'logout', label: 'Log out', icon: '🚪', isDestructive: true },
];

interface NavigationDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSelectMenuItem: (id: DrawerMenuItemId) => void;
  onLogout?: () => void;
  propertyName?: string;
  ownerName?: string;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  visible,
  onClose,
  onSelectMenuItem,
  onLogout,
  propertyName = 'Kesar Villa',
  ownerName = 'Adwait Kamble',
}) => {
  const handleItemPress = (item: MenuItemConfig) => {
    onClose();
    if (item.id === 'logout') {
      if (onLogout) {
        if (Platform.OS === 'web') {
          if (window.confirm('Are you sure you want to log out of Simply booking?')) {
            onLogout();
          }
        } else {
          Alert.alert(
            'Log Out',
            'Are you sure you want to log out of Simply booking?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Log Out', style: 'destructive', onPress: onLogout },
            ]
          );
        }
      }
    } else {
      onSelectMenuItem(item.id);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop clickable overlay */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Slide-out Drawer Content */}
        <View style={styles.drawerContainer}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.drawerScrollContent}
          >
            {/* 1. Header Brand & Subscribed Badge */}
            <View style={styles.headerArea}>
              <View style={styles.subscribedRow}>
                <View style={styles.brandIconDots}>
                  <View style={[styles.dotPill, { backgroundColor: '#ef4444' }]} />
                  <View style={[styles.dotPill, { backgroundColor: '#f59e0b' }]} />
                  <View style={[styles.dotPill, { backgroundColor: '#10b981' }]} />
                </View>
                <Text style={styles.subscribedText}>Subscribed</Text>
              </View>

              <View style={styles.logoRow}>
                <Text style={styles.crownIcon}>🌿</Text>
                <Text style={styles.logoTextSimply}>Simply</Text>
                <View style={styles.bookingBadge}>
                  <Text style={styles.bookingBadgeText}>booking</Text>
                </View>
              </View>

              <Text style={styles.propertySubText} numberOfLines={1}>
                {propertyName} • {ownerName}
              </Text>
            </View>

            {/* 2. Menu Items List */}
            <View style={styles.menuList}>
              {MENU_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.menuItemRow}
                  activeOpacity={0.7}
                  onPress={() => handleItemPress(item)}
                >
                  <View style={styles.menuItemLeft}>
                    <Text style={styles.menuItemIcon}>{item.icon}</Text>
                    <Text
                      style={[
                        styles.menuItemLabel,
                        item.isDestructive && styles.destructiveLabel,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.badge ? (
                      <View style={[styles.badgePill, { backgroundColor: item.badgeColor || '#0066FF' }]}>
                        <Text style={styles.badgePillText}>{item.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.chevronIcon,
                      item.isDestructive && styles.destructiveChevron,
                    ]}
                  >
                    ›
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Close Drawer Button */}
          <TouchableOpacity
            style={styles.closeDrawerBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.closeDrawerText}>✕ Close Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  backdrop: {
    flex: 1,
  },
  drawerContainer: {
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
    paddingBottom: 24,
    justifyContent: 'space-between',
    ...shadows.modal,
  },
  drawerScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  // 1. Header Area
  headerArea: {
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  subscribedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  brandIconDots: {
    flexDirection: 'row',
    gap: 3,
  },
  dotPill: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subscribedText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.2,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  crownIcon: {
    fontSize: 22,
    marginTop: -4,
  },
  logoTextSimply: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0066FF',
    letterSpacing: -0.5,
  },
  bookingBadge: {
    backgroundColor: '#0066FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 2,
  },
  bookingBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  propertySubText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 6,
  },

  // 2. Language Box
  languageBox: {
    marginTop: 16,
    marginBottom: 8,
  },
  languageTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  languageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  globeIcon: {
    fontSize: 16,
  },
  languageLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  languageRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedLanguageText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  dropdownChevron: {
    fontSize: 10,
    color: '#64748B',
  },
  languageOptionsList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
    ...shadows.card,
  },
  languageOptionItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  languageOptionActive: {
    backgroundColor: '#EFF6FF',
  },
  languageOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  languageOptionTextActive: {
    fontWeight: '800',
    color: '#0066FF',
  },

  // 3. Menu List
  menuList: {
    marginTop: 8,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  menuItemIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  menuItemLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  destructiveLabel: {
    color: '#EF4444',
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  badgePillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  chevronIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#94A3B8',
  },
  destructiveChevron: {
    color: '#EF4444',
  },

  // Footer Close
  closeDrawerBtn: {
    marginHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    alignItems: 'center',
  },
  closeDrawerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
});
