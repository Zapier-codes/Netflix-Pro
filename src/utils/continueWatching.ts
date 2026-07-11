/**
 * Continue Watching - Local storage utility for tracking watch progress
 * Stores progress locally without requiring an account
 * Supports: saving progress, loading items, removing items, updating progress
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CONTINUE_WATCHING_KEY = '@continue_watching';
const MAX_ITEMS = 50;

export interface ContinueWatchingItem {
  id: string;
  type: 'movie' | 'tv';
  title: string;
  poster?: string;
  backdrop?: string;
  progress: number; // 0-1 percentage
  duration: number; // total duration in seconds
  lastWatchedAt: number; // timestamp
  season?: number;
  episode?: number;
  episodeTitle?: string;
  source?: string;
  overview?: string;
  rating?: number;
  year?: number;
}

/**
 * Get all continue watching items
 */
export async function getContinueWatching(): Promise<ContinueWatchingItem[]> {
  try {
    const data = await AsyncStorage.getItem(CONTINUE_WATCHING_KEY);
    if (!data) return [];
    const items = JSON.parse(data);
    // Sort by last watched (newest first)
    return items.sort((a: ContinueWatchingItem, b: ContinueWatchingItem) => 
      b.lastWatchedAt - a.lastWatchedAt
    );
  } catch (error) {
    console.error('[ContinueWatching] Failed to load:', error);
    return [];
  }
}

/**
 * Save an item to continue watching (updates if exists)
 */
export async function saveContinueWatching(
  item: Omit<ContinueWatchingItem, 'lastWatchedAt'>
): Promise<void> {
  try {
    const items = await getContinueWatching();
    const existingIndex = items.findIndex(i => i.id === item.id && i.type === item.type);
    
    const newItem: ContinueWatchingItem = {
      ...item,
      lastWatchedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      // Update existing item
      items[existingIndex] = {
        ...items[existingIndex],
        ...newItem,
        lastWatchedAt: Date.now(),
      };
    } else {
      // Add new item
      items.unshift(newItem);
    }

    // Limit to MAX_ITEMS
    const trimmed = items.slice(0, MAX_ITEMS);
    
    await AsyncStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('[ContinueWatching] Failed to save:', error);
  }
}

/**
 * Update progress for an existing item
 */
export async function updateContinueWatchingProgress(
  id: string,
  type: 'movie' | 'tv',
  progress: number,
  duration?: number
): Promise<void> {
  try {
    const items = await getContinueWatching();
    const existingIndex = items.findIndex(i => i.id === id && i.type === type);
    
    if (existingIndex >= 0) {
      const item = items[existingIndex];
      // If progress is >= 0.95, remove the item (considered completed)
      if (progress >= 0.95) {
        await removeFromContinueWatching(id, type);
        return;
      }
      
      items[existingIndex] = {
        ...item,
        progress: Math.min(progress, 0.99), // Cap at 99% to keep it visible
        duration: duration || item.duration,
        lastWatchedAt: Date.now(),
      };
      
      // Move to top
      const [updated] = items.splice(existingIndex, 1);
      items.unshift(updated);
      
      await AsyncStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(items));
    }
  } catch (error) {
    console.error('[ContinueWatching] Failed to update progress:', error);
  }
}

/**
 * Remove an item from continue watching
 */
export async function removeFromContinueWatching(
  id: string,
  type?: 'movie' | 'tv'
): Promise<void> {
  try {
    const items = await getContinueWatching();
    const filtered = type 
      ? items.filter(i => !(i.id === id && i.type === type))
      : items.filter(i => i.id !== id);
    
    await AsyncStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[ContinueWatching] Failed to remove:', error);
  }
}

/**
 * Clear all continue watching items
 */
export async function clearContinueWatching(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CONTINUE_WATCHING_KEY);
  } catch (error) {
    console.error('[ContinueWatching] Failed to clear:', error);
  }
}

/**
 * Check if an item is in continue watching
 */
export async function isInContinueWatching(
  id: string,
  type: 'movie' | 'tv'
): Promise<boolean> {
  try {
    const items = await getContinueWatching();
    return items.some(i => i.id === id && i.type === type);
  } catch (error) {
    console.error('[ContinueWatching] Failed to check:', error);
    return false;
  }
}

/**
 * Get the progress of a specific item
 */
export async function getContinueWatchingProgress(
  id: string,
  type: 'movie' | 'tv'
): Promise<number | null> {
  try {
    const items = await getContinueWatching();
    const item = items.find(i => i.id === id && i.type === type);
    return item ? item.progress : null;
  } catch (error) {
    console.error('[ContinueWatching] Failed to get progress:', error);
    return null;
  }
}

/**
 * Auto-cleanup: Remove items older than X days
 */
export async function cleanupContinueWatching(days: number = 30): Promise<void> {
  try {
    const items = await getContinueWatching();
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const filtered = items.filter(i => i.lastWatchedAt > cutoff);
    
    if (filtered.length !== items.length) {
      await AsyncStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error('[ContinueWatching] Failed to cleanup:', error);
  }
}

export default {
  getContinueWatching,
  saveContinueWatching,
  updateContinueWatchingProgress,
  removeFromContinueWatching,
  clearContinueWatching,
  isInContinueWatching,
  getContinueWatchingProgress,
  cleanupContinueWatching,
};