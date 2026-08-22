import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AddReservationScreen } from '../screens/AddReservationScreen';
import { BookingsScreen } from '../screens/BookingsScreen';
import { RoomsScreen } from '../screens/RoomsScreen';
import { MyTeamScreen } from '../screens/MyTeamScreen';
import { EditUserScreen } from '../screens/EditUserScreen';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { SupportScreen } from '../screens/SupportScreen';
import { HousekeepingScreen } from '../screens/HousekeepingScreen';
import { InvoiceScreen } from '../screens/InvoiceScreen';
import { ChannelManagerScreen } from '../screens/ChannelManagerScreen';
import { AvailableRoomItem } from '../api/client';
import { shadows } from '../theme';

type TabName = 'booking' | 'housekeeping' | 'invoicing' | 'channel';
type ScreenName = 'dashboard' | 'addReservation' | 'bookings' | 'rooms' | 'myTeam' | 'editUser' | 'changePassword' | 'support' | 'housekeeping' | 'invoicing' | 'channel';

interface NavigationState {
  currentTab: TabName;
  currentScreen: ScreenName;
  selectedRoom: AvailableRoomItem | null;
  checkIn: string;
  checkOut: string;
  activeReservationId?: string;
  prefilledRoomId?: string;
  prefilledRoomNumber?: string;
  focusedCalendarDate?: string;
  selectedTeamUserForEdit?: any;
}

