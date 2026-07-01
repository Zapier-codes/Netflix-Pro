// src/hooks/comments/useComments.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { commentService, Comment } from '../../services/comments/commentService';
import { deviceManager } from '../../services/device/DeviceManager';

interface UseCommentsOptions {
  contentId: string;
  limit?: number;
  order?: 'newest' | 'oldest' | 'popular';
  enableRealtime?: boolean;
}

export const useComments = ({
  contentId,
  limit = 50,
  order = 'newest',
  enableRealtime = true,
}: UseCommentsOptions) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD COMMENTS
  // ─────────────────────────────────────────────────────────────────────────

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await commentService.getComments(contentId, limit, order);
      setComments(data);
      setHasMore(data.length === limit);
    } catch (err) {
      setError('Failed to load comments');
      console.error('[useComments] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [contentId, limit, order]);

  // ─────────────────────────────────────────────────────────────────────────
  // POST COMMENT
  // ─────────────────────────────────────────────────────────────────────────

  const postComment = useCallback(async (text: string, parentId?: string) => {
    try {
      const newComment = await commentService.postComment({
        contentId,
        text,
        parentId,
      });

      if (newComment) {
        // Add to local state
        if (parentId) {
          // Add as reply
          setComments(prev => prev.map(c => 
            c.id === parentId 
              ? { ...c, replies: [...(c.replies || []), newComment] }
              : c
          ));
        } else {
          // Add as top-level comment
          setComments(prev => [newComment, ...prev]);
        }
        return newComment;
      }
      return null;
    } catch (error) {
      console.error('[useComments] Post error:', error);
      return null;
    }
  }, [contentId]);

  // ─────────────────────────────────────────────────────────────────────────
  // LIKE COMMENT
  // ─────────────────────────────────────────────────────────────────────────

  const likeComment = useCallback(async (commentId: string) => {
    try {
      const device = await deviceManager.initialize();
      const newLikes = await commentService.toggleLike(commentId, device.id);
      
      if (newLikes !== null) {
        setComments(prev => prev.map(c => 
          c.id === commentId 
            ? { ...c, likes: newLikes, is_liked: true }
            : c
        ));
      }
    } catch (error) {
      console.error('[useComments] Like error:', error);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE COMMENT
  // ─────────────────────────────────────────────────────────────────────────

  const deleteComment = useCallback(async (commentId: string) => {
    try {
      const device = await deviceManager.initialize();
      const success = await commentService.deleteComment(commentId, device.id);
      
      if (success) {
        setComments(prev => prev.filter(c => c.id !== commentId));
      }
    } catch (error) {
      console.error('[useComments] Delete error:', error);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // REAL-TIME SUBSCRIPTION
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (enableRealtime) {
      const unsubscribe = commentService.subscribeToComments(
        contentId,
        (newComment) => {
          setComments(prev => [newComment, ...prev]);
        }
      );
      unsubscribeRef.current = unsubscribe;

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
      };
    }
  }, [contentId, enableRealtime]);

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD ON MOUNT
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  return {
    comments,
    loading,
    error,
    hasMore,
    loadComments,
    postComment,
    likeComment,
    deleteComment,
  };
};

// src/hooks/comments/useCommentRealtime.ts
import { useState, useEffect, useRef } from 'react';
import { commentService, Comment } from '../../services/comments/commentService';

export const useCommentRealtime = (contentId: string) => {
  const [latestComment, setLatestComment] = useState<Comment | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubscribeRef.current = commentService.subscribeToComments(
      contentId,
      (comment) => {
        setLatestComment(comment);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [contentId]);

  return { latestComment };
};
