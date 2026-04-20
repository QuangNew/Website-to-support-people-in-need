import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useEffect, lazy, Suspense } from 'react';

// Providers
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';

// Layout
import MapShell from './components/layout/MapShell';
import PendingBar from './components/layout/PendingBar';

// Lazy-loaded pages (not needed on initial map load)
const AdminPage = lazy(() => import('./pages/AdminPage'));
const MyWallPage = lazy(() => import('./pages/MyWallPage'));

// Stores
import { useAuthStore } from './stores/authStore';
import { AUTH_EXPIRED_EVENT } from './services/api';

// Dev tools
import { Agentation } from 'agentation';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  // Verify stored token on startup — do NOT auto-set isAuthenticated from localStorage
  const loadUser = useAuthStore((s) => s.loadUser);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const handleAuthExpired = () => logout();

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, [logout]);

  useEffect(() => { void loadUser(); }, [loadUser]);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Routes>
              {/* Map is the root — everything is overlay */}
              <Route path="/*" element={<MapShell />} />

              {/* Lazy-loaded routes — only fetched when navigated to */}
              <Route path="/admin/*" element={<Suspense fallback={<div className="map-fallback"><div className="spinner spinner-lg" /></div>}><AdminPage /></Suspense>} />
              <Route path="/wall/:userId" element={<Suspense fallback={<div className="map-fallback"><div className="spinner spinner-lg" /></div>}><MyWallPage /></Suspense>} />
            </Routes>
          </BrowserRouter>

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-base)',
                backdropFilter: 'blur(20px)',
                boxShadow: 'var(--shadow-lg)',
              },
            }}
          />

          {/* Agentation — dev only */}
          {import.meta.env.DEV && <Agentation />}

          {/* Batch-write HUD — persists across all routes */}
          <PendingBar />
        </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
