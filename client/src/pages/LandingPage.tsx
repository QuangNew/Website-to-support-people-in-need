import { Link } from 'react-router-dom';
import { Heart, MapPin, Users, MessageCircle, Navigation, ArrowRight, Sun, Moon, Globe, Shield, Zap } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

export default function LandingPage() {
    const { t } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    const { locale, toggleLocale } = useLanguage();

    const features = [
        { icon: MapPin, title: t('landing.feature1Title'), desc: t('landing.feature1Desc'), color: 'var(--danger-500)', bg: 'rgba(239, 68, 68, 0.1)' },
        { icon: Users, title: t('landing.feature2Title'), desc: t('landing.feature2Desc'), color: 'var(--accent-400)', bg: 'rgba(6, 182, 212, 0.1)' },
        { icon: MessageCircle, title: t('landing.feature3Title'), desc: t('landing.feature3Desc'), color: 'var(--primary-400)', bg: 'rgba(249, 115, 22, 0.1)' },
        { icon: Navigation, title: t('landing.feature4Title'), desc: t('landing.feature4Desc'), color: 'var(--success-500)', bg: 'rgba(34, 197, 94, 0.1)' },
    ];

    const stats = [
        { value: '500+', label: locale === 'vi' ? 'Người được hỗ trợ' : 'People Helped' },
        { value: '200+', label: locale === 'vi' ? 'Tình nguyện viên' : 'Volunteers' },
        { value: '50+', label: locale === 'vi' ? 'Điểm hỗ trợ' : 'Support Points' },
        { value: '24/7', label: locale === 'vi' ? 'Hoạt động liên tục' : 'Always Active' },
    ];

    return (
        <div style={{ minHeight: '100vh' }}>
            {/* Navbar */}
            <nav style={{
                position: 'fixed', top: 0, left: 0, right: 0, height: 64,
                background: 'var(--header-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                borderBottom: '1px solid var(--border-subtle)', zIndex: 300,
                display: 'flex', alignItems: 'center', padding: '0 var(--space-6)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--primary-500), var(--danger-500))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-glow-primary)' }}>
                        <Heart size={18} color="white" />
                    </div>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-lg)' }}>ReliefConnect</span>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-icon" onClick={toggleLocale} title={locale === 'vi' ? 'English' : 'Tiếng Việt'}>
                        <Globe size={18} />
                    </button>
                    <button className="btn btn-ghost btn-icon" onClick={toggleTheme}>
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <Link to="/login" className="btn btn-secondary btn-sm">{t('auth.login')}</Link>
                    <Link to="/register" className="btn btn-primary btn-sm">{t('auth.register')}</Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', padding: '120px var(--space-6) var(--space-16)',
                position: 'relative', overflow: 'hidden',
            }}>
                {/* Floating decorations */}
                <div style={{ position: 'absolute', top: '20%', left: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249, 115, 22, 0.08) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} className="animate-float" />
                <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none', animationDelay: '1.5s' }} className="animate-float" />

                <div className="animate-fade-in-up" style={{ maxWidth: 720, position: 'relative', zIndex: 1 }}>
                    <div className="badge badge-primary badge-lg" style={{ marginBottom: 'var(--space-6)' }}>
                        <Zap size={14} /> {locale === 'vi' ? 'Nền tảng cứu trợ #1 Việt Nam' : '#1 Relief Platform in Vietnam'}
                    </div>
                    <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: 'var(--space-6)', letterSpacing: '-0.02em' }}>
                        {t('landing.heroTitle')}{' '}
                        <span style={{ background: 'linear-gradient(135deg, var(--primary-400), var(--accent-400))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                            {t('landing.heroHighlight')}
                        </span>
                    </h1>
                    <p style={{ fontSize: 'var(--text-xl)', color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto var(--space-8)', lineHeight: 1.7 }}>
                        {t('landing.heroSubtitle')}
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link to="/register" className="btn btn-primary btn-lg">
                            {t('landing.getStarted')} <ArrowRight size={18} />
                        </Link>
                        <a href="#features" className="btn btn-secondary btn-lg">
                            {t('landing.learnMore')}
                        </a>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section style={{ padding: 'var(--space-16) var(--space-6)', background: 'var(--glass-bg)' }}>
                <div className="container" style={{ maxWidth: 960 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-6)', textAlign: 'center' }}>
                        {stats.map((s) => (
                            <div key={s.value} className="animate-fade-in-up">
                                <div style={{ fontSize: 'var(--text-4xl)', fontWeight: 800, color: 'var(--primary-400)', marginBottom: 'var(--space-1)' }}>{s.value}</div>
                                <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-base)' }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" style={{ padding: 'var(--space-20) var(--space-6)' }}>
                <div className="container" style={{ maxWidth: 1100 }}>
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
                        <h2 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-3)' }}>
                            {locale === 'vi' ? 'Tính năng nổi bật' : 'Key Features'}
                        </h2>
                        <p style={{ color: 'var(--text-tertiary)', maxWidth: 500, margin: '0 auto', fontSize: 'var(--text-lg)' }}>
                            {locale === 'vi' ? 'Công nghệ hiện đại phục vụ cộng đồng' : 'Modern technology serving the community'}
                        </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-6)' }}>
                        {features.map((f) => (
                            <div key={f.title} className="glass-card glass-card--interactive" style={{ padding: 'var(--space-8)' }}>
                                <div style={{
                                    width: 56, height: 56, borderRadius: 'var(--radius-lg)', background: f.bg,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.color,
                                    marginBottom: 'var(--space-5)',
                                }}>
                                    <f.icon size={26} />
                                </div>
                                <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-3)' }}>{f.title}</h3>
                                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Trust Section */}
            <section style={{ padding: 'var(--space-16) var(--space-6)', background: 'var(--glass-bg)' }}>
                <div className="container" style={{ maxWidth: 800 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-8)', textAlign: 'center' }}>
                        <div>
                            <Shield size={32} style={{ color: 'var(--accent-400)', marginBottom: 'var(--space-3)' }} />
                            <h4 style={{ marginBottom: 'var(--space-2)' }}>{locale === 'vi' ? 'Bảo mật cao' : 'High Security'}</h4>
                            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                                {locale === 'vi' ? 'Xác thực JWT + mã hóa dữ liệu' : 'JWT authentication + data encryption'}
                            </p>
                        </div>
                        <div>
                            <Zap size={32} style={{ color: 'var(--primary-400)', marginBottom: 'var(--space-3)' }} />
                            <h4 style={{ marginBottom: 'var(--space-2)' }}>{locale === 'vi' ? 'Phản hồi nhanh' : 'Fast Response'}</h4>
                            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                                {locale === 'vi' ? 'SOS được xử lý trong < 3 giây' : 'SOS processed in < 3 seconds'}
                            </p>
                        </div>
                        <div>
                            <Heart size={32} style={{ color: 'var(--danger-500)', marginBottom: 'var(--space-3)' }} />
                            <h4 style={{ marginBottom: 'var(--space-2)' }}>{locale === 'vi' ? 'Miễn phí 100%' : '100% Free'}</h4>
                            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                                {locale === 'vi' ? 'Dự án phi lợi nhuận, mã nguồn mở' : 'Non-profit, open source project'}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section style={{ padding: 'var(--space-20) var(--space-6)', textAlign: 'center' }}>
                <div className="container" style={{ maxWidth: 600 }}>
                    <h2 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-4)' }}>{t('landing.ctaTitle')}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-8)', lineHeight: 1.7 }}>
                        {t('landing.ctaSubtitle')}
                    </p>
                    <Link to="/register" className="btn btn-primary btn-lg">
                        {t('landing.getStarted')} <ArrowRight size={18} />
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer style={{ padding: 'var(--space-8) var(--space-6)', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    <Heart size={14} style={{ color: 'var(--primary-400)' }} />
                    <span>ReliefConnect © 2026 — {locale === 'vi' ? 'Kết nối hỗ trợ, lan tỏa yêu thương' : 'Connecting support, spreading love'}</span>
                </div>
            </footer>
        </div>
    );
}
