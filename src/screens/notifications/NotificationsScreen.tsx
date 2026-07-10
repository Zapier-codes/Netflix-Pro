// src/screens/notifications/NotificationsScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

// Hooks & Context
import { useTheme } from '../../contexts/ThemeContext';
import { useAlert } from '../../contexts/AlertContext';

// Services
import { notificationService, Notification, NotificationType } from '../../services/notification/NotificationService';

// Components
import { AnimatedHeader } from '../../components/header/AnimatedHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Notification Icon Mapping ───
const NOTIFICATION_ICONS: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  new_episode: { icon: 'tv-outline', color: '#4FC3F7' },
  new_movie: { icon: 'film-outline', color: '#81C784' },
  trending: { icon: 'trending-up-outline', color: '#FFB74D' },
  recommendation: { icon: 'bulb-outline', color: '#CE93D8' },
  system: { icon: 'information-circle-outline', color: '#90CAF9' },
  update: { icon: 'cloud-upload-outline', color: '#AED581' },
  reminder: { icon: 'alarm-outline', color: '#FF8A65' },
  comment: { icon: 'chatbubble-outline', color: '#4DD0E1' },
  like: { icon: 'heart-outline', color: '#EF5350' },
  follow: { icon: 'person-add-outline', color: '#66BB6A' },
};

// ─── Get Time Ago ───
const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
};

// ─── Format Notification Body ───
const formatNotificationBody = (notification: Notification): string => {
  const { type, data } = notification;
  
  switch (type) {
    case 'new_episode':
      return `New episode of "${data?.showTitle || 'a show"}" is now available!`;
    case 'new_movie':
      return `"${data?.movieTitle || 'A new movie"}" has been added to the catalog.`;
    case 'trending':
      return `"${data?.title || 'A title"}" is trending in ${data?.category || 'your region'}.`;
    case 'recommendation':
      return `We think you'll love "${data?.title || 'this title"}' based on your watch history.`;
    case 'system':
      return data?.message || 'System notification';
    case 'update':
      return `App update available! Version ${data?.version || 'latest'} is ready.`;
    case 'reminder':
      return `Don't forget to continue watching "${data?.title || 'your show"}'!`;
    case 'comment':
      return `${data?.username || 'Someone'} commented: "${data?.comment || '...'}"`;
    case 'like':
      return `${data?.username || 'Someone'} liked your review of "${data?.title || 'a title"}'`;
    case 'follow':
      return `${data?.username || 'Someone'} started following you!`;
    default:
      return data?.message || notification.title || 'New notification';
  }
};

