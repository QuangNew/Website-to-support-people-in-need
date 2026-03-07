import { useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, MapPin, X, Loader2, CheckCircle2, Navigation } from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';
import { mapApi } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

type Step = 'idle' | 'form' | 'submitting' | 'success';

type SOSTag = 'evacuate' | 'food' | 'medical' | 'shelter' | 'other';

interface SOSLocation {
  lat: number;
  lng: number;
}

const TAG_COLORS: Record<SOSTag, { bg: string; border: string; text: string }> = {
  evacuate: { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', text: '#ef4444' },
  food: { bg: 'rgba(34,197,94,0.15)', border: '#22c55e', text: '#22c55e' },
  medical: { bg: 'rgba(59,130,246,0.15)', border: '#3b82f6', text: '#3b82f6' },
  shelter: { bg: 'rgba(249,115,22,0.15)', border: '#f97316', text: '#f97316' },
  other: { bg: 'rgba(156,163,175,0.15)', border: '#9ca3af', text: '#9ca3af' },
};

/** Trigger a short haptic vibration on mobile */
function haptic(ms = 50) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

export default function SOSCreationFlow() {
  const { t } = useLanguage();
  const { center, fetchPings, setFlyTo, setSosDraftLocation } = useMapStore();
  const { isAuthenticated } = useAuthStore();
  const setAuthModal = useMapStore((s) => s.setAuthModal);

  const [step, setStep] = useState<Step>('idle');
  const [location, setLocation] = useState<SOSLocation | null>(null);
  const [details, setDetails] = useState('');
  const [selectedTags, setSelectedTags] = useState<SOSTag[]>([]);
  const [error, setError] = useState('');
  const [medicalError, setMedicalError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset when closing
  const reset = useCallback(() => {
    setStep('idle');
    setLocation(null);
    setDetails('');
    setSelectedTags([]);
    setError('');
    setMedicalError(false);
    setIsSubmitting(false);
    setSosDraftLocation(null);
  }, [setSosDraftLocation]);

  // Sync location with map center when user pans the map (real-time update)
  useEffect(() => {
    if (step === 'form' && center) {
      setLocation({ lat: center.lat, lng: center.lng });
      setSosDraftLocation({ lat: center.lat, lng: center.lng });
    }
  }, [step, center, setSosDraftLocation]);

  // Click SOS button → check auth, detect GPS, open form
  const handleSOSClick = useCallback(() => {
    if (!isAuthenticated) {
      setAuthModal('login');
      return;
    }

    // Try GPS first, fallback to map center
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(loc);
          setFlyTo({ ...loc, zoom: 15 });
          setSosDraftLocation(loc);
        },
        () => {
          setLocation({ lat: center.lat, lng: center.lng });
          setSosDraftLocation({ lat: center.lat, lng: center.lng });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setLocation({ lat: center.lat, lng: center.lng });
      setSosDraftLocation({ lat: center.lat, lng: center.lng });
    }

    setStep('form');
    haptic(80);
  }, [isAuthenticated, setAuthModal, center, setFlyTo]);

  // Toggle a tag
  const toggleTag = useCallback((tag: SOSTag) => {
    haptic();
    setMedicalError(false);
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  // Re-detect GPS
  const redetectGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        setFlyTo({ ...loc, zoom: 15 });
        setSosDraftLocation(loc);
      },
      () => {
        setError(t('sos.gpsError'));
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [setFlyTo, setSosDraftLocation, t]);

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!location) return;

    // Validate: if medical tag selected, textarea must not be empty
    if (selectedTags.includes('medical') && !details.trim()) {
      setMedicalError(true);
      textareaRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setStep('submitting');
    setError('');
    haptic(100);

    try {
      const type = selectedTags.includes('shelter') ? 'Shelter'
        : selectedTags.includes('food') ? 'Supply'
        : 'SOS';

      await mapApi.createPing({
        lat: location.lat,
        lng: location.lng,
        type,
        details: details.trim() || selectedTags.join(', ') || undefined,
      });
      setStep('success');
      await fetchPings();
      setTimeout(reset, 2500);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || t('sos.submitError'));
      setStep('form');
      setIsSubmitting(false);
    }
  }, [location, details, selectedTags, fetchPings, reset, t]);

  // Escape to close
  useEffect(() => {
    if (step === 'idle') return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') reset(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, reset]);

  const showMedicalTextarea = selectedTags.includes('medical');

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
      <div className="sos-panel sos-panel--v2 animate-fade-in">
        <div className="sos-success-content">
          <CheckCircle2 size={48} style={{ color: 'var(--success-500)' }} />
          <h3>{t('sos.success') || 'Đã gửi thành công!'}</h3>
          <p>{t('sos.successDesc') || 'Yêu cầu của bạn đã được ghim trên bản đồ.'}</p>
        </div>
      </div>
    );
  }

  // ─── Main SOS Form (single-page) ───
  return (
    <div className="sos-panel sos-panel--v2 animate-slide-up">
      {/* Drag handle (mobile only, hidden on desktop via CSS) */}
      <div className="sos-drag-handle"><div className="sos-drag-pill" /></div>

      {/* Header */}
      <div className="sos-panel-header">
        <h3><AlertTriangle size={18} /> {t('sos.addDetails') || 'Kêu cứu SOS'}</h3>
        <button className="btn-icon" onClick={reset} aria-label="Close"><X size={18} /></button>
      </div>

      {/* Scrollable body */}
      <div className="sos-panel-body">
        {/* Live location bar */}
        <button type="button" className="sos-location-bar" onClick={redetectGPS}>
          <MapPin size={16} className="sos-location-icon" />
          <span className="sos-location-text">
            {location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : t('sos.detectingGps')}
          </span>
          <Navigation size={14} className="sos-location-gps" />
        </button>

        {/* Tags */}
        <label className="sos-section-label">
          {t('sos.typeLabel') || 'Bạn cần gì?'}
        </label>
        <div className="sos-tags-grid">
          {([
            { key: 'evacuate' as SOSTag, label: t('sos.tagEvacuate') || '🚨 Sơ tán' },
            { key: 'food' as SOSTag, label: t('sos.tagFood') || '🍚 Thức ăn' },
            { key: 'medical' as SOSTag, label: t('sos.tagMedical') || '💊 Y tế' },
            { key: 'shelter' as SOSTag, label: t('sos.tagShelter') || '🏠 Nơi trú' },
            { key: 'other' as SOSTag, label: t('sos.tagOther') || '📋 Khác' },
          ]).map(({ key, label }) => {
            const isActive = selectedTags.includes(key);
            const colors = TAG_COLORS[key];
            return (
              <button
                key={key}
                className={`sos-tag-btn ${isActive ? 'sos-tag-btn--active' : ''}`}
                onClick={() => toggleTag(key)}
                style={isActive ? {
                  background: colors.bg,
                  borderColor: colors.border,
                  color: colors.text,
                } : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Smart Textarea – always visible, adapts to selected tags */}
        <div className="sos-details-section">
          <label className="sos-section-label">
            {showMedicalTextarea
              ? <>{t('sos.detailsLabelRequired') || 'Mô tả chi tiết'} <span className="sos-required">*</span></>
              : (t('sos.detailsLabelOptional') || 'Mô tả chi tiết (Không bắt buộc)')}
          </label>
          <textarea
            ref={textareaRef}
            className={`sos-textarea ${medicalError ? 'sos-textarea--error animate-shake' : ''}`}
            rows={3}
            value={details}
            onChange={(e) => { setDetails(e.target.value); setMedicalError(false); }}
            placeholder={showMedicalTextarea
              ? (t('sos.smartPlaceholderMedical') || 'BẮT BUỘC: Ghi rõ loại thuốc, tình trạng bệnh (VD: Đang sốt cao, cần Insulin...).')
              : (t('sos.smartPlaceholderDefault') || 'Ví dụ: Nhà có 2 trẻ em cần sữa, hẻm nhỏ xuồng to không vào được...')}
            maxLength={500}
          />
          {medicalError && (
            <p className="sos-error-text">{t('sos.medicalRequired') || 'Vui lòng nhập thông tin thuốc/bệnh lý'}</p>
          )}
          <div className="sos-char-count">{details.length}/500</div>
        </div>

        {error && <p className="sos-error-text" style={{ marginTop: 8 }}>{error}</p>}
      </div>

      {/* Sticky footer */}
      <div className="sos-panel-footer sos-panel-footer--sticky">
        <button
          className="sos-submit-btn"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>{t('sos.submitting') || 'Đang xử lý...'}</span>
            </>
          ) : (
            <>
              <AlertTriangle size={20} />
              <span>{t('sos.submit') || 'Gửi yêu cầu'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
