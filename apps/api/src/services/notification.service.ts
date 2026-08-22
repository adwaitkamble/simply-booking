import { prisma } from '@hotel-pms/database';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import type { NotificationDTO, NotificationType } from '@hotel-pms/types';

// Create Expo SDK Client
const expo = new Expo();

export class NotificationService {
  /**
   * Save or update Expo Push Token for user profile
   */
  static async savePushToken(userId: string, pushToken: string): Promise<void> {
    if (!pushToken) return;

    await prisma.users.update({
      where: { id: userId },
      data: { pushToken: pushToken.trim() },
    });
  }

  /**
   * Fetch top 50 notifications for logged-in user with unread count
   */
  static async getNotifications(userId: string): Promise<{ notifications: NotificationDTO[]; unreadCount: number }> {
    const notifications = await prisma.notifications.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notifications.count({
      where: { userId, isRead: false },
    });

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        propertyId: n.propertyId,
        userId: n.userId,
        title: n.title,
        body: n.body,
        type: n.type as NotificationType,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      unreadCount,
    };
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(notificationId: string, userId: string): Promise<NotificationDTO> {
    const updated = await prisma.notifications.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });

    const notification = await prisma.notifications.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      const error: any = new Error('Notification not found.');
      error.statusCode = 404;
      throw error;
    }

    return {
      id: notification.id,
      propertyId: notification.propertyId,
      userId: notification.userId,
      title: notification.title,
      body: notification.body,
      type: notification.type as NotificationType,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    };
  }

  /**
   * Send Push Notification via Expo Server SDK & persist to PostgreSQL Notifications table
   */
  static async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    type: NotificationType = 'SYSTEM',
    dataPayload: any = {}
  ): Promise<NotificationDTO | null> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.warn(`[NotificationService] Cannot send notification: User #${userId} not found`);
      return null;
    }

    // 1. Save in-app notification record to PostgreSQL database
    const dbRecord = await prisma.notifications.create({
      data: {
        propertyId: user.propertyId,
        userId: user.id,
        title,
        body,
        type: type as any,
        isRead: false,
      },
    });

    // 2. Dispatch Expo Push Notification if user has a valid Expo push token
    if (user.pushToken && Expo.isExpoPushToken(user.pushToken)) {
      const messages: ExpoPushMessage[] = [
        {
          to: user.pushToken,
          sound: 'default',
          title,
          body,
          data: {
            notificationId: dbRecord.id,
            type,
            ...dataPayload,
          },
        },
      ];

      try {
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          console.log('📲 [Expo Push Ticket Result]:', ticketChunk);
        }
      } catch (pushErr) {
        console.error('⚠️ [NotificationService] Error sending Expo push notification:', pushErr);
      }
    } else if (user.pushToken) {
      console.warn(`⚠️ [NotificationService] Token "${user.pushToken}" is not a valid Expo push token.`);
    }

    return {
      id: dbRecord.id,
      propertyId: dbRecord.propertyId,
      userId: dbRecord.userId,
      title: dbRecord.title,
      body: dbRecord.body,
      type: dbRecord.type as NotificationType,
      isRead: dbRecord.isRead,
      createdAt: dbRecord.createdAt,
    };
  }
}
