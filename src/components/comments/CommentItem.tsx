// src/components/comments/CommentItem.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { Comment } from '../../services/comments/commentService';
import { useComments } from '../../hooks/comments/useComments';

interface CommentItemProps {
  comment: Comment;
  contentId: string;
  onReply?: (text: string) => void;
  onLike?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  contentId,
  onReply,
  onLike,
  onDelete,
}) => {
  const { colors } = useTheme();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const { postComment } = useComments({ contentId });

  const handleReply = async () => {
    if (replyText.trim()) {
      const result = await postComment(replyText.trim(), comment.id);
      if (result) {
        setReplyText('');
        setShowReply(false);
        if (onReply) onReply(replyText.trim());
      }
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return ${minutes}m;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return ${hours}h;
    const days = Math.floor(hours / 24);
    return ${days}d;
  };

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.avatarContainer, { backgroundColor: colors.surfaceRaised }]}>
          <Text style={styles.emoji}>{comment.user_emoji || '👤'}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.text }]}>
            {comment.user_name || 'Anonymous'}
          </Text>
          <Text style={[styles.timestamp, { color: colors.textMuted }]}>
            {timeAgo(comment.created_at)}
          </Text>
        </View>
      </View>

      <Text style={[styles.commentText, { color: colors.text }]}>
        {comment.text}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (onLike) onLike(comment.id);
          }}
        >
          <Ionicons
            name={comment.is_liked ? 'heart' : 'heart-outline'}
            size={18}
            color={comment.is_liked ? colors.error : colors.textMuted}
          />
          <Text style={[styles.actionText, { color: colors.textMuted }]}>
            {comment.likes || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowReply(!showReply)}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.actionText, { color: colors.textMuted }]}>Reply</Text>
        </TouchableOpacity>
      </View>

      {showReply && (
        <View style={styles.replyContainer}>
          <TextInput
            style={[styles.replyInput, {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            }]}
            placeholder="Write a reply..."
            placeholderTextColor={colors.textMuted}
            value={replyText}
            onChangeText={setReplyText}
            multiline
          />
          <View style={styles.replyActions}>
            <TouchableOpacity
              style={[styles.replyCancel, { borderColor: colors.border }]}
              onPress={() => setShowReply(false)}
            >
              <Text style={[styles.replyCancelText, { color: colors.textMuted }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.replySubmit, { backgroundColor: colors.gold }]}
              onPress={handleReply}
            >
              <Text style={[styles.replySubmitText, { color: '#000' }]}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <View style={styles.repliesContainer}>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              contentId={contentId}
              onReply={onReply}
              onLike={onLike}
              onDelete={onDelete}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  emoji: {
    fontSize: 18,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 11,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    marginLeft: 46,
  },
  actions: {
    flexDirection: 'row',
    marginLeft: 46,
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 12,
  },
  replyContainer: {
    marginTop: 8,
    marginLeft: 46,
  },
  replyInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    minHeight: 50,
    fontSize: 14,
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 10,
  },
  replyCancel: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  replyCancelText: {
    fontSize: 13,
  },
  replySubmit: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  replySubmitText: {
    fontSize: 13,
    fontWeight: '600',
  },
  repliesContainer: {
    marginLeft: 20,
    marginTop: 8,
  },
});

export default CommentItem;
