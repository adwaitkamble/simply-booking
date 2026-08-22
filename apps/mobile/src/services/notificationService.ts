import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { ApiClient } from '../api/client';

// 1. Configure Foreground Notification Handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register device for Expo Push Notifications & send push token to PostgreSQL backend
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'web') {
    console.log('ℹ️ Push notifications are disabled on web browser platform.');
    return null;
  }

  if (!Device.isDevice) {
    console.log('ℹ️ Push notifications require a physical device or Expo Go app on mobile.');
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ Push notification permissions were not granted by the user.');
      return null;
    }

    // Retrieve Expo Push Token
    const pushTokenData = await Notifications.getExpoPushTokenAsync();
    token = pushTokenData.data;
    console.log('📲 [Expo Push Token Retrieved]:', token);

    // Save push token to backend
    if (token) {
      await ApiClient.savePushToken(token);
    }
  } catch (err) {
    console.warn('Notice registering for push notifications:', err);
  }

  // Android Notification Channel Setup
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0066FF',
    });
  }

  return token;
}
