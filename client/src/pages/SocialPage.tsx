import { useState } from 'react';
import { Heart, MessageCircle, Share2, Send, Image, MapPin } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuthStore } from '../stores/authStore';

export default function SocialPage() {
    const { t } = useLanguage();
    const user = useAuthStore((s) => s.user);
    const [newPost, setNewPost] = useState('');

    const posts = [
        {
            id: 1,
            author: 'Nguyễn Văn Minh',
            avatar: 'NM',
            role: 'Tình nguyện viên',
            time: '2 giờ trước',
            content: 'Hôm nay đội mình đã phát được 200 phần cơm tại khu vực ngập lụt Quận 8. Cảm ơn mọi người đã đồng hành! 💪',
            likes: 45,
            comments: 12,
            liked: false,
        },
        {
            id: 2,
            author: 'Trần Thị Hoa',
            avatar: 'TH',
            role: 'Nhà tài trợ',
            time: '5 giờ trước',
            content: 'Vừa quyên góp được 500kg gạo và 200 thùng mì. Ai cần hỗ trợ vùng Bình Dương liên hệ nhé!',
            likes: 78,
            comments: 23,
            liked: true,
        },
        {
            id: 3,
            author: 'Lê Hoàng Nam',
            avatar: 'LN',
            role: 'Tình nguyện viên',
            time: '1 ngày trước',
            content: 'Chia sẻ kinh nghiệm cứu trợ lũ lụt: Luôn mang theo áo phao, đèn pin và sạc dự phòng. An toàn là trên hết! 🙏',
            likes: 120,
            comments: 31,
            liked: false,
        },
    ];

    const initials = user?.fullName
        ? user.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        : '?';

    return (
        <div className="animate-fade-in-up" style={{ maxWidth: 640, margin: '0 auto' }}>
            <div className="page-header">
                <div className="page-header__info">
                    <h1 className="page-header__title">{t('social.title')}</h1>
                </div>
            </div>

            {/* Create Post */}
            <div className="glass-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div className="avatar avatar-md">{initials}</div>
                    <div style={{ flex: 1 }}>
                        <textarea
                            className="input"
                            placeholder={t('social.writePost')}
                            value={newPost}
                            onChange={(e) => setNewPost(e.target.value)}
                            style={{ minHeight: 80, resize: 'none', marginBottom: 'var(--space-3)' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <button className="btn btn-ghost btn-icon btn-sm" title="Add image"><Image size={16} /></button>
                                <button className="btn btn-ghost btn-icon btn-sm" title="Add location"><MapPin size={16} /></button>
                            </div>
                            <button className="btn btn-primary btn-sm" disabled={!newPost.trim()}>
                                <Send size={14} /> {t('social.createPost')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Posts Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {posts.map((post) => (
                    <div key={post.id} className="glass-card" style={{ padding: 'var(--space-5)' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                            <div className="avatar avatar-md">{post.avatar}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 'var(--text-md)' }}>{post.author}</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span className="badge badge-accent badge-sm">{post.role}</span>
                                    · {post.time}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <p style={{ color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 'var(--space-4)', fontSize: 'var(--text-md)' }}>
                            {post.content}
                        </p>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
                            <button className={`btn btn-ghost btn-sm ${post.liked ? 'text-danger' : ''}`} style={post.liked ? { color: 'var(--danger-500)' } : {}}>
                                <Heart size={16} fill={post.liked ? 'currentColor' : 'none'} /> {post.likes}
                            </button>
                            <button className="btn btn-ghost btn-sm">
                                <MessageCircle size={16} /> {post.comments}
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
                                <Share2 size={16} /> {t('social.share')}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
