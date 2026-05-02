import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Heart,
  MessageSquare,
  Send,
  ThumbsUp,
  HandHeart,
  ChevronDown,
  Loader2,
  Trash2,
  ImagePlus,
  X,
  EyeOff,
  Flag,
  CornerDownRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { useMapStore } from '../../stores/mapStore';
import { useLanguage } from '../../contexts/LanguageContext';
import HideCommentModal from '../ui/HideCommentModal';
import ReportPostModal from '../ui/ReportPostModal';
import UserPreviewModal from '../ui/UserPreviewModal';
import Modal from '../ui/Modal';
import { socialApi, getImageUrl, type HideCommentRequest } from '../../services/api';

interface PostDto {
  id: number;
  content: string;
  imageUrl?: string;
  category: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  likeCount: number;
  loveCount: number;
  prayCount: number;
  commentCount: number;
  userReaction?: string;
  isApproved?: boolean;
  approvalStatus?: string;
}

interface CommentDto {
  id: number;
  content: string;
  createdAt: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  parentCommentId?: number;
  parentUserId?: string;
  parentUserName?: string;
}

interface HideCommentTarget {
  postId: number;
  commentId: number;
  content: string;
  userName: string;
}

interface ReportPostTarget {
  postId: number;
  content: string;
  authorName: string;
}

interface DeletePostTarget {
  postId: number;
  content: string;
  authorName: string;
}

interface ReplyTarget {
  commentId: number;
  userName: string;
}

interface PreviewUserTarget {
  userId: string;
  fallbackName: string;
  fallbackAvatar?: string;
}

const CATEGORIES = ['Livelihood', 'Medical', 'Education', 'Volunteer', 'Appeal'] as const;

function orderCommentsForDisplay(comments: CommentDto[]): CommentDto[] {
  const byParent = new Map<number, CommentDto[]>();
  const commentIds = new Set(comments.map((comment) => comment.id));
  const roots: CommentDto[] = [];

  comments.forEach((comment) => {
    if (comment.parentCommentId && commentIds.has(comment.parentCommentId)) {
      byParent.set(comment.parentCommentId, [...(byParent.get(comment.parentCommentId) || []), comment]);
    } else {
      roots.push(comment);
    }
  });

  const ordered: CommentDto[] = [];
  const append = (comment: CommentDto) => {
    ordered.push(comment);
    [...(byParent.get(comment.id) || [])].reverse().forEach(append);
  };

  roots.forEach(append);
  return ordered;
}

function timeAgo(dateStr: string, t: (key: string) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('social.justNow');
  if (mins < 60) return `${mins} ${t('social.minutesAgo')}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${t('social.hoursAgo')}`;
  const days = Math.floor(hours / 24);
  return `${days} ${t('social.daysAgo')}`;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

/** Handle avatar load error — hide img and show initials fallback sibling */
function handleAvatarError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  img.style.display = 'none';
  // Show the next sibling which is the initials fallback
  const fallback = img.nextElementSibling as HTMLElement | null;
  if (fallback) fallback.style.display = '';
}

