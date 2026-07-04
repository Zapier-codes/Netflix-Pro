/**
 * MovieboxProvider - Streaming provider using the moviebox-api Python SDK via the BoxOffice module.
 * Bridges to the native BoxOffice module for search, discovery, stream extraction, and social features.
 */

import { IStreamProvider, ProviderConfig, StreamSource, StreamRequest } from '../../types/ProviderTypes'
import { boxOffice, SubjectType, ApiVersion, SearchResultItem, DownloadableFiles } from '../../../../../modules/boxoffice'
import { supabase } from '../../../../lib/supabase'

export interface Review {
  id: string
  userId: string
  username: string
  avatar?: string
  rating: number
  content: string
  createdAt: string
  updatedAt?: string
  likes: number
  userLiked?: boolean
}

export interface Comment {
  id: string
  userId: string
  username: string
  avatar?: string
  content: string
  createdAt: string
  parentId?: string | null
  replies: Comment[]
  likes: number
  userLiked?: boolean
}

export interface Discussion {
  id: string
  title: string
  content: string
  userId: string
  username: string
  avatar?: string
  createdAt: string
  tags: string[]
  likes: number
  commentCount: number
  comments: Comment[]
  isPinned: boolean
}

export class MovieboxProvider implements IStreamProvider {
  readonly name = 'moviebox'
  readonly supportsMovies = true
  readonly supportsTV = true
  readonly supportsAnime = false

  private config: ProviderConfig
  private baseHeaders: Record<string, string>

