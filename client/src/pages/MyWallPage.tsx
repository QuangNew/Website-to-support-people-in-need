import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageSquare,
  Send,
  ThumbsUp,
  HandHeart,
  ChevronDown,
  Loader2,
  Trash2,
  User,
  Calendar,
  Shield,
  Edit3,
  ArrowLeft,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useMapStore } from '../stores/mapStore';
import { useLanguage } from '../contexts/LanguageContext';
import { socialApi, authApi } from '../services/api';

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

interface UserProfile {
  id: string;
  userName: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string;
  createdAt: string;
  verificationStatus: string;
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

export default function MyWallPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user: currentUser } = useAuthStore();
  const { setAuthModal } = useMapStore();
  const { t, locale } = useLanguage();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<number, CommentDto[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<number, boolean>>({});
  const observerRef = useRef<HTMLDivElement>(null);

  const isOwnProfile = currentUser?.id === userId;

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await authApi.getMe();
      setProfile(res.data);
    } catch {
      setProfile(null);
    }
  }, [userId]);

  const fetchPosts = useCallback(async (cursor?: string) => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await socialApi.getUserWall(userId, { cursor, limit: 10 });
      const data = res.data;
      if (cursor) {
        setPosts(prev => [...prev, ...data.items]);
      } else {
        setPosts(data.items);
      }
      setNextCursor(data.nextCursor ?? null);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOwnProfile) fetchProfile();
    fetchPosts();
  }, [fetchPosts, fetchProfile, isOwnProfile]);

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

  const handleReaction = async (postId: number, type: string) => {
    if (!isAuthenticated) { setAuthModal('login'); return; }

    // Optimistic update
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
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        likeCount: res.data.likeCount,
        loveCount: res.data.loveCount,
        prayCount: res.data.prayCount,
        userReaction: res.data.userReaction ?? undefined,
      } : p));
    } catch {
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

  const profileData = profile || (posts[0] ? {
    id: posts[0].authorId,
    userName: posts[0].authorName,
    fullName: posts[0].authorName,
    email: '',
    role: 'User',
    createdAt: posts[0].createdAt,
    verificationStatus: 'None',
  } : null);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingTop: 'var(--space-6)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 var(--space-4)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 'var(--space-4)' }}>
          <ArrowLeft size={16} /> {t('common.back')}
        </button>

        {/* Profile Header */}
        {profileData && (
          <div className="glass-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
              <div className="avatar avatar-xl">
                {profileData.avatarUrl ? (
                  <img src={profileData.avatarUrl} alt={profileData.fullName} />
                ) : (
                  <User size={40} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                  {profileData.fullName}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                  @{profileData.userName}
                </p>
              </div>
              {isOwnProfile && (
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>
                  <Edit3 size={14} /> {t('profile.editProfile')}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-6)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Shield size={16} />
                <span className="badge badge-primary">{t(`profile.roles.${profileData.role}`) || profileData.role}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Calendar size={16} />
                <span>{new Date(profileData.createdAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <MessageSquare size={16} />
                <span>{posts.length} {locale === 'vi' ? 'bài viết' : 'posts'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Posts Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {posts.map((post) => (
            <article key={post.id} className="glass-card" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div className="avatar avatar-sm">
                  <span>{post.authorAvatar ? '' : getInitials(post.authorName)}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{post.authorName}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 'var(--space-2)' }}>
                    {timeAgo(post.createdAt, t)}
                  </span>
                </div>
                {(post.authorId === currentUser?.id || currentUser?.role === 'Admin') && (
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(post.id)} title={t('social.delete')}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <span className={`badge badge-${post.category.toLowerCase()}`} style={{ fontSize: '0.65rem', marginBottom: 'var(--space-2)' }}>
                {t(`social.category.${post.category}`)}
              </span>

              <p style={{ color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 'var(--space-4)', fontSize: 'var(--text-md)' }}>
                {post.content}
              </p>
              {post.imageUrl && <img src={post.imageUrl} alt="" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: 'var(--space-3)' }} />}

              <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  className={`btn btn-ghost btn-sm ${post.userReaction === 'Like' ? 'text-primary' : ''}`}
                  onClick={() => handleReaction(post.id, 'Like')}
                >
                  <ThumbsUp size={15} fill={post.userReaction === 'Like' ? 'currentColor' : 'none'} />
                  <span>{post.likeCount || ''}</span>
                </button>
                <button
                  className={`btn btn-ghost btn-sm ${post.userReaction === 'Love' ? 'text-danger' : ''}`}
                  onClick={() => handleReaction(post.id, 'Love')}
                >
                  <Heart size={15} fill={post.userReaction === 'Love' ? 'currentColor' : 'none'} />
                  <span>{post.loveCount || ''}</span>
                </button>
                <button
                  className={`btn btn-ghost btn-sm ${post.userReaction === 'Pray' ? 'text-warning' : ''}`}
                  onClick={() => handleReaction(post.id, 'Pray')}
                >
                  <HandHeart size={15} fill={post.userReaction === 'Pray' ? 'currentColor' : 'none'} />
                  <span>{post.prayCount || ''}</span>
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => toggleComments(post.id)}>
                  <MessageSquare size={15} />
                  <span>{post.commentCount || ''}</span>
                  <ChevronDown size={12} style={{ transform: expandedComments[post.id] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
              </div>

              {loadingComments[post.id] && <div style={{ textAlign: 'center', padding: 'var(--space-3)' }}><Loader2 size={16} className="spin" /></div>}
              {expandedComments[post.id] && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    <input
                      type="text"
                      placeholder={t('social.commentPlaceholder')}
                      value={commentInputs[post.id] || ''}
                      onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleComment(post.id)}
                      className="input input-sm"
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-ghost btn-sm" onClick={() => handleComment(post.id)}>
                      <Send size={12} />
                    </button>
                  </div>
                  {expandedComments[post.id].map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                      <div className="avatar" style={{ width: 24, height: 24, fontSize: '0.6rem' }}>
                        <span>{getInitials(c.userName)}</span>
                      </div>
                      <div>
                        <strong>{c.userName}</strong>{' '}
                        <span style={{ opacity: 0.6, fontSize: 'var(--text-xs)' }}>{timeAgo(c.createdAt, t)}</span>
                        <p style={{ margin: '2px 0 0' }}>{c.content}</p>
                      </div>
                    </div>
                  ))}
                  {expandedComments[post.id].length === 0 && (
                    <p style={{ opacity: 0.5, fontSize: 'var(--text-sm)', textAlign: 'center' }}>{t('social.noComments')}</p>
                  )}
                </div>
              )}
            </article>
          ))}

          <div ref={observerRef} style={{ height: 1 }} />
          {loading && <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}><Loader2 size={20} className="spin" /></div>}
          {!loading && posts.length === 0 && (
            <p style={{ textAlign: 'center', opacity: 0.5, padding: 'var(--space-8)' }}>{t('social.noPosts')}</p>
          )}
          {!loading && !nextCursor && posts.length > 0 && (
            <p style={{ textAlign: 'center', opacity: 0.4, padding: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>{t('social.noMore')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
