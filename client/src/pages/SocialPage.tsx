import { useState, useRef, useEffect, useCallback } from 'react';
import { Heart, HandHeart, HandHelping, MessageCircle, Send, Image, Trash2, Filter, EyeOff, Flag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuthStore } from '../stores/authStore';
import HideCommentModal from '../components/ui/HideCommentModal';
import ReportPostModal from '../components/ui/ReportPostModal';
import { socialApi, getImageUrl, type HideCommentRequest } from '../services/api';

interface PostDto {
    id: number;
    content: string;
    imageUrl?: string;
    category: string;
    createdAt: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    authorRole: string;
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

const ROLE_BADGE_STYLES: Record<string, { bg: string; color: string }> = {
    Admin: { bg: 'var(--danger-500)', color: 'white' },
    Volunteer: { bg: 'var(--success-500)', color: 'white' },
    Sponsor: { bg: 'var(--warning-500)', color: 'white' },
    PersonInNeed: { bg: 'var(--primary-500)', color: 'white' },
    Guest: { bg: 'var(--neutral-400)', color: 'white' },
};

function RoleBadge({ role, t }: { role: string; t: (k: string) => string }) {
    const style = ROLE_BADGE_STYLES[role] || ROLE_BADGE_STYLES.Guest;
    return (
        <span style={{
            display: 'inline-block',
            padding: '1px 8px',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            background: style.bg,
            color: style.color,
            lineHeight: 1.6,
        }}>
            {t(`profile.roles.${role}`) || role}
        </span>
    );
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

export default function SocialPage() {
    const { t } = useLanguage();
    const user = useAuthStore((s) => s.user);
    const [newPost, setNewPost] = useState('');
    const [category, setCategory] = useState('Livelihood');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    // Filters
    const [filterRole, setFilterRole] = useState('');
    const [filterSort, setFilterSort] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Posts state
    const [posts, setPosts] = useState<PostDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [expandedComments, setExpandedComments] = useState<Record<number, CommentDto[]>>({});
    const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
    const [loadingComments, setLoadingComments] = useState<Record<number, boolean>>({});
    const [hideCommentTarget, setHideCommentTarget] = useState<HideCommentTarget | null>(null);
    const [hidingComment, setHidingComment] = useState(false);
    const [reportPostTarget, setReportPostTarget] = useState<ReportPostTarget | null>(null);
    const [reportingPost, setReportingPost] = useState(false);
    const observerRef = useRef<HTMLDivElement>(null);

    const fetchPosts = useCallback(async (cursor?: string) => {
        try {
            const params: Record<string, string | number | undefined> = { cursor, limit: 10 };
            if (filterRole) params.role = filterRole;
            if (filterSort) params.sort = filterSort;
            const res = await socialApi.getPosts(params as Parameters<typeof socialApi.getPosts>[0]);
            const data = res.data as { items: PostDto[]; nextCursor?: string };
            if (cursor) {
                setPosts(prev => [...prev, ...data.items]);
            } else {
                setPosts(data.items);
            }
            setNextCursor(data.nextCursor ?? null);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [filterRole, filterSort]);

    useEffect(() => {
        setLoading(true);
        setPosts([]);
        setNextCursor(null);
        fetchPosts();
    }, [fetchPosts]);

    // Infinite scroll
    useEffect(() => {
        const el = observerRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && nextCursor) {
                fetchPosts(nextCursor);
            }
        }, { threshold: 0.5 });
        observer.observe(el);
        return () => observer.disconnect();
    }, [nextCursor, fetchPosts]);

    const handleCreatePost = async () => {
        if (!newPost.trim() || creating) return;
        setCreating(true);
        try {
            let imageUrl: string | undefined;
            if (imageFile) {
                const uploadRes = await socialApi.uploadImage(imageFile);
                imageUrl = (uploadRes.data as { imageUrl: string }).imageUrl;
            }
            const res = await socialApi.createPost({ content: newPost, category, imageUrl });
            setPosts(prev => [res.data as PostDto, ...prev]);
            setNewPost('');
            setImageFile(null);
            setImagePreview(null);
        } catch {
            // ignore
        } finally {
            setCreating(false);
        }
    };

    const handleReaction = async (postId: number, type: string) => {
        try {
            const res = await socialApi.addReaction(postId, { type });
            const d = res.data as { likeCount: number; loveCount: number; prayCount: number; userReaction?: string };
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, likeCount: d.likeCount, loveCount: d.loveCount, prayCount: d.prayCount, userReaction: d.userReaction } : p));
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
            const data = res.data as { items: CommentDto[] };
            setExpandedComments(prev => ({ ...prev, [postId]: data.items }));
        } catch { /* ignore */ } finally {
            setLoadingComments(prev => ({ ...prev, [postId]: false }));
        }
    };

    const handleAddComment = async (postId: number) => {
        const content = commentInputs[postId]?.trim();
        if (!content) return;
        try {
            const res = await socialApi.addComment(postId, { content });
            const newComment = res.data as CommentDto;
            setExpandedComments(prev => ({ ...prev, [postId]: [newComment, ...(prev[postId] || [])] }));
            setCommentInputs(prev => ({ ...prev, [postId]: '' }));
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
        } catch (err: unknown) {
            const axiosErr = err as { response?: { status?: number; data?: { message?: string; violationCount?: number; isBanned?: boolean } } };
            if (axiosErr?.response?.status === 422) {
                const data = axiosErr.response.data;
                toast.error(data?.message || t('social.commentViolation'), { duration: 6000 });
                setCommentInputs(prev => ({ ...prev, [postId]: '' }));
                if (data?.isBanned) {
                    // Force logout if banned
                    setTimeout(() => window.location.reload(), 3000);
                }
            } else if (axiosErr?.response?.status === 403) {
                toast.error(axiosErr.response.data?.message || t('common.forbidden'), { duration: 5000 });
            }
        }
    };

    const handleDeletePost = async (postId: number) => {
        try {
            await socialApi.deletePost(postId);
            setPosts(prev => prev.filter(p => p.id !== postId));
        } catch { /* ignore */ }
    };

    const openReportPost = (post: PostDto) => {
        if (!user) {
            toast.error(t('social.reportLoginRequired'));
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
            setPosts(prev => prev.map(p => p.id === hideCommentTarget.postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p));
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

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const initials = user?.fullName
        ? user.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        : '?';

    const roleOptions = ['', 'PersonInNeed', 'Sponsor', 'Volunteer'];

    return (
        <div className="animate-fade-in-up" style={{ maxWidth: 640, margin: '0 auto' }}>
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="page-header__info">
                    <h1 className="page-header__title" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                        {t('social.title') || t('sidebar.social')}
                    </h1>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowFilters(v => !v)} title={t('social.filter')}>
                    <Filter size={18} />
                </button>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="glass-card" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select className="input" style={{ width: 'auto', minWidth: 140 }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                        <option value="">{t('social.allRoles')}</option>
                        {roleOptions.filter(Boolean).map(r => (
                            <option key={r} value={r}>{t(`profile.roles.${r}`) || r}</option>
                        ))}
                    </select>
                    <select className="input" style={{ width: 'auto', minWidth: 170 }} value={filterSort} onChange={e => setFilterSort(e.target.value)}>
                        <option value="">{t('social.sortNewest')}</option>
                        <option value="recentReaction">{t('social.sortReaction')}</option>
                        <option value="recentComment">{t('social.sortComment')}</option>
                    </select>
                </div>
            )}

            {/* Create Post */}
            {user && (
                <div className="glass-card" style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-6)' }}>
                    <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                        <div className="avatar avatar-md">{initials}</div>
                        <div style={{ flex: 1 }}>
                            <textarea
                                className="input"
                                placeholder={t('social.composePlaceholder')}
                                value={newPost}
                                onChange={(e) => setNewPost(e.target.value)}
                                style={{ minHeight: 80, resize: 'none', marginBottom: 'var(--sp-3)' }}
                            />
                            {imagePreview && (
                                <div style={{ marginBottom: 'var(--sp-3)', position: 'relative', display: 'inline-block' }}>
                                    <img src={imagePreview} alt="preview" style={{ maxHeight: 150, borderRadius: 'var(--radius-md)' }} />
                                    <button className="btn btn-ghost btn-icon btn-sm" style={{ position: 'absolute', top: 4, right: 4 }} onClick={() => { setImageFile(null); setImagePreview(null); }}>✕</button>
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                                    <label className="btn btn-ghost btn-icon btn-sm" title={t('social.addImage')} style={{ cursor: 'pointer' }}>
                                        <Image size={16} />
                                        <input type="file" accept="image/*" hidden onChange={handleImageSelect} />
                                    </label>
                                    <select className="input" style={{ width: 'auto', fontSize: 'var(--text-sm)', padding: '2px 8px' }} value={category} onChange={e => setCategory(e.target.value)}>
                                        <option value="Livelihood">{t('social.category.Livelihood')}</option>
                                        <option value="Medical">{t('social.category.Medical')}</option>
                                        <option value="Education">{t('social.category.Education')}</option>
                                    </select>
                                </div>
                                <button className="btn btn-primary btn-sm" disabled={!newPost.trim() || creating} onClick={handleCreatePost}>
                                    <Send size={14} /> {t('social.createPost') || t('common.save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Posts Feed */}
            {loading && posts.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>{t('common.loading')}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                {posts.map((post) => (
                    <div key={post.id} className="glass-card" style={{ padding: 'var(--sp-5)' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
                            {post.authorAvatar ? (
                                <img src={getImageUrl(post.authorAvatar)} alt="" className="avatar avatar-md" style={{ objectFit: 'cover' }} />
                            ) : (
                                <div className="avatar avatar-md">{getInitials(post.authorName)}</div>
                            )}
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-base)' }}>
                                        {post.authorName}
                                    </span>
                                    <RoleBadge role={post.authorRole} t={t} />
                                </div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 'var(--sp-1-5)' }}>
                                    <span className={`badge badge-${post.category.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>
                                        {t(`social.category.${post.category}`) || post.category}
                                    </span>
                                    · {timeAgo(post.createdAt, t)}
                                </div>
                            </div>
                            {(post.authorId === user?.id || user?.role === 'Admin') && (
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDeletePost(post.id)} title={t('social.delete')}>
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>

                        {/* Content */}
                        <p style={{ color: 'var(--text-primary)', lineHeight: 'var(--leading-relaxed)', marginBottom: 'var(--sp-4)', fontSize: 'var(--text-base)', whiteSpace: 'pre-wrap' }}>
                            {post.content}
                        </p>

                        {post.imageUrl && (
                            <img src={getImageUrl(post.imageUrl)} alt="" style={{ width: '100%', borderRadius: 'var(--radius-md)', marginBottom: 'var(--sp-4)', maxHeight: 400, objectFit: 'cover' }} />
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 'var(--sp-4)', paddingTop: 'var(--sp-3)', borderTop: '1px solid var(--border-subtle)' }}>
                            <button className="btn btn-ghost btn-sm" style={post.userReaction === 'Like' ? { color: 'var(--danger-400)' } : {}} onClick={() => handleReaction(post.id, 'Like')}>
                                <Heart size={16} fill={post.userReaction === 'Like' ? 'currentColor' : 'none'} /> {post.likeCount || ''}
                            </button>
                            <button className="btn btn-ghost btn-sm" style={post.userReaction === 'Love' ? { color: 'var(--accent-400)' } : {}} onClick={() => handleReaction(post.id, 'Love')}>
                                <HandHeart size={16} /> {post.loveCount || ''}
                            </button>
                            <button className="btn btn-ghost btn-sm" style={post.userReaction === 'Pray' ? { color: 'var(--warning-400)' } : {}} onClick={() => handleReaction(post.id, 'Pray')}>
                                <HandHelping size={16} /> {post.prayCount || ''}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => toggleComments(post.id)}>
                                <MessageCircle size={16} /> {post.commentCount || ''}
                            </button>
                            {post.authorId !== user?.id && (
                                <button className="btn btn-ghost btn-sm" onClick={() => openReportPost(post)}>
                                    <Flag size={16} /> {t('social.reportPost')}
                                </button>
                            )}
                        </div>

                        {/* Comments */}
                        {expandedComments[post.id] !== undefined && (
                            <div style={{ marginTop: 'var(--sp-3)', paddingTop: 'var(--sp-3)', borderTop: '1px solid var(--border-subtle)' }}>
                                {user && (
                                    <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
                                        <input
                                            className="input"
                                            style={{ flex: 1, fontSize: 'var(--text-sm)' }}
                                            placeholder={t('social.commentPlaceholder')}
                                            value={commentInputs[post.id] || ''}
                                            onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                            onKeyDown={e => e.key === 'Enter' && handleAddComment(post.id)}
                                        />
                                        <button className="btn btn-primary btn-icon btn-sm" onClick={() => handleAddComment(post.id)} disabled={!commentInputs[post.id]?.trim()}>
                                            <Send size={14} />
                                        </button>
                                    </div>
                                )}
                                {loadingComments[post.id] && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{t('common.loading')}</p>}
                                {expandedComments[post.id]?.length === 0 && !loadingComments[post.id] && (
                                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{t('social.noComments')}</p>
                                )}
                                {expandedComments[post.id]?.map(c => (
                                    <div key={c.id} style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)', alignItems: 'flex-start' }}>
                                        {c.userAvatar ? (
                                            <img src={getImageUrl(c.userAvatar)} alt="" className="avatar avatar-sm" style={{ objectFit: 'cover' }} />
                                        ) : (
                                            <div className="avatar avatar-sm" style={{ fontSize: '0.6rem' }}>{getInitials(c.userName)}</div>
                                        )}
                                        <div style={{ background: 'var(--glass-bg)', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--radius-md)', flex: 1 }}>
                                            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{c.userName}</span>
                                            <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>{c.content}</p>
                                        </div>
                                        {user?.role === 'Admin' && (
                                            <button
                                                className="btn btn-ghost btn-icon btn-sm"
                                                style={{ color: 'var(--danger-400)', flexShrink: 0 }}
                                                title={t('social.hideComment')}
                                                onClick={() => setHideCommentTarget({ postId: post.id, commentId: c.id, content: c.content, userName: c.userName })}
                                            >
                                                <EyeOff size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={observerRef} style={{ height: 40 }} />
            {!loading && posts.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>{t('social.noPosts')}</p>}
            {!nextCursor && posts.length > 0 && <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', margin: 'var(--sp-4) 0' }}>{t('social.noMore')}</p>}

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
        </div>
    );
}
