import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { colors, shadows } from '../theme';

interface SupportScreenProps {
  onBack: () => void;
}

export const SupportScreen: React.FC<SupportScreenProps> = ({ onBack }) => {
  const SUPPORT_PHONE = '8793091663';
  const SUPPORT_EMAIL = 'adwaitakamble007@gmail.com';

  const handleOpenWhatsApp = () => {
    const cleanPhone = '91' + SUPPORT_PHONE.replace(/[^0-9]/g, '');
    const message = encodeURIComponent('Hello Simply Booking Support team, I need assistance with my property.');
    const appUrl = `whatsapp://send?phone=${cleanPhone}&text=${message}`;
    const webUrl = `https://wa.me/${cleanPhone}?text=${message}`;

    if (Platform.OS === 'web') {
      window.open(webUrl, '_blank');
    } else {
      Linking.canOpenURL(appUrl)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(appUrl);
          } else {
            return Linking.openURL(webUrl);
          }
        })
        .catch(() => {
          Linking.openURL(webUrl);
        });
    }
  };

  const handleOpenEmail = () => {
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      'Simply Booking Support Request'
    )}&body=${encodeURIComponent('Hello Simply Booking Support team,\n\nI need assistance with:\n')}`;

    if (Platform.OS === 'web') {
      window.open(mailtoUrl, '_blank');
    } else {
      Linking.openURL(mailtoUrl).catch(() => {
        if (Platform.OS === 'web') {
          window.alert(`Please email us at: ${SUPPORT_EMAIL}`);
        }
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Header: Blue background (#0066FF / #0d6efd) with white back arrow & title */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Main Screen Content */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Need help? Contact us anytime.</Text>

        {/* Card 1: WhatsApp Support */}
        <TouchableOpacity
          style={styles.card}
          onPress={handleOpenWhatsApp}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.whatsappIconCircle}>
              <Text style={styles.whatsappIcon}>💬</Text>
            </View>
            <Text style={styles.cardTitle}>WhatsApp Support</Text>
          </View>
          <TouchableOpacity onPress={handleOpenWhatsApp} activeOpacity={0.7}>
            <Text style={styles.linkText}>Open with WhatsApp</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Card 2: Email Support */}
        <TouchableOpacity
          style={styles.card}
          onPress={handleOpenEmail}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.emailIconCircle}>
              <Text style={styles.emailIcon}>✉️</Text>
            </View>
            <Text style={styles.cardTitle}>Email Support</Text>
          </View>
          <TouchableOpacity onPress={handleOpenEmail} activeOpacity={0.7}>
            <Text style={styles.linkText}>{SUPPORT_EMAIL}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#0066FF',
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
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  scrollContent: {
    padding: 20,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 24,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  whatsappIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappIcon: {
    fontSize: 20,
  },
  emailIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailIcon: {
    fontSize: 18,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
  },
  linkText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066FF',
    textDecorationLine: 'underline',
    marginTop: 2,
  },
});
