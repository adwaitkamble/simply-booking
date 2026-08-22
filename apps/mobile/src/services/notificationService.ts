import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { ApiClient } from '../api/client';

// Detect if running inside Expo Go client app (SDK 53+ removed push token registration from Expo Go)
const isExpoGo =
  (Constants as any)?.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any)?.executionEnvironment === 'storeClient' ||
  (Constants as any)?.appOwnership === 'expo';

// Dynamic lazy module loader to prevent top-level side-effect errors (addPushTokenListener) in Expo Go
const getNotificationsModule = () => {
  if (Platform.OS === 'web' || isExpoGo) {
    return null;
  }
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
};

// 1. Configure Foreground Notification Handler safely (skip in Expo Go or Web to prevent SDK 53 errors)
const Notifications = getNotificationsModule();
if (Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Ignore unsupported environment error
  }
}

/**
 * Register device for Expo Push Notifications & send push token to PostgreSQL backend
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'web') {
    console.log('ℹ️ Push notifications are disabled on web browser platform.');
    return null;
  }

  // SDK 53+: Expo Go no longer supports remote push token registration. Development build required.
  if (isExpoGo) {
    console.log(
      'ℹ️ Expo Go app detected (SDK 53+). Remote push notifications require a standalone or development build. Skipping token registration.'
    );
    return null;
  }

  const NotificationsMod = getNotificationsModule();
  if (!NotificationsMod) {
    return null;
  }

  if (!Device.isDevice) {
    console.log('ℹ️ Push notifications require a physical device.');
  }

  try {
    const { status: existingStatus } = await NotificationsMod.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await NotificationsMod.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ Push notification permissions were not granted by the user.');
      return null;
    }

    // Retrieve Expo Push Token with optional projectId fallback from Constants
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

    const pushTokenData = await NotificationsMod.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    token = pushTokenData.data;
    console.log('📲 [Expo Push Token Retrieved]:', token);

    // Save push token to backend
    if (token) {
      await ApiClient.savePushToken(token);
    }
  } catch (err: any) {
    console.warn('Notice registering for push notifications:', err?.message || err);
  }

  // Android Notification Channel Setup
  if (Platform.OS === 'android') {
    try {
      await NotificationsMod.setNotificationChannelAsync('default', {
        name: 'default',
        importance: NotificationsMod.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0066FF',
      });
    } catch {
      // Ignore channel setup error
    }
  }

  return token;
}
