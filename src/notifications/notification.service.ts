import { Notification } from "./notification.entity";

export class NotificationService {
  private notifications: Notification[] = [];

  async getNotifications(userId: string, page = 1, limit = 20) {
    const start = (page - 1) * limit;
    return this.notifications
      .filter((n) => n.userId === userId)
      .slice(start, start + limit);
  }

  async markAsRead(id: string) {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) notif.isRead = true;
    return notif;
  }

  async markAllAsRead(userId: string) {
    this.notifications.forEach((n) => {
      if (n.userId === userId) n.isRead = true;
    });
  }

  async getUnreadCount(userId: string) {
    return this.notifications.filter((n) => n.userId === userId && !n.isRead).length;
  }

  async createNotification(notification: Notification) {
    this.notifications.push(notification);
    return notification;
  }
}
