// src/services/comments/commentService.ts
import { supabase } from '../supabase/supabaseClient';
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

export class CommentService {
  private static instance: CommentService;

  static getInstance(): CommentService {
    if (!CommentService.instance) {
      CommentService.instance = new CommentService();
    }
    return CommentService.instance;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST COMMENT
  // ─────────────────────────────────────────────────────────────────────────

  async postComment(input: CommentInput): Promise<Comment | null> {
    try {
      const device = await deviceManager.initialize();
      
      const commentData = {
        content_id: input.contentId,
        user_id: device.id,
        user_name: device.name,
        user_emoji: device.emoji,
        text: input.text.trim(),
        parent_id: input.parentId || null,
        likes: 0,
      };

      const { data, error } = await supabase
        .from('comments')
        .insert(commentData)
        .select()
        .single();

      if (error) {
        console.error('[CommentService] Post error:', error);
        return null;
      }

      return data;
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
      let query = supabase
        .from('comments')
        .select('*')
        .eq('content_id', contentId)
        .is('parent_id', null)
        .limit(limit);

      if (order === 'newest') {
        query = query.order('created_at', { ascending: false });
      } else if (order === 'oldest') {
        query = query.order('created_at', { ascending: true });
      } else if (order === 'popular') {
        query = query.order('likes', { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        console.error('[CommentService] Get error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[CommentService] Error:', error);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET COMMENT REPLIES
  // ─────────────────────────────────────────────────────────────────────────

  async getReplies(commentId: string): Promise<Comment[]> {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('parent_id', commentId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[CommentService] Replies error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[CommentService] Error:', error);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIKE / UNLIKE COMMENT
  // ─────────────────────────────────────────────────────────────────────────

  async toggleLike(commentId: string, userId: string): Promise<number | null> {
    try {
      // Get current likes
      const { data: comment, error: fetchError } = await supabase
        .from('comments')
        .select('likes')
        .eq('id', commentId)
        .single();

      if (fetchError) {
        console.error('[CommentService] Fetch likes error:', fetchError);
        return null;
      }

      const currentLikes = comment?.likes || 0;
      const newLikes = currentLikes + 1;

      const { data, error } = await supabase
        .from('comments')
        .update({ likes: newLikes })
        .eq('id', commentId)
        .select()
        .single();

      if (error) {
        console.error('[CommentService] Like error:', error);
        return null;
      }

      return data?.likes || null;
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
      // Only allow deletion if user is the author
      const { data, error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('[CommentService] Delete error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[CommentService] Error:', error);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REAL-TIME SUBSCRIPTION
  // ─────────────────────────────────────────────────────────────────────────

  subscribeToComments(
    contentId: string,
    callback: (comment: Comment) => void
  ): (() => void) {
    const subscription = supabase
      .channel(comments:)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: content_id=eq.,
        },
        (payload) => {
          callback(payload.new as Comment);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }
}

export const commentService = CommentService.getInstance();
