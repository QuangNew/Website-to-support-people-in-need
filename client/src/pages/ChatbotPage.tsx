import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Message {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    time: string;
}

export default function ChatbotPage() {
    const { t, locale } = useLanguage();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            role: 'assistant',
            content: locale === 'vi'
                ? 'Xin chào! Tôi là trợ lý AI của ReliefConnect. Tôi có thể giúp bạn tìm kiếm thông tin cứu trợ, hướng dẫn sử dụng nền tảng, hoặc trả lời câu hỏi. Hãy hỏi tôi bất kỳ điều gì!'
                : 'Hello! I am ReliefConnect\'s AI assistant. I can help you find relief information, guide you through the platform, or answer questions. Ask me anything!',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
    ]);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!input.trim()) return;
        const userMsg: Message = {
            id: Date.now(),
            role: 'user',
            content: input,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');

        // Simulate AI response
        setTimeout(() => {
            const aiMsg: Message = {
                id: Date.now() + 1,
                role: 'assistant',
                content: locale === 'vi'
                    ? 'Cảm ơn bạn đã gửi tin nhắn. Tính năng trò chuyện AI đang được phát triển. Vui lòng thử lại sau!'
                    : 'Thank you for your message. The AI chat feature is under development. Please try again later!',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setMessages(prev => [...prev, aiMsg]);
        }, 1000);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - var(--space-12))', maxWidth: 800, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--primary-500), var(--accent-500))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-glow-primary)' }}>
                    <Sparkles size={22} color="white" />
                </div>
                <div>
                    <h2 style={{ fontSize: 'var(--text-xl)' }}>{t('chatbot.title')}</h2>
                    <span className="badge badge-success badge-sm">Online</span>
                </div>
            </div>

            {/* Messages */}
            <div className="glass-card" style={{ flex: 1, padding: 'var(--space-5)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {messages.map((msg) => (
                    <div key={msg.id} style={{
                        display: 'flex',
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        gap: 'var(--space-2)',
                    }}>
                        {msg.role === 'assistant' && (
                            <div className="avatar avatar-sm" style={{ background: 'linear-gradient(135deg, var(--primary-500), var(--accent-500))', flexShrink: 0 }}>
                                <Bot size={16} />
                            </div>
                        )}
                        <div style={{
                            maxWidth: '75%',
                            padding: 'var(--space-3) var(--space-4)',
                            borderRadius: msg.role === 'user'
                                ? 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)'
                                : 'var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)',
                            background: msg.role === 'user'
                                ? 'linear-gradient(135deg, var(--primary-500), var(--primary-600))'
                                : 'var(--glass-bg)',
                            color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                            fontSize: 'var(--text-md)',
                            lineHeight: 1.6,
                            border: msg.role === 'assistant' ? '1px solid var(--border-subtle)' : 'none',
                        }}>
                            {msg.content}
                            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 'var(--space-1)', textAlign: 'right' }}>
                                {msg.time}
                            </div>
                        </div>
                        {msg.role === 'user' && (
                            <div className="avatar avatar-sm" style={{ flexShrink: 0 }}>
                                <User size={16} />
                            </div>
                        )}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
                <input
                    type="text"
                    className="input"
                    placeholder={t('chatbot.placeholder')}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    style={{ flex: 1 }}
                />
                <button className="btn btn-primary btn-icon" onClick={handleSend} disabled={!input.trim()}>
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
}
