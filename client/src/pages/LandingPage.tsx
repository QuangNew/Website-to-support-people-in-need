import { Link } from 'react-router-dom';
import {
    Heart, MapPin, Users, MessageCircle, Navigation,
    ArrowRight, Sun, Moon, Globe, Shield, Zap, Radio,
    Activity, ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

/* ─────────────────────────────────────────────
   Inline styles that go beyond what CSS classes
   already cover — kept minimal and token-bound.
   ───────────────────────────────────────────── */

export default function LandingPage() {
    const { t } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    const { locale, toggleLocale } = useLanguage();

    const features = [
        {
            icon: MapPin,
            title: t('landing.feature1Title'),
            desc: t('landing.feature1Desc'),
            color: 'var(--danger-400)',
            bg: 'rgba(239, 48, 48, 0.1)',
            border: 'rgba(239, 48, 48, 0.2)',
            glow: 'var(--shadow-glow-danger)',
            tag: locale === 'vi' ? 'SOS THỜI GIAN THỰC' : 'LIVE SOS',
        },
        {
            icon: Users,
            title: t('landing.feature2Title'),
            desc: t('landing.feature2Desc'),
            color: 'var(--accent-400)',
            bg: 'rgba(6, 182, 212, 0.1)',
            border: 'rgba(6, 182, 212, 0.2)',
            glow: 'var(--shadow-glow-accent)',
            tag: locale === 'vi' ? 'MẠNG LƯỚI' : 'NETWORK',
        },
        {
            icon: MessageCircle,
            title: t('landing.feature3Title'),
            desc: t('landing.feature3Desc'),
            color: 'var(--primary-400)',
            bg: 'rgba(249, 115, 22, 0.1)',
            border: 'rgba(249, 115, 22, 0.2)',
            glow: 'var(--shadow-glow-primary)',
            tag: locale === 'vi' ? 'AI HỖ TRỢ' : 'AI-POWERED',
        },
        {
            icon: Navigation,
            title: t('landing.feature4Title'),
            desc: t('landing.feature4Desc'),
            color: 'var(--success-400)',
            bg: 'rgba(34, 197, 94, 0.1)',
            border: 'rgba(34, 197, 94, 0.2)',
            glow: 'var(--shadow-glow-success)',
            tag: locale === 'vi' ? 'CHỈ ĐƯỜNG' : 'ROUTING',
        },
    ];

    const stats = [
        { value: '500+', label: locale === 'vi' ? 'Người được hỗ trợ' : 'People Helped', icon: Heart },
        { value: '200+', label: locale === 'vi' ? 'Tình nguyện viên' : 'Volunteers', icon: Users },
        { value: '50+',  label: locale === 'vi' ? 'Điểm hỗ trợ' : 'Support Points', icon: MapPin },
        { value: '24/7', label: locale === 'vi' ? 'Hoạt động liên tục' : 'Always Active', icon: Activity },
    ];

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', overflowX: 'hidden' }}>

            {/* ══════════════════════ NAVBAR ══════════════════════ */}
            <nav style={{
                position: 'fixed', top: 0, left: 0, right: 0, height: 64,
                background: 'var(--header-bg)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                borderBottom: '1px solid var(--border-subtle)', zIndex: 'var(--z-sticky)' as never,
                display: 'flex', alignItems: 'center', padding: '0 var(--sp-6)',
                gap: 'var(--sp-4)',
            }}>
                {/* Logo */}
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2-5)', textDecoration: 'none', flexShrink: 0 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: 'var(--radius-md)',
                        background: 'var(--gradient-aurora)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: 'var(--shadow-glow-primary)',
                    }}>
                        <Heart size={16} color="white" />
                    </div>
                    <span style={{
                        fontFamily: 'var(--font-display)', fontWeight: 700,
                        fontSize: 'var(--text-lg)', color: 'var(--text-primary)',
                        letterSpacing: 'var(--tracking-tight)',
                    }}>ReliefConnect</span>
                </Link>

                {/* Pulse indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1-5)', marginLeft: 'var(--sp-2)' }}>
                    <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--success-400)',
                        boxShadow: '0 0 8px var(--success-400)',
                        display: 'inline-block',
                    }} className="animate-pulse" />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        {locale === 'vi' ? 'HỆ THỐNG HOẠT ĐỘNG' : 'SYSTEM ONLINE'}
                    </span>
                </div>

                <div style={{ flex: 1 }} />

                {/* Controls */}
                <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-icon" onClick={toggleLocale} title={locale === 'vi' ? 'English' : 'Tiếng Việt'}>
                        <Globe size={17} />
                    </button>
                    <button className="btn btn-ghost btn-icon" onClick={toggleTheme}>
                        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                    </button>
                    <div style={{ width: 1, height: 20, background: 'var(--border-default)', margin: '0 var(--sp-1)' }} />
                    <Link to="/login" className="btn btn-ghost btn-sm">{t('auth.login')}</Link>
                    <Link to="/register" className="btn btn-primary btn-sm">{t('auth.register')}</Link>
                </div>
            </nav>

            {/* ══════════════════════ HERO ══════════════════════ */}
            <section style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '100px var(--sp-6) var(--sp-20)', position: 'relative', overflow: 'hidden',
            }}>
                {/* Grid overlay */}
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
                    `,
                    backgroundSize: '60px 60px',
                    maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
                }} />

                {/* Aurora blobs */}
                <div style={{
                    position: 'absolute', top: '15%', left: '8%',
                    width: 500, height: 500, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 65%)',
                    filter: 'blur(60px)', pointerEvents: 'none',
                }} className="animate-aurora" />
                <div style={{
                    position: 'absolute', bottom: '20%', right: '6%',
                    width: 420, height: 420, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 65%)',
                    filter: 'blur(60px)', pointerEvents: 'none',
                    animationDelay: '-6s',
                }} className="animate-aurora" />
                <div style={{
                    position: 'absolute', top: '55%', left: '50%', transform: 'translateX(-50%)',
                    width: 600, height: 300, borderRadius: '50%',
                    background: 'radial-gradient(ellipse, rgba(239,48,48,0.04) 0%, transparent 65%)',
                    filter: 'blur(80px)', pointerEvents: 'none',
                }} />

                {/* Content */}
                <div className="animate-fade-in-up" style={{ maxWidth: 780, position: 'relative', zIndex: 1, textAlign: 'center' }}>

                    {/* Top tag */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)',
                        padding: 'var(--sp-1-5) var(--sp-4)',
                        background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
                        borderRadius: 'var(--radius-full)', marginBottom: 'var(--sp-8)',
                        fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                        color: 'var(--primary-400)', letterSpacing: 'var(--tracking-wider)',
                    }}>
                        <Radio size={11} />
                        {locale === 'vi' ? 'NỀN TẢNG CỨU TRỢ #1 VIỆT NAM' : '#1 RELIEF PLATFORM IN VIETNAM'}
                        <ChevronRight size={11} />
                    </div>

                    {/* Headline */}
                    <h1 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(2.8rem, 7vw, 5rem)',
                        fontWeight: 800,
                        lineHeight: 1.05,
                        letterSpacing: '-0.03em',
                        marginBottom: 'var(--sp-6)',
                        color: 'var(--text-primary)',
                    }}>
                        {t('landing.heroTitle')}{' '}
                        <span style={{
                            background: 'linear-gradient(110deg, var(--primary-400) 0%, var(--danger-400) 45%, var(--accent-400) 100%)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                        }} className="animate-gradient">
                            {t('landing.heroHighlight')}
                        </span>
                    </h1>

                    {/* Sub */}
                    <p style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-xl)', color: 'var(--text-secondary)',
                        maxWidth: 540, margin: '0 auto var(--sp-10)',
                        lineHeight: 'var(--leading-relaxed)',
                    }}>
                        {t('landing.heroSubtitle')}
                    </p>

                    {/* CTAs */}
                    <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'center', flexWrap: 'wrap', marginBottom: 'var(--sp-12)' }}>
                        <Link to="/register" className="btn btn-primary btn-lg" style={{ gap: 'var(--sp-2)' }}>
                            {t('landing.getStarted')} <ArrowRight size={17} />
                        </Link>
                        <a href="#features" className="btn btn-secondary btn-lg">
                            {t('landing.learnMore')}
                        </a>
                    </div>

                    {/* Mini credibility strip */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: 'var(--sp-6)', flexWrap: 'wrap',
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: 'var(--sp-8)',
                    }}>
                        {[
                            { icon: Shield, text: locale === 'vi' ? 'Bảo mật JWT' : 'JWT Secured' },
                            { icon: Zap,    text: locale === 'vi' ? 'SOS < 3 giây' : 'SOS < 3 sec' },
                            { icon: Heart,  text: locale === 'vi' ? 'Miễn phí 100%' : '100% Free' },
                        ].map(({ icon: Icon, text }) => (
                            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1-5)', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                                <Icon size={14} style={{ color: 'var(--primary-400)' }} />
                                {text}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════ STATS ══════════════════════ */}
            <section style={{
                padding: 'var(--sp-16) var(--sp-6)',
                background: 'var(--bg-secondary)',
                borderTop: '1px solid var(--border-subtle)',
                borderBottom: '1px solid var(--border-subtle)',
                position: 'relative', overflow: 'hidden',
            }}>
                {/* Diagonal accent line */}
                <div style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: 1, height: '100%', background: 'var(--border-subtle)', pointerEvents: 'none',
                }} />

                <div className="landing-stats-grid">
                    {stats.map(({ value, label, icon: Icon }, i) => (
                        <div key={value}
                            className="animate-fade-in-up"
                            style={{
                                textAlign: 'center',
                                animationDelay: `${i * 80}ms`,
                                padding: 'var(--sp-4)',
                                position: 'relative',
                            }}
                        >
                            <Icon size={18} style={{ color: 'var(--primary-400)', marginBottom: 'var(--sp-3)', opacity: 0.7 }} />
                            <div style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: 'var(--text-4xl)', fontWeight: 800,
                                color: 'var(--primary-400)',
                                letterSpacing: 'var(--tracking-tight)',
                                lineHeight: 1,
                                marginBottom: 'var(--sp-2)',
                                textShadow: '0 0 24px rgba(249,115,22,0.3)',
                            }}>
                                {value}
                            </div>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' }}>
                                {label}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ══════════════════════ FEATURES ══════════════════════ */}
            <section id="features" style={{ padding: 'var(--sp-20) var(--sp-6)', position: 'relative' }}>
                {/* Background blob */}
                <div style={{
                    position: 'absolute', top: '30%', right: '-5%',
                    width: 400, height: 400, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 65%)',
                    filter: 'blur(60px)', pointerEvents: 'none',
                }} />

                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    {/* Section header */}
                    <div style={{ textAlign: 'center', marginBottom: 'var(--sp-14)' }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)',
                            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                            color: 'var(--accent-400)', letterSpacing: 'var(--tracking-widest)',
                            marginBottom: 'var(--sp-4)',
                        }}>
                            <span style={{ display: 'inline-block', width: 24, height: 1, background: 'var(--accent-400)' }} />
                            {locale === 'vi' ? 'TÍNH NĂNG' : 'CAPABILITIES'}
                            <span style={{ display: 'inline-block', width: 24, height: 1, background: 'var(--accent-400)' }} />
                        </div>
                        <h2 style={{
                            fontFamily: 'var(--font-display)', fontSize: 'var(--text-4xl)',
                            fontWeight: 700, letterSpacing: 'var(--tracking-tight)',
                            marginBottom: 'var(--sp-4)',
                        }}>
                            {locale === 'vi' ? 'Tính năng nổi bật' : 'Key Features'}
                        </h2>
                        <p style={{ color: 'var(--text-tertiary)', maxWidth: 480, margin: '0 auto', fontSize: 'var(--text-lg)', lineHeight: 'var(--leading-relaxed)' }}>
                            {locale === 'vi' ? 'Công nghệ hiện đại phục vụ cộng đồng' : 'Modern technology serving the community'}
                        </p>
                    </div>

                    {/* Grid */}
                    <div className="landing-features-grid">
                        {features.map((f, i) => (
                            <div
                                key={f.title}
                                className="glass-card glass-card--interactive animate-fade-in-up"
                                style={{
                                    padding: 'var(--sp-8)',
                                    animationDelay: `${i * 100}ms`,
                                    position: 'relative', overflow: 'hidden',
                                    borderColor: 'var(--glass-border)',
                                    transition: 'border-color var(--transition-base), box-shadow var(--transition-base)',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = f.border;
                                    (e.currentTarget as HTMLElement).style.boxShadow = f.glow;
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-border)';
                                    (e.currentTarget as HTMLElement).style.boxShadow = '';
                                }}
                            >
                                {/* Corner tag */}
                                <div style={{
                                    position: 'absolute', top: 'var(--sp-4)', right: 'var(--sp-4)',
                                    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)',
                                    color: f.color, letterSpacing: 'var(--tracking-widest)',
                                    opacity: 0.7,
                                }}>
                                    {f.tag}
                                </div>

                                {/* Icon box */}
                                <div style={{
                                    width: 58, height: 58, borderRadius: 'var(--radius-lg)',
                                    background: f.bg, border: `1px solid ${f.border}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: f.color, marginBottom: 'var(--sp-6)',
                                    flexShrink: 0,
                                }}>
                                    <f.icon size={26} />
                                </div>

                                <h3 style={{
                                    fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)',
                                    fontWeight: 700, marginBottom: 'var(--sp-3)',
                                    letterSpacing: 'var(--tracking-tight)',
                                }}>
                                    {f.title}
                                </h3>
                                <p style={{
                                    color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)',
                                    fontSize: 'var(--text-base)',
                                }}>
                                    {f.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════ TRUST PILLARS ══════════════════════ */}
            <section style={{
                padding: 'var(--sp-16) var(--sp-6)',
                background: 'var(--glass-bg)',
                borderTop: '1px solid var(--border-subtle)',
                borderBottom: '1px solid var(--border-subtle)',
            }}>
                <div className="landing-pillars-grid">
                    {[
                        {
                            icon: Shield,
                            color: 'var(--accent-400)',
                            bg: 'rgba(6,182,212,0.1)',
                            title: locale === 'vi' ? 'Bảo mật cao' : 'High Security',
                            desc: locale === 'vi' ? 'Xác thực JWT + mã hóa dữ liệu toàn bộ' : 'JWT authentication + full data encryption',
                        },
                        {
                            icon: Zap,
                            color: 'var(--primary-400)',
                            bg: 'rgba(249,115,22,0.1)',
                            title: locale === 'vi' ? 'Phản hồi nhanh' : 'Fast Response',
                            desc: locale === 'vi' ? 'SOS được xử lý trong dưới 3 giây' : 'SOS requests processed in under 3 seconds',
                        },
                        {
                            icon: Heart,
                            color: 'var(--danger-400)',
                            bg: 'rgba(239,48,48,0.1)',
                            title: locale === 'vi' ? 'Miễn phí 100%' : '100% Free',
                            desc: locale === 'vi' ? 'Dự án phi lợi nhuận, mã nguồn mở' : 'Non-profit, open source project',
                        },
                    ].map(({ icon: Icon, color, bg, title, desc }) => (
                        <div key={title} style={{ textAlign: 'center' }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: 'var(--radius-xl)',
                                background: bg, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', color, margin: '0 auto var(--sp-5)',
                            }}>
                                <Icon size={24} />
                            </div>
                            <h4 style={{
                                fontFamily: 'var(--font-display)', fontWeight: 700,
                                fontSize: 'var(--text-lg)', marginBottom: 'var(--sp-2)',
                            }}>
                                {title}
                            </h4>
                            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                                {desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ══════════════════════ CTA ══════════════════════ */}
            <section style={{
                padding: 'var(--sp-20) var(--sp-6)',
                textAlign: 'center', position: 'relative', overflow: 'hidden',
            }}>
                {/* Central glow */}
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 600, height: 300, borderRadius: '50%',
                    background: 'radial-gradient(ellipse, rgba(249,115,22,0.07) 0%, transparent 65%)',
                    filter: 'blur(60px)', pointerEvents: 'none',
                }} />
                <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                    <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                        color: 'var(--primary-400)', letterSpacing: 'var(--tracking-widest)',
                        marginBottom: 'var(--sp-5)',
                    }}>
                        {locale === 'vi' ? '// THAM GIA NGAY' : '// GET STARTED NOW'}
                    </div>
                    <h2 style={{
                        fontFamily: 'var(--font-display)', fontSize: 'var(--text-4xl)',
                        fontWeight: 800, letterSpacing: 'var(--tracking-tight)',
                        lineHeight: 'var(--leading-snug)', marginBottom: 'var(--sp-5)',
                    }}>
                        {t('landing.ctaTitle')}
                    </h2>
                    <p style={{
                        color: 'var(--text-secondary)', fontSize: 'var(--text-lg)',
                        marginBottom: 'var(--sp-10)', lineHeight: 'var(--leading-relaxed)',
                    }}>
                        {t('landing.ctaSubtitle')}
                    </p>
                    <Link to="/register" className="btn btn-primary btn-lg" style={{ gap: 'var(--sp-2)' }}>
                        {t('landing.getStarted')} <ArrowRight size={17} />
                    </Link>
                </div>
            </section>

            {/* ══════════════════════ FOOTER ══════════════════════ */}
            <footer style={{
                padding: 'var(--sp-6) var(--sp-6)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 'var(--sp-3)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    <div style={{
                        width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                        background: 'var(--gradient-aurora)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Heart size={11} color="white" />
                    </div>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-tertiary)' }}>ReliefConnect</span>
                    <span>© 2026</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                    {locale === 'vi' ? 'Kết nối hỗ trợ — lan tỏa yêu thương' : 'Connecting support — spreading love'}
                </div>
            </footer>
        </div>
    );
}
