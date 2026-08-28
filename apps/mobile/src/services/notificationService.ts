import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { ApiClient } from '../api/client';

// Detect if running inside Expo Go client app (SDK 53+ removed push token registration from Expo Go)
const isExpoGo =
  (Constants as any)?.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any)?.executionEnvironment === 'storeClient' ||
  (Constants as any)?.appOwnership === 'expo';

// Dynamic lazy module loader — avoids top-level side-effects that crash production builds.
// expo-notifications must never be imported at module scope in a standalone APK
// because its native module initializes notification channels on load.
const getNotificationsModule = () => {
  if (Platform.OS === 'web' || isExpoGo) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications');
  } catch {
    return null;
  }
};

// Configure foreground notification handler — called lazily, never at module top-level.
// This is invoked once from registerForPushNotificationsAsync, not on import.
function configureNotificationHandler() {
  try {
    const Notifications = getNotificationsModule();
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
  } catch (err) {
    console.warn('Notice setting up notification handler:', err);
  }
}

/**
 * Register device for Expo Push Notifications & send push token to backend.
 * Safe to call in any environment — silently skips unsupported platforms.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'web') {
    return null;
  }

  // SDK 53+: Expo Go no longer supports remote push token registration.
  if (isExpoGo) {
    return null;
  }

  const NotificationsMod = getNotificationsModule();
  if (!NotificationsMod) {
    return null;
  }

  // Configure the handler here, lazily, after we know the module loaded correctly.
  configureNotificationHandler();

  if (!Device.isDevice) {
    console.log('ℹ️ Push notifications require a physical device.');
    return null;
  }

  try {
    const { status: existingStatus } = await NotificationsMod.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await NotificationsMod.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ Push notification permissions were not granted.');
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

    const pushTokenData = await NotificationsMod.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    token = pushTokenData.data;

    if (token) {
      await ApiClient.savePushToken(token);
    }
  } catch (err: any) {
    console.warn('Notice registering for push notifications:', err?.message || err);
  }

  // Android notification channel setup
  if (Platform.OS === 'android' && NotificationsMod) {
    try {
      await NotificationsMod.setNotificationChannelAsync('default', {
        name: 'default',
        importance: NotificationsMod.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0066FF',
      });
    } catch {
      // Non-fatal — channel setup failure does not affect core functionality
    }
  }

  return token;
}