export const Navigator: React.FC = () => {
  const { user, property, isAuthenticated, isLoading, logout } = useAuth();
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const checkoutStr = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [navState, setNavState] = useState<NavigationState>({
    currentTab: 'booking',
    currentScreen: 'dashboard',
    selectedRoom: null,
    checkIn: todayStr,
    checkOut: checkoutStr,
    activeReservationId: undefined,
    focusedCalendarDate: undefined,
  });

  // Handle Loading Session State
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingLogoRow}>
          <Text style={styles.loadingLeaf}>🌿</Text>
          <Text style={styles.loadingBrandText}>SIMPLY </Text>
          <Text style={styles.loadingBrandBadge}>booking</Text>
        </View>
        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 24 }} />
        <Text style={styles.loadingText}>Restoring your secure hotel session...</Text>
      </View>
    );
  }

  // Handle Unauthenticated State (Login / Register)
  if (!isAuthenticated) {
    if (authScreen === 'register') {
      return <RegisterScreen onNavigateToLogin={() => setAuthScreen('login')} />;
    }
    return <LoginScreen onNavigateToRegister={() => setAuthScreen('register')} />;
  }

  // Authenticated State - Main Application
  const switchTab = (tab: TabName) => {
    setNavState((prev) => ({
      ...prev,
      currentTab: tab,
      currentScreen:
        tab === 'booking'
          ? 'dashboard'
          : tab === 'housekeeping'
          ? 'housekeeping'
          : tab === 'invoicing'
          ? 'invoicing'
          : 'channel',
      selectedRoom: null,
    }));
  };

  const navigateToAddReservation = (prefilled?: {
    roomId?: string;
    roomNumber?: string;
    checkIn?: string;
    checkOut?: string;
  }) => {
    setNavState((prev) => ({
      ...prev,
      currentScreen: 'addReservation',
      prefilledRoomId: prefilled?.roomId,
      prefilledRoomNumber: prefilled?.roomNumber,
      checkIn: prefilled?.checkIn || prev.checkIn,
      checkOut: prefilled?.checkOut || prev.checkOut,
    }));
  };

  const navigateToDashboard = (focusedDate?: string) => {
    setNavState((prev) => ({
      ...prev,
      currentTab: 'booking',
      currentScreen: 'dashboard',
      selectedRoom: null,
      prefilledRoomId: undefined,
      prefilledRoomNumber: undefined,
      focusedCalendarDate: focusedDate || prev.focusedCalendarDate,
    }));
  };

  const navigateToBookings = () => {
    setNavState((prev) => ({
      ...prev,
      currentTab: 'booking',
      currentScreen: 'bookings',
    }));
  };

  const navigateToRooms = () => {
    setNavState((prev) => ({
      ...prev,
      currentTab: 'booking',
      currentScreen: 'rooms',
    }));
  };

  const navigateToMyTeam = () => {
    setNavState((prev) => ({
      ...prev,
      currentTab: 'booking',
      currentScreen: 'myTeam',
    }));
  };

  const navigateToEditUser = (userForEdit?: any) => {
    setNavState((prev) => ({
      ...prev,
      currentTab: 'booking',
      currentScreen: 'editUser',
      selectedTeamUserForEdit: userForEdit || null,
    }));
  };

  const navigateToChangePassword = () => {
    setNavState((prev) => ({
      ...prev,
      currentTab: 'booking',
      currentScreen: 'changePassword',
    }));
  };

  const navigateToSupport = () => {
    setNavState((prev) => ({
      ...prev,
      currentTab: 'booking',
      currentScreen: 'support',
    }));
  };

  const navigateToInvoice = (reservationId: string) => {
    setNavState((prev) => ({
      ...prev,
      currentTab: 'invoicing',
      currentScreen: 'invoicing',
      activeReservationId: reservationId,
    }));
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your property dashboard?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setProfileModalVisible(false);
            await logout();
          },
        },
      ]
    );
  };

  const tabs: { id: TabName; label: string; icon: string }[] = [
    { id: 'booking', label: 'Calendar', icon: '📅' },
    { id: 'housekeeping', label: 'Cleaning', icon: '🧹' },
    { id: 'invoicing', label: 'Folio & Bill', icon: '💳' },
    { id: 'channel', label: 'OTA Hub', icon: '🌐' },
  ];

  return (
    <View style={styles.container}>
      {/* Top SaaS User Profile Bar */}
      <View style={styles.topTenantBar}>
        <View style={styles.tenantInfoCol}>
          <Text style={styles.tenantPropertyName} numberOfLines={1}>
            {property?.name || 'My Hotel Property'}
          </Text>
          <Text style={styles.tenantUserGreeting}>
            👤 {user?.name || 'Property Owner'} • {property?.city || 'India'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => setProfileModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.profileButtonText}>
            {(user?.name || 'Owner').slice(0, 2).toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Screen Content Area */}
      <View style={styles.content}>
        {navState.currentTab === 'booking' && (
          <>
            {navState.currentScreen === 'dashboard' && (
              <DashboardScreen
                focusedDate={navState.focusedCalendarDate}
                onOpenBookingForm={navigateToAddReservation}
                onOpenInvoice={navigateToInvoice}
                onOpenBookings={navigateToBookings}
                onOpenRooms={navigateToRooms}
                onOpenMyTeam={navigateToMyTeam}
                onOpenChangePassword={navigateToChangePassword}
                onOpenSupport={navigateToSupport}
                onLogout={handleLogout}
                onNavigateTab={switchTab}
              />
            )}
            {navState.currentScreen === 'bookings' && (
              <BookingsScreen
                onBack={() => navigateToDashboard()}
                onSelectBooking={(b) => {
                  if (b.id) navigateToInvoice(b.id);
                }}
              />
            )}
            {navState.currentScreen === 'rooms' && (
              <RoomsScreen
                onBack={() => navigateToDashboard()}
              />
            )}
            {navState.currentScreen === 'myTeam' && (
              <MyTeamScreen
                onBack={() => navigateToDashboard()}
                onOpenEditUser={(targetUser) => navigateToEditUser(targetUser)}
              />
            )}
            {navState.currentScreen === 'editUser' && (
              <EditUserScreen
                initialUser={navState.selectedTeamUserForEdit}
                onBack={() => navigateToMyTeam()}
                onSuccess={() => navigateToMyTeam()}
              />
            )}
            {navState.currentScreen === 'changePassword' && (
              <ChangePasswordScreen
                onBack={() => navigateToDashboard()}
                onSuccess={() => navigateToDashboard()}
              />
            )}
            {navState.currentScreen === 'support' && (
              <SupportScreen
                onBack={() => navigateToDashboard()}
              />
            )}
            {navState.currentScreen === 'addReservation' && (
              <AddReservationScreen
                initialRoomId={navState.prefilledRoomId}
                initialRoomNumber={navState.prefilledRoomNumber}
                initialCheckIn={navState.checkIn}
                initialCheckOut={navState.checkOut}
                onBack={() => navigateToDashboard()}
                onBookingSuccess={(resId, bookedCheckIn) => {
                  navigateToBookings();
                }}
              />
            )}
          </>
        )}

        {navState.currentTab === 'housekeeping' && <HousekeepingScreen />}

        {navState.currentTab === 'invoicing' && (
          <InvoiceScreen initialReservationId={navState.activeReservationId} />
        )}

        {navState.currentTab === 'channel' && <ChannelManagerScreen />}
      </View>

      {/* Elegant Bottom Navigation Bar */}
      <View style={styles.bottomNavContainer}>
        <View style={styles.bottomNavTrack}>
          {tabs.map((t) => {
            const isActive = navState.currentTab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.tabItem, isActive && styles.activeTabItem]}
                onPress={() => switchTab(t.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.tabIconBadge, isActive && styles.activeTabIconBadge]}>
                  <Text style={[styles.tabIconText, isActive && styles.activeTabIconText]}>
                    {t.icon}
                  </Text>
                </View>
                <Text
                  style={[styles.tabLabel, isActive && styles.activeTabLabel]}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Tenant Account & Logout Modal */}
      <Modal
        visible={profileModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setProfileModalVisible(false)}
        >
          <View style={styles.profileCard}>
            <View style={styles.profileCardHeader}>
              <View style={styles.profileAvatarLarge}>
                <Text style={styles.profileAvatarText}>
                  {(user?.name || 'Owner').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.profileName}>{user?.name}</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
                <View style={styles.roleTag}>
                  <Text style={styles.roleTagText}>👑 Property Owner</Text>
                </View>
              </View>
            </View>

            <View style={styles.propertyDetailsBox}>
              <Text style={styles.propDetailTitle}>🏨 Active Property Tenant</Text>
              <Text style={styles.propDetailValue}>{property?.name}</Text>
              <Text style={styles.propDetailSub}>
                Location: {property?.city || 'Pune'}, {property?.country || 'India'}
              </Text>
              <Text style={styles.propDetailSub}>
                Base Currency: {property?.currency || 'INR'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.85}
            >
              <Text style={styles.logoutButtonText}>🚪 Sign Out of Simply Booking</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  topTenantBar: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  tenantInfoCol: {
    flex: 1,
    marginRight: 12,
  },
  tenantPropertyName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  tenantUserGreeting: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  profileButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  profileButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  content: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingLeaf: {
    fontSize: 32,
    marginRight: 6,
  },
  loadingBrandText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 1.5,
  },
  loadingBrandBadge: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  bottomNavContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    paddingTop: 6,
    paddingBottom: Platform.OS === 'android' ? 10 : 22,
    paddingHorizontal: 8,
    ...shadows.cardHover,
  },
  bottomNavTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeTabItem: {
    backgroundColor: '#eff6ff',
  },
  tabIconBadge: {
    width: 34,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  activeTabIconBadge: {
    backgroundColor: '#dbeafe',
  },
  tabIconText: {
    fontSize: 18,
  },
  activeTabIconText: {
    transform: [{ scale: 1.1 }],
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  activeTabLabel: {
    color: '#1d4ed8',
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  profileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileAvatarLarge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  propertyDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  propDetailTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  propDetailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  propDetailSub: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '700',
  },
});
