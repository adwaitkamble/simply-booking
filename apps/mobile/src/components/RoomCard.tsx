import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { shadows } from '../theme';

export interface RoomItemData {
  roomId: string;
  imageUrl: string;
  categoryName: string;
  roomName: string;
  status: string;
  childCount: number;
  adultCount: number;
}

interface RoomCardProps {
  room: RoomItemData;
  onPress?: (room: RoomItemData) => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, onPress }) => {
  const safeRoom = room || ({} as RoomItemData);
  const {
    imageUrl = '',
    categoryName = 'Standard',
    roomName = 'Unnamed room',
    status = 'Unknown',
    childCount = 0,
    adultCount = 0,
  } = safeRoom;

  const getStatusStyle = () => {
    switch (String(status).toLowerCase()) {
      case 'active':
      case 'clean':
        return {
          bg: '#DCFCE7',
          text: '#15803D',
        };
      case 'dirty':
      case 'occupied':
        return {
          bg: '#FEE2E2',
          text: '#B91C1C',
        };
      case 'maintenance':
        return {
          bg: '#FEF3C7',
          text: '#B45309',
        };
      default:
        return {
          bg: '#E2E8F0',
          text: '#475569',
        };
    }
  };

  const statusStyle = getStatusStyle();

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={() => onPress?.(safeRoom)}
      activeOpacity={0.8}
    >
      {/* Left: Square Image Thumbnail */}
      <Image
        source={{ uri: imageUrl || 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=500&auto=format&fit=crop&q=60' }}
        style={styles.thumbnail}
        resizeMode="cover"
      />

      {/* Right: Info Section */}
      <View style={styles.infoContainer}>
        {/* Top Header: Category & Status Pill */}
        <View style={styles.titleRow}>
          <View style={styles.titleTextCol}>
            <Text style={styles.categoryNameText} numberOfLines={1}>
              {categoryName}
            </Text>
            <Text style={styles.roomNameText} numberOfLines={1}>
              {roomName}
            </Text>
          </View>

          <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusPillText, { color: statusStyle.text }]}>
              {status}
            </Text>
          </View>
        </View>

        {/* Bottom Row: Child & Adult Occupancy Pills */}
        <View style={styles.occupancyRow}>
          <View style={styles.countPill}>
            <Text style={styles.pillIcon}>👶</Text>
            <Text style={styles.pillText}>{childCount} Child</Text>
          </View>

          <View style={styles.countPill}>
            <Text style={styles.pillIcon}>👤</Text>
            <Text style={styles.pillText}>{adultCount} Adults</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    ...shadows.card,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
    height: 80,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleTextCol: {
    flex: 1,
    marginRight: 6,
  },
  categoryNameText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  roomNameText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  occupancyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pillIcon: {
    fontSize: 11,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
});
