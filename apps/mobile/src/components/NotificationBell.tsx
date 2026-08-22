import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ApiClient } from '../api/client';

interface NotificationBellProps {
  unreadCount?: number;
  onPress: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  unreadCount: propUnreadCount,
  onPress,
}) => {
  const [unreadCount, setUnreadCount] = useState<number>(propUnreadCount || 0);

  useEffect(() => {
    if (typeof propUnreadCount === 'number') {
      setUnreadCount(propUnreadCount);
    } else {
      const loadUnreadCount = async () => {
        try {
          const res = await ApiClient.fetchNotifications();
          setUnreadCount(res.unreadCount);
        } catch {
          // Ignore count load error
        }
      };
      loadUnreadCount();
    }
  }, [propUnreadCount]);

  return (
    <TouchableOpacity style={styles.bellContainer} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.bellIcon}>🔔</Text>
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  bellContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellIcon: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0066FF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