function DeletePostModal({
  isOpen,
  postPreview,
  submitting = false,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  postPreview?: string;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed || submitting) return;
    await onConfirm(trimmed);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
            <div className="auth-logo" style={{ width: 42, height: 42, margin: 0 }}>
              <Trash2 size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>{t('social.deletePostTitle')}</h2>
              <p className="auth-subtitle" style={{ margin: '4px 0 0' }}>{t('social.deletePostSubtitle')}</p>
            </div>
          </div>

          {postPreview && (
            <div style={{
              marginTop: 'var(--sp-3)',
              padding: 'var(--sp-3)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--glass-border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              lineHeight: 1.6,
            }}>
              “{postPreview.length > 180 ? `${postPreview.slice(0, 180)}...` : postPreview}”
            </div>
          )}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <span style={{ fontWeight: 600 }}>{t('social.deleteReasonLabel')}</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('social.deleteReasonPlaceholder')}
            disabled={submitting}
            rows={4}
            style={{
              width: '100%',
              resize: 'vertical',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              color: 'inherit',
              padding: '12px',
              font: 'inherit',
              lineHeight: 1.6,
            }}
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-danger" disabled={submitting || !reason.trim()}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {t('social.deletePostSubmit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function SocialPanel() {
  const { isAuthenticated, user } = useAuthStore();
  const { setAuthModal } = useMapStore();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'Admin';

  const [posts, setPosts] = useState<PostDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [newPost, setNewPost] = useState('');
  const [category, setCategory] = useState<string>('Livelihood');
  const [posting, setPosting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedComments, setExpandedComments] = useState<Record<number, CommentDto[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<number, boolean>>({});
  const [hideCommentTarget, setHideCommentTarget] = useState<HideCommentTarget | null>(null);
  const [hidingComment, setHidingComment] = useState(false);
  const [reportPostTarget, setReportPostTarget] = useState<ReportPostTarget | null>(null);
  const [reportingPost, setReportingPost] = useState(false);
  const [deletePostTarget, setDeletePostTarget] = useState<DeletePostTarget | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);
  const [replyTargets, setReplyTargets] = useState<Record<number, ReplyTarget | undefined>>({});
  const [previewUserTarget, setPreviewUserTarget] = useState<PreviewUserTarget | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const observerRef = useRef<HTMLDivElement>(null);
  const inflightRef = useRef(false); // Track inflight requests to prevent race conditions

  const fetchPosts = useCallback(async (cursor?: string) => {
    // Prevent concurrent requests - critical for preventing race conditions
    if (inflightRef.current && cursor) return;
    inflightRef.current = true;
    setLoading(true);
    try {
      const res = await socialApi.getPosts({ cursor: cursor, limit: 10 });
      const data = res.data;
      if (cursor) {
        setPosts(prev => [...prev, ...data.items]);
      } else {
        setPosts(data.items);
      }
      setNextCursor(data.nextCursor ?? null);
    } catch {
      // Silently fail — show empty feed
    } finally {
      setLoading(false);
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Infinite scroll with proper concurrency control
  useEffect(() => {
    if (!observerRef.current || !nextCursor) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && nextCursor && !loading && !inflightRef.current) {
        fetchPosts(nextCursor);
      }
    }, { threshold: 0.5 });
    obs.observe(observerRef.current);
    return () => obs.disconnect();
  }, [nextCursor, loading, fetchPosts]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate file type and size (5MB max)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePost = async () => {
    if (!isAuthenticated) { setAuthModal('login'); return; }
    if (!newPost.trim()) return;
    setPosting(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const uploadRes = await socialApi.uploadImage(imageFile);
        imageUrl = uploadRes.data.imageUrl;
      }
      const res = await socialApi.createPost({ content: newPost.trim(), category, imageUrl });
      const data = res.data as PostDto | { post: PostDto; spamWarning?: string; message?: string; pendingApproval?: boolean };
      setNewPost('');
      removeImage();
      if ('pendingApproval' in data && data.pendingApproval) {
        toast.success(data.message || t('social.postPendingApproval'), { duration: 5000 });
      } else {
        const post = 'post' in data ? data.post : data;
        setPosts(prev => [post, ...prev]);
      }
      if ('spamWarning' in data && data.spamWarning) {
        toast(data.spamWarning, { icon: '⚠️', duration: 6000 });
      }
    } catch { /* show nothing — api interceptor handles 401 */ }
    finally { setPosting(false); }
  };

  const handleReaction = async (postId: number, type: string) => {
    if (!isAuthenticated) { setAuthModal('login'); return; }

    // Optimistic update — apply immediately for instant feedback
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const wasActive = p.userReaction === type;
      const prevType = p.userReaction;
      return {
        ...p,
        userReaction: wasActive ? undefined : type,
        likeCount:  p.likeCount  + (type === 'Like'  ? (wasActive ? -1 : 1) : (prevType === 'Like'  ? -1 : 0)),
        loveCount:  p.loveCount  + (type === 'Love'  ? (wasActive ? -1 : 1) : (prevType === 'Love'  ? -1 : 0)),
        prayCount:  p.prayCount  + (type === 'Pray'  ? (wasActive ? -1 : 1) : (prevType === 'Pray'  ? -1 : 0)),
      };
    }));

    try {
      const res = await socialApi.addReaction(postId, { type });
      // Sync with actual server counts
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        likeCount: res.data.likeCount,
        loveCount: res.data.loveCount,
        prayCount: res.data.prayCount,
        userReaction: res.data.userReaction ?? undefined,
      } : p));
    } catch {
      // Revert optimistic update on failure — refetch
      fetchPosts();
    }
  };

  const toggleComments = async (postId: number) => {
    if (expandedComments[postId]) {
      setExpandedComments(prev => { const n = { ...prev }; delete n[postId]; return n; });
      return;
    }
    setLoadingComments(prev => ({ ...prev, [postId]: true }));
    try {
      const res = await socialApi.getComments(postId, { limit: 20 });
      setExpandedComments(prev => ({ ...prev, [postId]: res.data.items }));
    } catch { /* ignore */ }
    finally { setLoadingComments(prev => ({ ...prev, [postId]: false })); }
  };

  const handleComment = async (postId: number) => {
    if (!isAuthenticated) { setAuthModal('login'); return; }
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    try {
      const replyTarget = replyTargets[postId];
      const res = await socialApi.addComment(postId, { content, parentCommentId: replyTarget?.commentId });
      const cData = res.data as CommentDto | { comment: CommentDto; spamWarning: string };
      const newComment = 'comment' in cData ? cData.comment : cData;
      setExpandedComments(prev => ({
        ...prev,
        [postId]: [newComment, ...(prev[postId] || [])],
      }));
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      setReplyTargets(prev => ({ ...prev, [postId]: undefined }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
      if ('spamWarning' in cData && cData.spamWarning) {
        toast(cData.spamWarning, { icon: '⚠️', duration: 6000 });
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string; isBanned?: boolean } } };
      if (axiosErr?.response?.status === 422) {
        const data = axiosErr.response.data;
        toast.error(data?.message || t('social.commentViolation'), { duration: 6000 });
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
        if (data?.isBanned) {
          setTimeout(() => window.location.reload(), 3000);
        }
        return;
      }

      if (axiosErr?.response?.status === 403) {
        toast.error(axiosErr.response.data?.message || t('common.forbidden'), { duration: 5000 });
        return;
      }

      toast.error(t('common.error'));
    }
  };

  const openDeletePost = (post: PostDto) => {
    setDeletePostTarget({ postId: post.id, content: post.content, authorName: post.authorName });
  };

  const handleDeletePost = async (reason: string) => {
    if (!deletePostTarget) return;

    setDeletingPost(true);
    try {
      await socialApi.deletePost(deletePostTarget.postId, { reason });
      setPosts(prev => prev.filter(p => p.id !== deletePostTarget.postId));
      toast.success(t('social.postDeleted'));
      setDeletePostTarget(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || t('common.error'));
    } finally {
      setDeletingPost(false);
    }
  };

  const openReportPost = (post: PostDto) => {
    if (!isAuthenticated) {
      setAuthModal('login');
      return;
    }

    setReportPostTarget({ postId: post.id, content: post.content, authorName: post.authorName });
  };

  const handleReportPost = async (reason: string) => {
    if (!reportPostTarget) return;

    setReportingPost(true);
    try {
      const res = await socialApi.reportPost(reportPostTarget.postId, { reason });
      toast.success(res.data?.message || t('social.reportSubmitted'));
      setReportPostTarget(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || t('common.error'));
    } finally {
      setReportingPost(false);
    }
  };

  const handleHideComment = async (payload: HideCommentRequest) => {
    if (!hideCommentTarget) return;

    setHidingComment(true);
    try {
      const res = await socialApi.hideComment(hideCommentTarget.postId, hideCommentTarget.commentId, payload);
      setExpandedComments(prev => ({
        ...prev,
        [hideCommentTarget.postId]: (prev[hideCommentTarget.postId] || []).filter(c => c.id !== hideCommentTarget.commentId),
      }));
      setPosts(prev => prev.map(p => p.id === hideCommentTarget.postId ? {
        ...p,
        commentCount: Math.max(0, p.commentCount - 1),
      } : p));
      toast.success(res.data?.message || t('social.commentHidden'));
      if (payload.notifyUser && res.data?.notificationRequested && !res.data?.notificationSent) {
        toast.error(t('social.commentHiddenWithoutNotification'), { duration: 5000 });
      }
      setHideCommentTarget(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || t('common.error'));
    } finally {
      setHidingComment(false);
    }
  };

  const openUserPreview = (userId: string, fallbackName: string, fallbackAvatar?: string) => {
    setPreviewUserTarget({ userId, fallbackName, fallbackAvatar });
  };

  return (
    <div className="panel-content">
      <div className="panel-header">
        <h2 className="panel-title">{t('panel.community')}</h2>
      </div>

      {/* Compose */}
      <div className="social-compose glass-card-sm">
        <div className="social-compose-input-wrap">
          <textarea
            className="social-compose-input"
            placeholder={t('social.composePlaceholder')}
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            rows={2}
          />
          {/* Image preview */}
          {imagePreview && (
            <div className="social-compose-preview">
              <img src={imagePreview} alt="Preview" />
              <button className="social-compose-preview-remove" onClick={removeImage}>
                <X size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="social-compose-actions">
          <div className="social-compose-tools">
            <select
              className="social-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{t(`social.category.${c}`)}</option>
              ))}
            </select>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageSelect}
              hidden
            />
            <button
              className="btn-ghost btn-sm"
              onClick={() => fileInputRef.current?.click()}
              title={t('social.addImage')}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            >
              <ImagePlus size={16} />
            </button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handlePost} disabled={posting || !newPost.trim()}>
            {posting ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
            {t('social.share')}
          </button>
        </div>
      </div>

      {/* Posts */}
      <div className="social-posts">
        {posts.map((post) => (
          <article key={post.id} className="social-post glass-card-sm">
            {/* Author */}
            <div className="social-post-header">
              <button
                type="button"
                className="social-user-trigger"
                onClick={() => openUserPreview(post.authorId, post.authorName, post.authorAvatar)}
              >
                {post.authorAvatar ? (
                  <>
                    <img src={getImageUrl(post.authorAvatar)} alt="" className="avatar avatar-sm" style={{ objectFit: 'cover' }} onError={handleAvatarError} />
                    <div className="avatar avatar-sm" style={{ display: 'none' }}>
                      <span>{getInitials(post.authorName)}</span>
                    </div>
                  </>
                ) : (
                  <div className="avatar avatar-sm">
                    <span>{getInitials(post.authorName)}</span>
                  </div>
                )}
                <div className="social-post-author">
                  <span className="social-post-name">{post.authorName}</span>
                  <span className="social-post-time">{timeAgo(post.createdAt, t)}</span>
                </div>
              </button>
              {(post.authorId === user?.id || user?.role === 'Admin') && (
                <button className="btn-ghost btn-sm social-post-more" onClick={() => openDeletePost(post)} title={t('social.delete')}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Category badge */}
            <span className={`badge badge-${post.category.toLowerCase()}`} style={{ fontSize: '0.65rem', marginBottom: '0.25rem' }}>
              {t(`social.category.${post.category}`)}
            </span>

            {/* Content */}
            <p className="social-post-content">{post.content}</p>
            {post.imageUrl && (
              <button
                type="button"
                className="social-post-image-button"
                onClick={() => setPreviewImageUrl(getImageUrl(post.imageUrl))}
                aria-label={t('admin.postImage')}
              >
                <img src={getImageUrl(post.imageUrl)} alt={t('admin.postImage')} className="social-post-image" />
              </button>
            )}

            {/* Reactions */}
            <div className="social-post-actions">
              <button
                className={`social-action-btn ${post.userReaction === 'Like' ? 'social-action-liked' : ''}`}
                onClick={() => handleReaction(post.id, 'Like')}
              >
                <ThumbsUp size={15} fill={post.userReaction === 'Like' ? 'currentColor' : 'none'} />
                <span>{post.likeCount || ''}</span>
              </button>
              <button
                className={`social-action-btn ${post.userReaction === 'Love' ? 'social-action-liked' : ''}`}
                onClick={() => handleReaction(post.id, 'Love')}
              >
                <Heart size={15} fill={post.userReaction === 'Love' ? 'currentColor' : 'none'} />
                <span>{post.loveCount || ''}</span>
              </button>
              <button
                className={`social-action-btn ${post.userReaction === 'Pray' ? 'social-action-liked' : ''}`}
                onClick={() => handleReaction(post.id, 'Pray')}
              >
                <HandHeart size={15} fill={post.userReaction === 'Pray' ? 'currentColor' : 'none'} />
                <span>{post.prayCount || ''}</span>
              </button>
              <button className="social-action-btn" onClick={() => toggleComments(post.id)}>
                <MessageSquare size={15} />
                <span>{post.commentCount || ''}</span>
                <ChevronDown size={12} style={{ transform: expandedComments[post.id] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {post.authorId !== user?.id && (
                <button className="social-action-btn" onClick={() => openReportPost(post)}>
                  <Flag size={15} />
                  <span>{t('social.reportPost')}</span>
                </button>
              )}
            </div>

            {/* Comments */}
            {loadingComments[post.id] && <div style={{ textAlign: 'center', padding: '0.5rem' }}><Loader2 size={16} className="spin" /></div>}
            {expandedComments[post.id] && (
              <div className="social-comments" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                {replyTargets[post.id] && (
                  <div className="social-replying-pill">
                    <CornerDownRight size={12} />
                    <span>{t('social.replyingTo')} @{replyTargets[post.id]?.userName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTargets(prev => ({ ...prev, [post.id]: undefined }));
                        setCommentInputs(prev => ({ ...prev, [post.id]: '' }));
                      }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}
                {/* Comment input */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder={t('social.commentPlaceholder')}
                    value={commentInputs[post.id] || ''}
                    onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleComment(post.id)}
                    style={{ flex: 1, fontSize: '0.8rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'inherit' }}
                  />
                  <button className="btn-ghost btn-sm" onClick={() => handleComment(post.id)}>
                    <Send size={12} />
                  </button>
                </div>
                {orderCommentsForDisplay(expandedComments[post.id]).map(c => (
                  <div key={c.id} className={`social-comment-row ${c.parentCommentId ? 'social-comment-row--reply' : ''}`}>
                    <button
                      type="button"
                      className="social-comment-user-trigger"
                      onClick={() => openUserPreview(c.userId, c.userName, c.userAvatar)}
                    >
                      {c.userAvatar ? (
                        <>
                          <img
                            src={getImageUrl(c.userAvatar)}
                            alt=""
                            className="avatar"
                            style={{ width: 24, height: 24, fontSize: '0.6rem', objectFit: 'cover' }}
                            onError={handleAvatarError}
                          />
                          <div className="avatar" style={{ width: 24, height: 24, fontSize: '0.6rem', display: 'none' }}>
                            <span>{getInitials(c.userName)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="avatar" style={{ width: 24, height: 24, fontSize: '0.6rem' }}>
                          <span>{getInitials(c.userName)}</span>
                        </div>
                      )}
                      <div className="social-comment-body">
                        <div className="social-comment-meta">
                          <strong>{c.userName}</strong>
                          <span>{timeAgo(c.createdAt, t)}</span>
                        </div>
                        <p className="social-comment-content">{c.content}</p>
                      </div>
                    </button>
                    {isAdmin && (
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => setHideCommentTarget({ postId: post.id, commentId: c.id, content: c.content, userName: c.userName })}
                        title={t('social.hideComment')}
                        style={{ alignSelf: 'flex-start', color: 'var(--danger-500)' }}
                      >
                        <EyeOff size={12} />
                      </button>
                    )}
                    {/* Reply & Report for comments */}
                    <div className="social-comment-actions">
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => {
                          setReplyTargets(prev => ({ ...prev, [post.id]: { commentId: c.id, userName: c.userName } }));
                          setCommentInputs(prev => ({ ...prev, [post.id]: `@${c.userName} ` }));
                          const input = document.querySelector<HTMLInputElement>(`.social-comments input[type="text"]`);
                          input?.focus();
                        }}
                        title={t('social.replyComment')}
                        style={{ fontSize: '0.65rem', color: 'var(--text-muted)', gap: '3px' }}
                      >
                        <CornerDownRight size={11} />
                        {t('social.replyComment')}
                      </button>
                      {c.userId !== user?.id && (
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => openReportPost(post)}
                          title={t('social.reportComment')}
                          style={{ fontSize: '0.65rem', color: 'var(--text-muted)', gap: '3px' }}
                        >
                          <Flag size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {expandedComments[post.id].length === 0 && (
                  <p style={{ opacity: 0.5, fontSize: '0.8rem', textAlign: 'center' }}>{t('social.noComments')}</p>
                )}
              </div>
            )}
          </article>
        ))}

        {/* Infinite scroll trigger */}
        <div ref={observerRef} style={{ height: 1 }} />
        {loading && <div style={{ textAlign: 'center', padding: '1rem' }}><Loader2 size={20} className="spin" /></div>}
        {!loading && posts.length === 0 && (
          <p style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>{t('social.noPosts')}</p>
        )}
        {!loading && !nextCursor && posts.length > 0 && (
          <p style={{ textAlign: 'center', opacity: 0.4, padding: '1rem', fontSize: '0.8rem' }}>{t('social.noMore')}</p>
        )}
      </div>

      <Modal
        isOpen={!!previewImageUrl}
        onClose={() => setPreviewImageUrl(null)}
        size="lg"
        className="social-image-modal"
      >
        {previewImageUrl && (
          <img src={previewImageUrl} alt={t('admin.postImage')} className="social-image-preview" />
        )}
      </Modal>

      <HideCommentModal
        isOpen={!!hideCommentTarget}
        commentPreview={hideCommentTarget ? `${hideCommentTarget.userName}: ${hideCommentTarget.content}` : undefined}
        submitting={hidingComment}
        onClose={() => !hidingComment && setHideCommentTarget(null)}
        onConfirm={handleHideComment}
      />

      <ReportPostModal
        isOpen={!!reportPostTarget}
        postPreview={reportPostTarget ? `${reportPostTarget.authorName}: ${reportPostTarget.content}` : undefined}
        submitting={reportingPost}
        onClose={() => !reportingPost && setReportPostTarget(null)}
        onConfirm={handleReportPost}
      />

      <DeletePostModal
        isOpen={!!deletePostTarget}
        postPreview={deletePostTarget ? `${deletePostTarget.authorName}: ${deletePostTarget.content}` : undefined}
        submitting={deletingPost}
        onClose={() => !deletingPost && setDeletePostTarget(null)}
        onConfirm={handleDeletePost}
      />

      <UserPreviewModal
        isOpen={!!previewUserTarget}
        userId={previewUserTarget?.userId ?? ''}
        fallbackName={previewUserTarget?.fallbackName ?? ''}
        fallbackAvatar={previewUserTarget?.fallbackAvatar}
        onClose={() => setPreviewUserTarget(null)}
      />
    </div>
  );
}
