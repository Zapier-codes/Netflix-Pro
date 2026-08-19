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