  constructor(config: ProviderConfig = {}) {
    this.config = {
      timeout: 30000,
      retryCount: 2,
      ...config,
    }
    this.baseHeaders = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.0',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      ...config.headers,
    }
  }

  // ==================== HEALTH & SEARCH ====================

  async healthCheck(): Promise<boolean> {
    try {
      const status = await boxOffice.getStatus()
      return status.running
    } catch {
      return false
    }
  }

  async search(query: string, type?: 'movie' | 'tv' | 'anime'): Promise<SearchResultItem[]> {
    const subjectType = type === 'tv' ? SubjectType.TV_SERIES : SubjectType.MOVIES
    const results = await boxOffice.search(query, 1, 24, subjectType, ApiVersion.V2)
    return results.items
  }

  // ==================== STREAMS ====================

  async getStreams(request: StreamRequest): Promise<StreamSource[]> {
    const { id, type, season, episode } = request
    const detailPath = id

    let itemDetails: any
    if (type === 'tv') {
      itemDetails = await boxOffice.getTVSeriesDetails(detailPath, ApiVersion.V1)
    } else {
      itemDetails = await boxOffice.getMovieDetails(detailPath, ApiVersion.V1)
    }

    const subject = itemDetails.data?.subject ?? itemDetails.subject
    if (!subject) {
      throw new Error('Failed to get item details from moviebox')
    }

    const files: DownloadableFiles = await boxOffice.getDownloadableFiles(
      subject,
      type === 'tv' ? SubjectType.TV_SERIES : SubjectType.MOVIES,
      ApiVersion.V1
    )

    if (!files.hasResource || files.downloads.length === 0) {
      throw new Error('No streamable resources available for this item')
    }

    return files.downloads.map((file, index) => ({
      url: file.url,
      quality: this.resolutionToQuality(file.resolution),
      type: this.guessStreamType(file.url),
      headers: this.baseHeaders,
      subtitles: files.captions.map(cap => ({
        url: cap.url,
        language: cap.lan,
        label: cap.lanName,
      })),
      provider: this.name,
      index,
    }))
  }

  // ==================== DISCOVERY ====================

  async getTrending(type?: 'movie' | 'tv', page: number = 1): Promise<SearchResultItem[]> {
    const results = await boxOffice.getTrending(page, 24, ApiVersion.V2)
    return results.data
  }

  async getHomepage(): Promise<any[]> {
    const homepage = await boxOffice.getHomepage(ApiVersion.V2)
    return homepage.categories
  }

  async getHotContent(): Promise<{ movies: SearchResultItem[]; tvSeries: SearchResultItem[] }> {
    const hot = await boxOffice.getHotContent(ApiVersion.V2)
    return { movies: hot.movies, tvSeries: hot.tvSeries }
  }

  // ==================== REVIEWS (Supabase) ====================

  async getReviews(mediaId: string, mediaType: 'movie' | 'tv'): Promise<Review[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('media_id', mediaId)
      .eq('media_type', mediaType)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(this.mapReview)
  }

  async addReview(mediaId: string, mediaType: 'movie' | 'tv', rating: number, content: string): Promise<Review> {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id ?? 'anonymous'

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        media_id: mediaId,
        media_type: mediaType,
        user_id: userId,
        rating,
        content,
        likes: 0,
      })
      .select()
      .single()

    if (error) throw error
    return this.mapReview(data)
  }

  async likeReview(reviewId: string): Promise<void> {
    const { error } = await supabase.rpc('increment_review_likes', { review_id: reviewId })
    if (error) throw error
  }

  // ==================== DISCUSSIONS (Supabase) ====================

  async getDiscussions(tag?: string, limit: number = 20): Promise<Discussion[]> {
    let query = supabase
      .from('discussions')
      .select('*, comments:discussion_comments(*)')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (tag) {
      query = query.contains('tags', [tag])
    }

    const { data, error } = await query
    if (error) throw error

    return (data ?? []).map((d: any) => this.mapDiscussion(d))
  }

  async getDiscussion(discussionId: string): Promise<Discussion> {
    const { data, error } = await supabase
      .from('discussions')
      .select('*, comments:discussion_comments(*)')
      .eq('id', discussionId)
      .single()

    if (error) throw error
    return this.mapDiscussion(data)
  }

  async createDiscussion(title: string, content: string, tags: string[] = []): Promise<Discussion> {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id ?? 'anonymous'
    const username = userData.user?.email?.split('@')[0] ?? 'Anonymous'

    const { data, error } = await supabase
      .from('discussions')
      .insert({
        title,
        content,
        user_id: userId,
        username,
        tags,
        likes: 0,
        comment_count: 0,
        is_pinned: false,
      })
      .select()
      .single()

    if (error) throw error
    return this.mapDiscussion({ ...data, comments: [] })
  }

  // ==================== COMMENTS & REPLIES (Supabase) ====================

  async getComments(discussionId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('discussion_comments')
      .select('*')
      .eq('discussion_id', discussionId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return this.buildCommentTree(data ?? [])
  }

  async addComment(discussionId: string, content: string, parentId?: string | null): Promise<Comment> {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id ?? 'anonymous'
    const username = userData.user?.email?.split('@')[0] ?? 'Anonymous'

    const { data, error } = await supabase
      .from('discussion_comments')
      .insert({
        discussion_id: discussionId,
        user_id: userId,
        username,
        content,
        parent_id: parentId ?? null,
        likes: 0,
      })
      .select()
      .single()

    if (error) throw error

    // Increment comment count on discussion
    await supabase.rpc('increment_comment_count', { discussion_id: discussionId })

    return this.mapComment({ ...data, replies: [] })
  }

  async likeComment(commentId: string): Promise<void> {
    const { error } = await supabase.rpc('increment_comment_likes', { comment_id: commentId })
    if (error) throw error
  }

  // ==================== HELPERS ====================

  private resolutionToQuality(resolution: number): string {
    if (resolution >= 2160) return '4k'
    if (resolution >= 1440) return '1440p'
    if (resolution >= 1080) return '1080p'
    if (resolution >= 720) return '720p'
    if (resolution >= 480) return '480p'
    if (resolution >= 360) return '360p'
    return 'auto'
  }

  private guessStreamType(url: string): 'hls' | 'dash' | 'mp4' | 'unknown' {
    if (url.includes('.m3u8')) return 'hls'
    if (url.includes('.mpd')) return 'dash'
    if (url.includes('.mp4')) return 'mp4'
    return 'unknown'
  }

  private mapReview(data: any): Review {
    return {
      id: data.id,
      userId: data.user_id,
      username: data.username ?? 'Anonymous',
      avatar: data.avatar,
      rating: data.rating,
      content: data.content,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      likes: data.likes ?? 0,
      userLiked: data.user_liked ?? false,
    }
  }

  private mapComment(data: any): Comment {
    return {
      id: data.id,
      userId: data.user_id,
      username: data.username ?? 'Anonymous',
      avatar: data.avatar,
      content: data.content,
      createdAt: data.created_at,
      parentId: data.parent_id,
      replies: data.replies ?? [],
      likes: data.likes ?? 0,
      userLiked: data.user_liked ?? false,
    }
  }

  private buildCommentTree(flatComments: any[]): Comment[] {
    const commentMap = new Map<string, Comment>()
    const roots: Comment[] = []

    // First pass: create all comment objects
    flatComments.forEach(c => {
      commentMap.set(c.id, this.mapComment(c))
    })

    // Second pass: build tree
    flatComments.forEach(c => {
      const comment = commentMap.get(c.id)!
      if (c.parent_id && commentMap.has(c.parent_id)) {
        const parent = commentMap.get(c.parent_id)!
        parent.replies.push(comment)
      } else {
        roots.push(comment)
      }
    })

    return roots
  }

  private mapDiscussion(data: any): Discussion {
    const comments = data.comments ? this.buildCommentTree(data.comments) : []
    return {
      id: data.id,
      title: data.title,
      content: data.content,
      userId: data.user_id,
      username: data.username ?? 'Anonymous',
      avatar: data.avatar,
      createdAt: data.created_at,
      tags: data.tags ?? [],
      likes: data.likes ?? 0,
      commentCount: data.comment_count ?? comments.length,
      comments,
      isPinned: data.is_pinned ?? false,
    }
  }
}

export default MovieboxProvider