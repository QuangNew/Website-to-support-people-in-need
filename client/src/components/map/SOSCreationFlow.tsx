import { useState, useCallback, useEffect, useRef, type ChangeEvent } from 'react';
import { AlertTriangle, MapPin, X, Loader2, CheckCircle2, Navigation, Phone, UserRound, ImagePlus, Trash2 } from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';
import { mapApi, socialApi } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { isInsideVietnam } from '../../utils/vietnamTerritory';

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

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** Trigger a short haptic vibration on mobile */
function haptic(ms = 50) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function isValidPhoneNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

export default function SOSCreationFlow() {
  const { t } = useLanguage();
  const { fetchPings, setFlyTo, setSosDraftLocation } = useMapStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role;
  const setAuthModal = useMapStore((s) => s.setAuthModal);

  const [step, setStep] = useState<Step>('idle');
  const [location, setLocation] = useState<SOSLocation | null>(null);
  const [details, setDetails] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [selectedTags, setSelectedTags] = useState<SOSTag[]>([]);
  const [error, setError] = useState('');
  const [contactNameError, setContactNameError] = useState('');
  const [contactPhoneError, setContactPhoneError] = useState('');
  const [medicalError, setMedicalError] = useState(false);
  const [imageError, setImageError] = useState('');
  const [conditionImageFile, setConditionImageFile] = useState<File | null>(null);
  const [conditionImagePreview, setConditionImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const revokePreviewUrl = useCallback((previewUrl: string | null) => {
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  }, []);

  const primeContactFields = useCallback(() => {
    setContactName(user?.fullName?.trim() ?? '');
    setContactPhone(user?.phoneNumber?.trim() ?? '');
    setContactNameError('');
    setContactPhoneError('');
  }, [user?.fullName, user?.phoneNumber]);

  // Reset when closing
  const reset = useCallback(() => {
    revokePreviewUrl(conditionImagePreview);
    setStep('idle');
    setLocation(null);
    setDetails('');
    setContactName('');
    setContactPhone('');
    setSelectedTags([]);
    setError('');
    setContactNameError('');
    setContactPhoneError('');
    setMedicalError(false);
    setImageError('');
    setConditionImageFile(null);
    setConditionImagePreview(null);
    setIsSubmitting(false);
    setIsUploadingImage(false);
    setSosDraftLocation(null);
  }, [conditionImagePreview, revokePreviewUrl, setSosDraftLocation]);

  useEffect(() => {
    return () => {
      revokePreviewUrl(conditionImagePreview);
    };
  }, [conditionImagePreview, revokePreviewUrl]);

  // GPS-only: SOS pings are placed at the user's actual GPS location, not map center.
  // This prevents accidentally placing an SOS in the wrong location.
  useEffect(() => {
    // Only update draft marker visual from GPS location, NOT from map center
    if (step === 'form' && location) {
      setSosDraftLocation({ lat: location.lat, lng: location.lng });
    }
  }, [step, location, setSosDraftLocation]);

  // Click SOS button → check auth, detect GPS (required — no map center fallback)
  const handleSOSClick = useCallback(() => {
    if (!isAuthenticated) {
      setAuthModal('login');
      return;
    }

    primeContactFields();
    setError('');
    setImageError('');

    // GPS is required for SOS — we need the user's real location
    // Strategy: get a fast low-accuracy fix first (~1s), then refine with high accuracy
    if (navigator.geolocation) {
      const applyLocation = (pos: GeolocationPosition) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        setFlyTo({ ...loc, zoom: 15 });
        setSosDraftLocation(loc);
        setStep('form');
        haptic(80);
      };

      // Fast low-accuracy fix — shows form quickly
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          applyLocation(pos);
          // Then silently refine with high accuracy in background
          navigator.geolocation.getCurrentPosition(
            (refinedPos) => {
              const loc = { lat: refinedPos.coords.latitude, lng: refinedPos.coords.longitude };
              setLocation(loc);
              setSosDraftLocation(loc);
            },
            () => { /* ignore — we already have a location */ },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        },
        () => {
          // Low-accuracy failed — try high accuracy as fallback
          navigator.geolocation.getCurrentPosition(
            applyLocation,
            () => {
              setError(t('sos.gpsError') || 'Không thể xác định vị trí GPS. Vui lòng bật GPS và thử lại.');
              setStep('form');
            },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        },
        { enableHighAccuracy: false, timeout: 3000 }
      );
    } else {
      setError(t('sos.gpsError') || 'Trình duyệt không hỗ trợ GPS.');
      setStep('form');
    }
  }, [isAuthenticated, primeContactFields, setAuthModal, setFlyTo, setSosDraftLocation, t]);

  // Toggle a tag
  const toggleTag = useCallback((tag: SOSTag) => {
    haptic();
    setMedicalError(false);
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  // Re-detect GPS — fast low-accuracy first, then refine
  const redetectGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    const apply = (pos: GeolocationPosition) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLocation(loc);
      setFlyTo({ ...loc, zoom: 15 });
      setSosDraftLocation(loc);
    };
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        apply(pos);
        navigator.geolocation.getCurrentPosition(
          (refined) => {
            const loc = { lat: refined.coords.latitude, lng: refined.coords.longitude };
            setLocation(loc);
            setSosDraftLocation(loc);
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000 }
        );
      },
      () => {
        navigator.geolocation.getCurrentPosition(apply,
          () => setError(t('sos.gpsError')),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      },
      { enableHighAccuracy: false, timeout: 3000 }
    );
  }, [setFlyTo, setSosDraftLocation, t]);

  const handleConditionImageSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError(t('sos.conditionImageInvalidType'));
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setImageError(t('sos.conditionImageTooLarge'));
      return;
    }

    revokePreviewUrl(conditionImagePreview);
    setConditionImageFile(file);
    setConditionImagePreview(URL.createObjectURL(file));
    setImageError('');
  }, [conditionImagePreview, revokePreviewUrl, t]);

  const clearConditionImage = useCallback(() => {
    revokePreviewUrl(conditionImagePreview);
    setConditionImageFile(null);
    setConditionImagePreview(null);
    setImageError('');
  }, [conditionImagePreview, revokePreviewUrl]);

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!location) return;

    const trimmedContactName = contactName.trim();
    const trimmedContactPhone = contactPhone.trim();
    const trimmedDetails = details.trim();
    let hasValidationError = false;

    setContactNameError('');
    setContactPhoneError('');
    setImageError('');

    // Validate: location must be within Vietnam territory
    if (!isInsideVietnam(location.lat, location.lng)) {
      setError(t('sos.outsideVietnam') || 'Vị trí nằm ngoài lãnh thổ Việt Nam. Vui lòng chọn vị trí trong lãnh thổ.');
      return;
    }

    if (!trimmedContactName) {
      setContactNameError(t('sos.contactNameRequired'));
      hasValidationError = true;
    }

    if (!trimmedContactPhone) {
      setContactPhoneError(t('sos.contactPhoneRequired'));
      hasValidationError = true;
    } else if (!isValidPhoneNumber(trimmedContactPhone)) {
      setContactPhoneError(t('sos.contactPhoneInvalid'));
      hasValidationError = true;
    }

    // Validate: if medical tag selected, textarea must not be empty
    if (selectedTags.includes('medical') && !trimmedDetails) {
      setMedicalError(true);
      textareaRef.current?.focus();
      hasValidationError = true;
    }

    if (hasValidationError) {
      return;
    }

    setIsSubmitting(true);
    setStep('submitting');
    setError('');
    haptic(100);

    try {
      // SOS flow should always create SOS pings; category drives the marker/icon.
      const type = 'SOS';
      const sosCategory = selectedTags.find((tag) => ['evacuate', 'food', 'medical', 'shelter', 'other'].includes(tag)) || 'other';

      let conditionImageUrl: string | undefined;
      if (conditionImageFile) {
        setIsUploadingImage(true);
        try {
          const uploadRes = await socialApi.uploadImage(conditionImageFile);
          conditionImageUrl = uploadRes.data.imageUrl;
        } catch {
          // Image upload failed — still create SOS without the image
          console.warn('Condition image upload failed, creating SOS without image');
        } finally {
          setIsUploadingImage(false);
        }
      }

      const pingRes = await mapApi.createPing({
        lat: location.lat,
        lng: location.lng,
        type,
        contactName: trimmedContactName,
        contactPhone: trimmedContactPhone,
        details: trimmedDetails || selectedTags.join(', ') || undefined,
        conditionImageUrl,
        sosCategory,
      });
      // Show spam warning if approaching limit
      const pingData = pingRes.data as Record<string, unknown>;
      if (pingData?.spamWarning) {
        const { default: toast } = await import('react-hot-toast');
        toast(String(pingData.spamWarning), { icon: '⚠️', duration: 6000 });
      }
      setStep('success');
      await fetchPings();
      setTimeout(reset, 2500);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || t('sos.submitError'));
      setStep('form');
    } finally {
      setIsSubmitting(false);
      setIsUploadingImage(false);
    }
  }, [conditionImageFile, contactName, contactPhone, details, fetchPings, location, reset, selectedTags, t]);

  // Escape to close
  useEffect(() => {
    if (step === 'idle') return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') reset(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, reset]);

  const showMedicalTextarea = selectedTags.includes('medical');
  const submitLabel = isUploadingImage ? t('sos.conditionImageUploading') : t('sos.submit');

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
        <p className="sos-intro-note">{t('sos.contactPrivacyHint')}</p>

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
            { key: 'food' as SOSTag, label: t('sos.tagFood') || '🍚 Thức ăn', adminOnly: true },
            { key: 'medical' as SOSTag, label: t('sos.tagMedical') || '💊 Y tế' },
            { key: 'shelter' as SOSTag, label: t('sos.tagShelter') || '🏠 Nơi trú', adminOnly: true },
            { key: 'other' as SOSTag, label: t('sos.tagOther') || '📋 Khác' },
          ] as { key: SOSTag; label: string; adminOnly?: boolean }[])
          .filter(({ adminOnly }) => !adminOnly || userRole === 'Admin')
          .map(({ key, label }) => {
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

        <div className="sos-contact-card">
          <div className="sos-contact-card-head">
            <label className="sos-section-label">
              {t('sos.contactSectionTitle')}
            </label>
            <p className="sos-section-help">{t('sos.contactSectionHint')}</p>
          </div>

          <div className="sos-contact-grid">
            <label className="sos-field">
              <span className="sos-field-label">
                {t('sos.contactNameLabel')} <span className="sos-required">*</span>
              </span>
              <span className={`sos-input-wrap ${contactNameError ? 'sos-input-wrap--error' : ''}`}>
                <UserRound size={16} className="sos-input-icon" />
                <input
                  className="sos-input"
                  value={contactName}
                  onChange={(event) => {
                    setContactName(event.target.value);
                    setContactNameError('');
                  }}
                  placeholder={t('sos.contactNamePlaceholder')}
                  maxLength={200}
                />
              </span>
              {contactNameError && <p className="sos-error-text">{contactNameError}</p>}
            </label>

            <label className="sos-field">
              <span className="sos-field-label">
                {t('sos.contactPhoneLabel')} <span className="sos-required">*</span>
              </span>
              <span className={`sos-input-wrap ${contactPhoneError ? 'sos-input-wrap--error' : ''}`}>
                <Phone size={16} className="sos-input-icon" />
                <input
                  className="sos-input"
                  type="tel"
                  inputMode="tel"
                  value={contactPhone}
                  onChange={(event) => {
                    setContactPhone(event.target.value);
                    setContactPhoneError('');
                  }}
                  placeholder={t('sos.contactPhonePlaceholder')}
                  maxLength={32}
                />
              </span>
              {contactPhoneError && <p className="sos-error-text">{contactPhoneError}</p>}
            </label>
          </div>
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

        <div className="sos-media-section">
          <div className="sos-media-section-head">
            <label className="sos-section-label">{t('sos.conditionImageLabel')}</label>
            <p className="sos-section-help">{t('sos.conditionImageHint')}</p>
          </div>

          {!conditionImagePreview && (
            <label className="sos-image-picker">
              <ImagePlus size={18} />
              <span className="sos-image-picker-copy">
                <strong>{t('sos.conditionImageAdd')}</strong>
                <span>{t('sos.conditionImageFormats')}</span>
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={handleConditionImageSelect}
              />
            </label>
          )}

          {conditionImagePreview && (
            <>
              <div className="sos-image-preview-card">
                <img src={conditionImagePreview} alt={t('sos.conditionImagePreviewAlt')} />
              </div>
              <div className="sos-image-actions">
                <label className="sos-image-picker sos-image-picker--secondary">
                  <ImagePlus size={16} />
                  <span>{t('sos.conditionImageChange')}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={handleConditionImageSelect}
                  />
                </label>
                <button type="button" className="btn btn-ghost btn-sm sos-image-remove" onClick={clearConditionImage}>
                  <Trash2 size={14} />
                  <span>{t('sos.conditionImageRemove')}</span>
                </button>
              </div>
            </>
          )}

          {imageError && <p className="sos-error-text">{imageError}</p>}
        </div>

        {error && <p className="sos-error-text" style={{ marginTop: 8 }}>{error}</p>}
      </div>

      {/* Sticky footer */}
      <div className="sos-panel-footer sos-panel-footer--sticky">
        <button
          className="sos-submit-btn"
          onClick={handleSubmit}
          disabled={isSubmitting || isUploadingImage || !location}
        >
          {isSubmitting || isUploadingImage ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>{isUploadingImage ? submitLabel : t('sos.submitting')}</span>
            </>
          ) : (
            <>
              <AlertTriangle size={20} />
              <span>{submitLabel}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
