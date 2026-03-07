import { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, MapPin, X, Loader2, CheckCircle2, Navigation } from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';
import { mapApi } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

type Step = 'idle' | 'confirm_location' | 'details' | 'submitting' | 'success';

interface SOSLocation {
  lat: number;
  lng: number;
}

export default function SOSCreationFlow() {
  const { t } = useLanguage();
  const { center, fetchPings } = useMapStore();
  const { isAuthenticated } = useAuthStore();
  const setAuthModal = useMapStore((s) => s.setAuthModal);

  const [step, setStep] = useState<Step>('idle');
  const [location, setLocation] = useState<SOSLocation | null>(null);
  const [details, setDetails] = useState('');
  const [sosType, setSosType] = useState<'SOS' | 'Supply' | 'Shelter'>('SOS');
  const [error, setError] = useState('');
  const [detectingGPS, setDetectingGPS] = useState(false);

  // Reset when closing
  const reset = useCallback(() => {
    setStep('idle');
    setLocation(null);
    setDetails('');
    setSosType('SOS');
    setError('');
    setDetectingGPS(false);
  }, []);

  // Step 1: Click SOS button → check auth, then go to confirm_location
  const handleSOSClick = useCallback(() => {
    if (!isAuthenticated) {
      setAuthModal('login');
      return;
    }
    // Default to current map center
    setLocation({ lat: center.lat, lng: center.lng });
    setStep('confirm_location');
  }, [isAuthenticated, setAuthModal, center]);

  // Auto-detect GPS
  const detectGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setError(t('sos.gpsNotSupported'));
      return;
    }
    setDetectingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setDetectingGPS(false);
      },
      () => {
        setError(t('sos.gpsError'));
        setDetectingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Step 3: Submit
  const handleSubmit = useCallback(async () => {
    if (!location) return;
    if (!details.trim() && sosType === 'SOS') {
      setError(t('sos.describeRequired'));
      return;
    }

    setStep('submitting');
    setError('');
    try {
      await mapApi.createPing({
        lat: location.lat,
        lng: location.lng,
        type: sosType,
        details: details.trim() || undefined,
      });
      setStep('success');
      // Refresh pings to show the new marker
      await fetchPings();
      // Auto-close after 2s
      setTimeout(reset, 2000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || t('sos.submitError'));
      setStep('details');
    }
  }, [location, details, sosType, fetchPings, reset]);

  // Close on Escape
  useEffect(() => {
    if (step === 'idle') return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') reset(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, reset]);

  // ─── Floating SOS Button (always visible) ───
  if (step === 'idle') {
    return (
      <div className="sos-float-container">
        <button className="btn btn-sos sos-float-btn animate-pulse-slow" onClick={handleSOSClick}>
          <AlertTriangle size={20} />
          <span>{t('sos.button') || 'Kêu cứu SOS'}</span>
        </button>
      </div>
    );
  }

  // ─── Success state ───
  if (step === 'success') {
    return (
      <div className="sos-panel glass-card animate-fade-in">
        <div style={{ textAlign: 'center', padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <CheckCircle2 size={48} style={{ color: 'var(--color-success)' }} />
          <h3>{t('sos.success') || 'Đã gửi thành công!'}</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {t('sos.successDesc') || 'Yêu cầu của bạn đã được ghim trên bản đồ.'}
          </p>
        </div>
      </div>
    );
  }

  // ─── Step 2: Confirm Location ───
  if (step === 'confirm_location') {
    return (
      <div className="sos-panel glass-card animate-slide-up">
        <div className="sos-panel-header">
          <h3><MapPin size={18} /> {t('sos.confirmLocation') || 'Xác nhận vị trí'}</h3>
          <button className="btn-icon" onClick={reset} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="sos-panel-body">
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-3)' }}>
            {t('sos.locationDesc') || 'Chọn vị trí của bạn trên bản đồ hoặc dùng GPS tự động.'}
          </p>

          {location && (
            <div className="sos-coords">
              <span>📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
            </div>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={detectGPS}
            disabled={detectingGPS}
            style={{ width: '100%', marginTop: 'var(--sp-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)' }}
          >
            {detectingGPS ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
            {detectingGPS ? t('sos.detectingGps') : t('sos.useGps')}
          </button>

          {error && <p className="text-danger" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--sp-2)' }}>{error}</p>}
        </div>

        <div className="sos-panel-footer">
          <button className="btn btn-ghost btn-sm" onClick={reset}>{t('common.cancel') || 'Hủy'}</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setError(''); setStep('details'); }}>
            {t('sos.next') || 'Tiếp theo'} →
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 3: Add Details + Submit ───
  return (
    <div className="sos-panel glass-card animate-slide-up">
      <div className="sos-panel-header">
        <h3><AlertTriangle size={18} /> {t('sos.addDetails') || 'Thêm chi tiết'}</h3>
        <button className="btn-icon" onClick={reset} aria-label="Close"><X size={16} /></button>
      </div>

      <div className="sos-panel-body">
        {/* Type selector */}
        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--sp-1)', display: 'block' }}>
          {t('sos.typeLabel') || 'Loại yêu cầu'}
        </label>
        <div className="sos-type-selector">
          {(['SOS', 'Supply', 'Shelter'] as const).map((type) => (
            <button
              key={type}
              className={`btn btn-sm ${sosType === type ? 'sos-type-active' : 'btn-ghost'}`}
              onClick={() => setSosType(type)}
              style={sosType === type ? {
                background: type === 'SOS' ? 'var(--color-danger)' : type === 'Supply' ? 'var(--color-success)' : 'var(--color-primary)',
                color: 'white',
              } : undefined}
            >
              {type === 'SOS' ? t('sos.typeNeedHelp') : type === 'Supply' ? t('sos.typeSupply') : t('sos.typeShelter')}
            </button>
          ))}
        </div>

        {/* Details textarea */}
        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginTop: 'var(--sp-3)', marginBottom: 'var(--sp-1)', display: 'block' }}>
          {t('sos.detailsLabel') || 'Mô tả chi tiết'}
          {sosType === 'SOS' && <span style={{ color: 'var(--color-danger)' }}> *</span>}
        </label>
        <textarea
          className="input"
          rows={3}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={sosType === 'SOS'
            ? t('sos.detailsPlaceholderSOS')
            : t('sos.detailsPlaceholderOther')
          }
          maxLength={500}
          style={{ resize: 'vertical', minHeight: 80 }}
        />
        <div style={{ textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          {details.length}/500
        </div>

        {error && <p className="text-danger" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--sp-1)' }}>{error}</p>}
      </div>

      <div className="sos-panel-footer">
        <button className="btn btn-ghost btn-sm" onClick={() => setStep('confirm_location')}>
          ← {t('common.back') || 'Quay lại'}
        </button>
        <button
          className={`btn btn-sm ${sosType === 'SOS' ? 'btn-sos' : 'btn-primary'}`}
          onClick={handleSubmit}
          disabled={step === 'submitting'}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}
        >
          {step === 'submitting' ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
          {step === 'submitting' ? (t('common.loading') || 'Đang gửi...') : (t('sos.submit') || 'Gửi yêu cầu')}
        </button>
      </div>
    </div>
  );
}
