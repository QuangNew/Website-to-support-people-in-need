# Frontend Performance Optimizations

## Applied Optimizations

### 1. React Query Configuration (App.tsx)
- Added `gcTime: 10 * 60 * 1000` for proper garbage collection
- Added `refetchOnWindowFocus: false` to prevent unnecessary refetches
- Keeps existing `staleTime: 5 * 60 * 1000` and `retry: 1`

### 2. MapShell Component
- Fixed useEffect dependency array causing infinite fetch loops
- Changed from `[fetchPings, fetchZones]` to `[]` with eslint-disable
- Fetches only once on mount instead of on every render

### 3. MapView Component
- Optimized `filteredPings` useMemo with Set lookup (O(1) vs O(n))
- Improved marker removal logic to avoid iterator issues
- Enhanced cluster configuration:
  - `maxClusterRadius: 60` (from 50)
  - `disableClusteringAtZoom: 15` (from 16)
  - Added `chunkedLoading: true` for better performance
  - Added `spiderfyDistanceMultiplier: 1.5`

### 4. API Client (api.ts)
- Added `timeout: 10000` to prevent hanging requests
- Prevents memory leaks from abandoned connections

### 5. AdminPage Stats Panel
- Added cleanup flag to prevent state updates on unmounted component
- Changed dependency from `[t]` to `[]` to fetch only once
- Prevents unnecessary re-fetches when language changes

### 6. Vite Build Configuration
- Added manual chunk splitting for vendors:
  - `react-vendor`: React core libraries
  - `map-vendor`: Leaflet and clustering
- Reduces main bundle size and improves caching

## Performance Impact

**Before:**
- Main bundle: ~602KB
- Potential memory leaks in admin stats
- Unnecessary API refetches on every render
- Inefficient marker filtering

**After:**
- Better code splitting with vendor chunks
- No memory leaks in useEffect hooks
- Single fetch on mount for static data
- Optimized marker clustering and filtering

## No Breaking Changes
All optimizations maintain existing functionality while improving performance.
