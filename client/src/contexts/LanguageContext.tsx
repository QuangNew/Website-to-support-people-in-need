import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react';
import vi from '../i18n/vi.json';
import en from '../i18n/en.json';

export type Locale = 'vi' | 'en';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TranslationDict = Record<string, any>;

const translations: Record<Locale, TranslationDict> = { vi: vi as TranslationDict, en: en as TranslationDict };

interface LanguageContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    toggleLocale: () => void;
    t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getInitialLocale(): Locale {
    if (typeof window === 'undefined') return 'vi';
    const stored = localStorage.getItem('rc-locale') as Locale | null;
    if (stored === 'vi' || stored === 'en') return stored;
    return 'vi';
}

function getNestedValue(obj: TranslationDict, path: string, params?: Record<string, string | number>): string {
    const keys = path.split('.');
    let current: unknown = obj;
    for (const key of keys) {
        if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
            current = (current as Record<string, unknown>)[key];
        } else {
            return path; // fallback to key
        }
    }
    if (typeof current !== 'string') return path;

    // Simple {{variable}} interpolation
    if (params) {
        return current.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? `{{${k}}}`));
    }
    return current;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

    const setLocale = useCallback((l: Locale) => {
        setLocaleState(l);
        localStorage.setItem('rc-locale', l);
        document.documentElement.setAttribute('lang', l);
    }, []);

    const toggleLocale = useCallback(() => {
        setLocale(locale === 'vi' ? 'en' : 'vi');
    }, [locale, setLocale]);

    const t = useCallback((key: string, params?: Record<string, string | number>): string => {
        return getNestedValue(translations[locale], key, params);
    }, [locale]);

    const value = useMemo(() => ({
        locale,
        setLocale,
        toggleLocale,
        t,
    }), [locale, setLocale, toggleLocale, t]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
    return ctx;
}
