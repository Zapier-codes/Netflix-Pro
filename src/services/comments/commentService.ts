// src/services/comments/commentService.ts
//
// Comments are stored entirely on-device (AsyncStorage) — no backend, no
// cross-device sync. This replaces the previous Supabase-backed
// implementation. Public method signatures are unchanged so
// useComments.ts / useCommentRealtime.ts don't need to change.
//
// "Realtime" here means same-device, same-session only: an in-memory
// event emitter notifies other mounted components when a comment is
// posted locally. There is no cross-device realtime without a backend.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { deviceManager } from '../device/DeviceManager';

export interface Comment {
  id: string;
  content_id: string;
  user_id: string;
  user_name: string;
  user_emoji: string;
  text: string;
  created_at: string;
  updated_at: string;
  likes: number;
  is_liked?: boolean;
  replies?: Comment[];
  parent_id?: string;
}

export interface CommentInput {
  contentId: string;
  text: string;
  parentId?: string;
}

const STORAGE_PREFIX = '@comments:';

function storageKeyForContent(contentId: string): string {
  return `${STORAGE_PREFIX}${contentId}`;
}

function generateCommentId(): string {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

type CommentListener = (comment: Comment) => void;

export class CommentService {
  private static instance: CommentService;
  private listeners: Map<string, Set<CommentListener>> = new Map();

  static getInstance(): CommentService {
    if (!CommentService.instance) {
      CommentService.instance = new CommentService();
    }
    return CommentService.instance;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNAL STORAGE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private async readAll(contentId: string): Promise<Comment[]> {
    try {
      const raw = await AsyncStorage.getItem(storageKeyForContent(contentId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('[CommentService] Failed to read comments:', error);
      return [];
    }
  }

  private async writeAll(contentId: string, comments: Comment[]): Promise<void> {
    try {
      await AsyncStorage.setItem(storageKeyForContent(contentId), JSON.stringify(comments));
    } catch (error) {
      console.error('[CommentService] Failed to write comments:', error);
    }
  }

  private emit(contentId: string, comment: Comment): void {
    const set = this.listeners.get(contentId);
    if (!set) return;
    set.forEach((listener) => {
      try {
        listener(comment);
      } catch (error) {
        console.error('[CommentService] Listener error:', error);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST COMMENT
  // ─────────────────────────────────────────────────────────────────────────

  async postComment(input: CommentInput): Promise<Comment | null> {
    try {
      const device = await deviceManager.initialize();
      const now = new Date().toISOString();

      const comment: Comment = {
        id: generateCommentId(),
        content_id: input.contentId,
        user_id: device.id,
        user_name: device.name,
        user_emoji: device.emoji,
        text: input.text.trim(),
        created_at: now,
        updated_at: now,
        likes: 0,
        parent_id: input.parentId,
      };

      if (input.parentId) {
        // Reply: attach to the parent comment's `replies` array.
        const all = await this.readAll(input.contentId);
        const updated = all.map((c) =>
          c.id === input.parentId
            ? { ...c, replies: [...(c.replies || []), comment] }
            : c
        );
        await this.writeAll(input.contentId, updated);
      } else {
        const all = await this.readAll(input.contentId);
        await this.writeAll(input.contentId, [comment, ...all]);
      }

      this.emit(input.contentId, comment);
      return comment;
    } catch (error) {
      console.error('[CommentService] Error:', error);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET COMMENTS FOR CONTENT
  // ─────────────────────────────────────────────────────────────────────────

  async getComments(
    contentId: string,
    limit: number = 50,
    order: 'newest' | 'oldest' | 'popular' = 'newest'
  ): Promise<Comment[]> {
    try {
      const all = await this.readAll(contentId);
      const topLevel = all.filter((c) => !c.parent_id);

      const sorted = [...topLevel].sort((a, b) => {
        if (order === 'oldest') return a.created_at.localeCompare(b.created_at);
        if (order === 'popular') return b.likes - a.likes;
        return b.created_at.localeCompare(a.created_at); // newest
      });

      return sorted.slice(0, limit);
    } catch (error) {
      console.error('[CommentService] Error:', error);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET COMMENT REPLIES
  // ─────────────────────────────────────────────────────────────────────────

  async getReplies(commentId: string): Promise<Comment[]> {
    // Replies are stored inline on the parent comment; find it by scanning
    // every content bucket is impractical without the contentId, so callers
    // that need this should read `comment.replies` directly from
    // getComments() results instead. Kept for interface compatibility.
    try {
      const keys = await AsyncStorage.getAllKeys();
      const commentKeys = keys.filter((k) => k.startsWith(STORAGE_PREFIX));
      for (const key of commentKeys) {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const all: Comment[] = JSON.parse(raw);
        const parent = all.find((c) => c.id === commentId);
        if (parent) {
          return (parent.replies || []).sort((a, b) => a.created_at.localeCompare(b.created_at));
        }
      }
      return [];
    } catch (error) {
      console.error('[CommentService] Replies error:', error);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIKE / UNLIKE COMMENT
  // ─────────────────────────────────────────────────────────────────────────

  async toggleLike(commentId: string, _userId: string): Promise<number | null> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const commentKeys = keys.filter((k) => k.startsWith(STORAGE_PREFIX));

      for (const key of commentKeys) {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const all: Comment[] = JSON.parse(raw);

        let newLikes: number | null = null;
        const updated = all.map((c) => {
          if (c.id === commentId) {
            newLikes = c.likes + 1;
            return { ...c, likes: newLikes, is_liked: true };
          }
          if (c.replies?.some((r) => r.id === commentId)) {
            return {
              ...c,
              replies: c.replies.map((r) => {
                if (r.id === commentId) {
                  newLikes = r.likes + 1;
                  return { ...r, likes: newLikes, is_liked: true };
                }
                return r;
              }),
            };
          }
          return c;
        });

        if (newLikes !== null) {
          await AsyncStorage.setItem(key, JSON.stringify(updated));
          return newLikes;
        }
      }
      return null;
    } catch (error) {
      console.error('[CommentService] Error:', error);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE COMMENT
  // ─────────────────────────────────────────────────────────────────────────

  async deleteComment(commentId: string, userId: string): Promise<boolean> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const commentKeys = keys.filter((k) => k.startsWith(STORAGE_PREFIX));

      for (const key of commentKeys) {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const all: Comment[] = JSON.parse(raw);

        const hasTarget = all.some(
          (c) => (c.id === commentId && c.user_id === userId) ||
                 c.replies?.some((r) => r.id === commentId && r.user_id === userId)
        );
        if (!hasTarget) continue;

        const updated = all
          .filter((c) => !(c.id === commentId && c.user_id === userId))
          .map((c) => ({
            ...c,
            replies: c.replies?.filter((r) => !(r.id === commentId && r.user_id === userId)),
          }));

        await AsyncStorage.setItem(key, JSON.stringify(updated));
        return true;
      }
      return false;
    } catch (error) {
      console.error('[CommentService] Error:', error);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // "REAL-TIME" SUBSCRIPTION — same-device, same-session only
  // ─────────────────────────────────────────────────────────────────────────

  subscribeToComments(
    contentId: string,
    callback: (comment: Comment) => void
  ): (() => void) {
    if (!this.listeners.has(contentId)) {
      this.listeners.set(contentId, new Set());
    }
    this.listeners.get(contentId)!.add(callback);

    return () => {
      this.listeners.get(contentId)?.delete(callback);
    };
  }
}

export const commentService = CommentService.getInstance();
