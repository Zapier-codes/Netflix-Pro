// src/services/notification/NotificationService.ts

export type NotificationType = 
  | 'new_episode'
  | 'new_movie'
  | 'trending'
  | 'recommendation'
  | 'system'
  | 'update'
  | 'reminder'
  | 'comment'
  | 'like'
  | 'follow';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
  data?: {
    mediaId?: string;
    mediaType?: 'movie' | 'tv';
    showTitle?: string;
    movieTitle?: string;
    title?: string;
    category?: string;
    version?: string;
    message?: string;
    username?: string;
    comment?: string;
    userId?: string;
  };
}

export class NotificationService {
  private notifications: Notification[] = [];
  private listeners: ((notifications: Notification[]) => void)[] = [];

  constructor() {
    // Load from storage or initialize with sample data
    this.loadSampleNotifications();
  }

  private loadSampleNotifications(): void {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const twoHoursAgo = new Date(now.getTime() - 7200000);
    const oneDayAgo = new Date(now.getTime() - 86400000);
    const twoDaysAgo = new Date(now.getTime() - 172800000);

    this.notifications = [
      {
        id: '1',
        type: 'new_episode',
        title: 'New Episode Available',
        body: 'Stranger Things Season 4 - Episode 5 is now available!',
        read: false,
        createdAt: oneHourAgo,
        data: {
          showTitle: 'Stranger Things',
          mediaId: '12345',
          mediaType: 'tv',
        },
      },
      {
        id: '2',
        type: 'new_movie',
        title: 'New Movie Added',
        body: 'Dune: Part Two has been added to the catalog.',
        read: false,
        createdAt: twoHoursAgo,
        data: {
          movieTitle: 'Dune: Part Two',
          mediaId: '67890',
          mediaType: 'movie',
        },
      },
      {
        id: '3',
        type: 'trending',
        title: 'Trending Now',
        body: 'The Last of Us is trending in your region!',
        read: true,
        createdAt: oneDayAgo,
        data: {
          title: 'The Last of Us',
          category: 'Drama',
          mediaId: '11111',
        },
      },
      {
        id: '4',
        type: 'recommendation',
        title: 'Recommendation for You',
        body: 'Based on your watch history, you might enjoy "The Bear".',
        read: true,
        createdAt: twoDaysAgo,
        data: {
          title: 'The Bear',
          mediaId: '22222',
        },
      },
      {
        id: '5',
        type: 'system',
        title: 'System Update',
        body: 'Your watch history has been synced successfully.',
        read: true,
        createdAt: twoDaysAgo,
        data: {
          message: 'Sync completed',
        },
      },
      {
        id: '6',
        type: 'update',
        title: 'App Update Available',
        body: 'Version 2.5.0 is now available. Update for new features!',
        read: false,
        createdAt: oneDayAgo,
        data: {
          version: '2.5.0',
        },
      },
      {
        id: '7',
        type: 'reminder',
        title: 'Continue Watching',
        body: 'You paused "Breaking Bad" - Season 3, Episode 7.',
        read: false,
        createdAt: twoHoursAgo,
        data: {
          title: 'Breaking Bad',
          mediaId: '33333',
        },
      },
      {
        id: '8',
        type: 'comment',
        title: 'New Comment',
        body: 'JohnDoe commented on your review of "Inception".',
        read: false,
        createdAt: oneHourAgo,
        data: {
          username: 'JohnDoe',
          comment: 'Great review! I completely agree.',
          mediaId: '44444',
        },
      },
      {
        id: '9',
        type: 'like',
        title: 'New Like',
        body: 'JaneSmith liked your review of "The Dark Knight".',
        read: true,
        createdAt: oneDayAgo,
        data: {
          username: 'JaneSmith',
          title: 'The Dark Knight',
          mediaId: '55555',
        },
      },
      {
        id: '10',
        type: 'follow',
        title: 'New Follower',
        body: 'AlexJohnson started following you!',
        read: false,
        createdAt: oneHourAgo,
        data: {
          username: 'AlexJohnson',
          userId: 'user_123',
        },
      },
    ];
  }

  async getNotifications(): Promise<Notification[]> {
    return this.notifications;
  }

  async markAsRead(id: string): Promise<void> {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.notifyListeners();
    }
  }

  async markAllAsRead(): Promise<void> {
    this.notifications.forEach(n => n.read = true);
    this.notifyListeners();
  }

  async deleteNotification(id: string): Promise<void> {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notifyListeners();
  }

  async clearAll(): Promise<void> {
    this.notifications = [];
    this.notifyListeners();
  }

  async addNotification(notification: Partial<Notification>): Promise<void> {
    const newNotification: Notification = {
      id: Date.now().toString(),
      type: notification.type || 'system',
      title: notification.title || 'New Notification',
      body: notification.body || '',
      read: false,
      createdAt: new Date(),
      data: notification.data || {},
    };
    this.notifications.unshift(newNotification);
    this.notifyListeners();
  }

  subscribe(listener: (notifications: Notification[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.notifications));
  }
}

export const notificationService = new NotificationService();
export default notificationService;