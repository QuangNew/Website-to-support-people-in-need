import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';

// Providers
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';

// Layout
import MapShell from './components/layout/MapShell';

// Pages
import AdminPage from './pages/AdminPage';

// Stores
import { useAuthStore } from './stores/authStore';

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
  useEffect(() => { loadUser(); }, [loadUser]);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Routes>
              {/* Map is the root — everything is overlay */}
              <Route path="/*" element={<MapShell />} />

              {/* Admin has separate layout */}
              <Route path="/admin/*" element={<AdminPage />} />
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
        </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