// ─── Notification Item ───
const NotificationItem = React.memo(({ 
  notification, 
  onPress,
  onSwipeDelete,
}: {
  notification: Notification;
  onPress: (notification: Notification) => void;
  onSwipeDelete?: (id: string) => void;
}) => {
  const { colors, isDark } = useTheme();
  const [isDeleting, setIsDeleting] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeThreshold = -80;

  const iconConfig = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.system;

  const handleDelete = () => {
    setIsDeleting(true);
    Animated.timing(translateX, {
      toValue: -SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onSwipeDelete?.(notification.id);
    });
  };

  const handlePress = () => {
    onPress(notification);
  };

  return (
    <Animated.View
      style={{
        transform: [{ translateX }],
        marginHorizontal: 16,
        marginVertical: 4,
      }}
    >
      <TouchableOpacity
        style={[
          styles.notificationItem,
          {
            backgroundColor: isDark 
              ? (notification.read ? colors.surface : colors.surfaceRaised)
              : (notification.read ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)'),
            borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.3)',
            borderWidth: 0.5,
          }
        ]}
        activeOpacity={0.7}
        onPress={handlePress}
      >
        {/* Unread dot */}
        {!notification.read && (
          <View style={[styles.unreadDot, { backgroundColor: colors.gold }]} />
        )}

        {/* Icon */}
        <View style={[
          styles.iconContainer,
          { backgroundColor: `${iconConfig.color}20` }
        ]}>
          <Ionicons name={iconConfig.icon} size={22} color={iconConfig.color} />
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <Text style={[styles.notificationTitle, { color: colors.text }]}>
            {notification.title}
          </Text>
          <Text style={[styles.notificationBody, { color: colors.textSub }]} numberOfLines={2}>
            {formatNotificationBody(notification)}
          </Text>
          <Text style={[styles.notificationTime, { color: colors.textMuted }]}>
            {getTimeAgo(notification.createdAt)}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

NotificationItem.displayName = 'NotificationItem';

// ─── Main Screen ───
const NotificationsScreen = () => {
  const { colors, isDark } = useTheme();
  const { showToast } = useAlert();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // ─── Load Notifications ───
  const loadNotifications = useCallback(async (showLoading: boolean = true) => {
    if (showLoading) setLoading(true);
    try {
      const allNotifications = await notificationService.getNotifications();
      const sorted = allNotifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setNotifications(sorted);
      setHasUnread(sorted.some(n => !n.read));
    } catch (error) {
      console.error('[Notifications] Failed to load:', error);
      showToast('Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  // ─── Mark as Read ───
  const markAsRead = useCallback(async (notification: Notification) => {
    if (notification.read) return;
    try {
      await notificationService.markAsRead(notification.id);
      setNotifications(prev => 
        prev.map(n => 
          n.id === notification.id ? { ...n, read: true } : n
        )
      );
      setHasUnread(prev => {
        const remaining = notifications.some(n => n.id !== notification.id && !n.read);
        return remaining;
      });
    } catch (error) {
      console.error('[Notifications] Failed to mark as read:', error);
    }
  }, [notifications]);

  // ─── Delete Notification ───
  const deleteNotification = useCallback(async (id: string) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setHasUnread(prev => {
        const remaining = notifications.some(n => n.id !== id && !n.read);
        return remaining;
      });
    } catch (error) {
      console.error('[Notifications] Failed to delete:', error);
      showToast('Failed to delete notification');
    }
  }, [notifications, showToast]);

  // ─── Mark All as Read ───
  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
      setHasUnread(false);
      showToast('All notifications marked as read');
    } catch (error) {
      console.error('[Notifications] Failed to mark all as read:', error);
      showToast('Failed to mark all as read');
    }
  }, [notifications, showToast]);

  // ─── Clear All ───
  const clearAll = useCallback(async () => {
    if (notifications.length === 0) return;
    
    try {
      await notificationService.clearAll();
      setNotifications([]);
      setHasUnread(false);
      showToast('All notifications cleared');
    } catch (error) {
      console.error('[Notifications] Failed to clear all:', error);
      showToast('Failed to clear all notifications');
    }
  }, [notifications, showToast]);

  // ─── Handle Notification Press ───
  const handleNotificationPress = useCallback(async (notification: Notification) => {
    // Mark as read
    await markAsRead(notification);

    // Navigate based on notification type
    const { type, data } = notification;
    switch (type) {
      case 'new_episode':
      case 'new_movie':
      case 'recommendation':
      case 'reminder':
        if (data?.mediaId) {
          router.push(`/movie/${data.mediaId}`);
        }
        break;
      case 'comment':
      case 'like':
        if (data?.mediaId) {
          router.push(`/movie/${data.mediaId}`);
        }
        break;
      case 'trending':
        if (data?.category) {
          router.push(`/search?category=${encodeURIComponent(data.category)}`);
        }
        break;
      case 'update':
        // Navigate to settings or update page
        router.push('/(tabs)/settings');
        break;
      case 'follow':
        if (data?.userId) {
          router.push(`/profile/${data.userId}`);
        }
        break;
      default:
        // Just mark as read, no navigation
        break;
    }
  }, [router, markAsRead]);

  // ─── Refresh ───
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications(false);
  }, [loadNotifications]);

  // ─── Load on Focus ───
  useFocusEffect(
    useCallback(() => {
      loadNotifications(true);
      return () => {};
    }, [loadNotifications])
  );

  // ─── Get Filtered Notifications ───
  const filteredNotifications = notifications.filter(n => 
    filter === 'all' ? true : !n.read
  );

  // ─── Render Empty State ───
  const renderEmptyState = () => (
    <View style={styles.centerContent}>
      <View style={[
        styles.emptyIconContainer,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        }
      ]}>
        <Ionicons name="notifications-outline" size={48} color={colors.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
        {filter === 'unread' 
          ? 'You\'ve read all your notifications!' 
          : 'When you get notifications, they\'ll appear here'}
      </Text>
    </View>
  );

  // ─── Render Header ───
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerTop}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Notifications
          {hasUnread && (
            <Text style={[styles.unreadBadge, { color: colors.gold }]}>
              {' '}• {notifications.filter(n => !n.read).length} new
            </Text>
          )}
        </Text>
        <View style={styles.headerActions}>
          {hasUnread && (
            <TouchableOpacity
              style={styles.headerAction}
              onPress={markAllAsRead}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="checkmark-done-outline" size={22} color={colors.gold} />
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity
              style={styles.headerAction}
              onPress={clearAll}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'all' && { borderBottomColor: colors.gold, borderBottomWidth: 2 },
          ]}
          onPress={() => setFilter('all')}
        >
          <Text style={[
            styles.filterTabText,
            { color: filter === 'all' ? colors.text : colors.textMuted }
          ]}>
            All ({notifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'unread' && { borderBottomColor: colors.gold, borderBottomWidth: 2 },
          ]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[
            styles.filterTabText,
            { color: filter === 'unread' ? colors.text : colors.textMuted }
          ]}>
            Unread ({notifications.filter(n => !n.read).length})
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── Main Render ───
  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: 'transparent' }]}
      edges={['top']}
    >
      {/* ─── Background Gradient ─── */}
      {!isDark && (
        <LinearGradient
          colors={['#E8F0F8', '#D4E4F7', '#C8D8EF']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      
      {isDark && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000000' }]} />
      )}

      {/* ─── Header ─── */}
      <AnimatedHeader
        onSearchPress={() => router.push('/search')}
        notificationCount={notifications.filter(n => !n.read).length}
      />

      {/* ─── Main Content ─── */}
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading notifications...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onPress={handleNotificationPress}
              onSwipeDelete={deleteNotification}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold}
              colors={[colors.gold]}
              progressBackgroundColor={isDark ? colors.surface : 'rgba(255,255,255,0.8)'}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 40,
  },
  headerContainer: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  unreadBadge: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerAction: {
    padding: 4,
  },
  filterTabs: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 24,
  },
  filterTab: {
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    position: 'relative',
    ...(Platform.OS === 'ios' && {
      backdropFilter: 'blur(20px)',
    }),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
    flexShrink: 0,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  contentContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  notificationBody: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  notificationTime: {
    fontSize: 11,
    marginTop: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButton: {
    padding: 4,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationsScreen;