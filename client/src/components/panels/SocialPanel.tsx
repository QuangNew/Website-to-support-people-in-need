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
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useMapStore } from '../../stores/mapStore';
import { useLanguage } from '../../contexts/LanguageContext';
import { socialApi } from '../../services/api';

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
}

interface CommentDto {
  id: number;
  content: string;
  createdAt: string;
  userId: string;
  userName: string;
  userAvatar?: string;
}

const CATEGORIES = ['Livelihood', 'Medical', 'Education'] as const;

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

export default function SocialPanel() {
  const { isAuthenticated, user } = useAuthStore();
  const { setAuthModal } = useMapStore();
  const { t } = useLanguage();

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
  const observerRef = useRef<HTMLDivElement>(null);

  const fetchPosts = useCallback(async (cursor?: string) => {
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
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Infinite scroll
  useEffect(() => {
    if (!observerRef.current || !nextCursor) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && nextCursor && !loading) {
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
      // TODO: Upload imageFile to Supabase Storage when bucket is created (UserTodo #8)
      const res = await socialApi.createPost({ content: newPost.trim(), category });
      setPosts(prev => [res.data, ...prev]);
      setNewPost('');
      removeImage();
    } catch { /* show nothing — api interceptor handles 401 */ }
    finally { setPosting(false); }
  };

  const handleReaction = async (postId: number, type: string) => {
    if (!isAuthenticated) { setAuthModal('login'); return; }
    try {
      const res = await socialApi.addReaction(postId, { type });
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        likeCount: res.data.likeCount,
        loveCount: res.data.loveCount,
        prayCount: res.data.prayCount,
        userReaction: res.data.userReaction ?? undefined,
      } : p));
    } catch { /* ignore */ }
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
      const res = await socialApi.addComment(postId, { content });
      setExpandedComments(prev => ({
        ...prev,
        [postId]: [res.data, ...(prev[postId] || [])],
      }));
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
    } catch { /* ignore */ }
  };

  const handleDelete = async (postId: number) => {
    try {
      await socialApi.deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch { /* ignore */ }
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
              className="btn-ghost btn-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ fontSize: '0.75rem', padding: '2px 6px' }}
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
              <div className="avatar avatar-sm">
                <span>{post.authorAvatar ? '' : getInitials(post.authorName)}</span>
              </div>
              <div className="social-post-author">
                <span className="social-post-name">{post.authorName}</span>
                <span className="social-post-time">{timeAgo(post.createdAt, t)}</span>
              </div>
              {(post.authorId === user?.id || user?.role === 'Admin') && (
                <button className="btn-ghost btn-sm social-post-more" onClick={() => handleDelete(post.id)} title={t('social.delete')}>
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
            {post.imageUrl && <img src={post.imageUrl} alt="" className="social-post-image" style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '0.5rem' }} />}

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
            </div>

            {/* Comments */}
            {loadingComments[post.id] && <div style={{ textAlign: 'center', padding: '0.5rem' }}><Loader2 size={16} className="spin" /></div>}
            {expandedComments[post.id] && (
              <div className="social-comments" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
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
                {expandedComments[post.id].map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                    <div className="avatar" style={{ width: 24, height: 24, fontSize: '0.6rem' }}>
                      <span>{getInitials(c.userName)}</span>
                    </div>
                    <div>
                      <strong>{c.userName}</strong>{' '}
                      <span style={{ opacity: 0.6 }}>{timeAgo(c.createdAt, t)}</span>
                      <p style={{ margin: '2px 0 0' }}>{c.content}</p>
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
    </div>
  );
}
