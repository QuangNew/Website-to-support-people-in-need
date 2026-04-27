import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, authApi, getImageUrl } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuthStore } from '../../stores/authStore';
import { useMapStore } from '../../stores/mapStore';
import { useMessageStore } from '../../stores/messageStore';
import type { AdminUserDetail } from '../../types/admin';
import { toExternalHref, toTelegramHref } from '../../utils/contactLinks';

interface BasicUserProfile {
  id: string;
  userName: string;
  fullName: string;
  role: string;
  verificationStatus: string;
  avatarUrl?: string;
  createdAt: string;
}

interface UserPreviewModalProps {
  isOpen: boolean;
  userId: string;
  fallbackName: string;
  fallbackAvatar?: string;
  onClose: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function translateRole(t: (key: string) => string, role: string): string {
  const key = `profile.roles.${role}`;
  const translated = t(key);
  return translated === key ? role : translated;
}

function VerificationImageGallery({
  imageUrls,
  emptyLabel,
  altPrefix,
}: {
  imageUrls: string[];
  emptyLabel: string;
  altPrefix: string;
}) {
  if (imageUrls.length === 0) {
    return <div className="admin-verification-empty-media">{emptyLabel}</div>;
  }

  return (
    <div className="admin-verification-gallery">
      {imageUrls.map((imageUrl, index) => (
        <a
          key={`${imageUrl}-${index}`}
          href={getImageUrl(imageUrl)}
          target="_blank"
          rel="noreferrer"
          className="admin-verification-gallery__item"
        >
          <img src={getImageUrl(imageUrl)} alt={`${altPrefix} ${index + 1}`} />
        </a>
      ))}
    </div>
  );
}

export default function UserPreviewModal({
  isOpen,
  userId,
  fallbackName,
  fallbackAvatar,
  onClose,
}: UserPreviewModalProps) {
  const { t } = useLanguage();
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role === 'Admin';
  const setAuthModal = useMapStore((state) => state.setAuthModal);
  const startConversation = useMessageStore((state) => state.startConversation);
  const setActiveConversation = useMessageStore((state) => state.setActiveConversation);
  const fetchMessages = useMessageStore((state) => state.fetchMessages);

  const [basicProfile, setBasicProfile] = useState<BasicUserProfile | null>(null);
  const [adminDetail, setAdminDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [contacting, setContacting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !userId) return;

    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);
      setLoadError(false);
      setBasicProfile(null);
      setAdminDetail(null);

      try {
        if (isAdmin) {
          const response = await adminApi.getUserDetail(userId);
          if (cancelled) return;

          const detail = response.data as AdminUserDetail;
          setAdminDetail(detail);
          setBasicProfile({
            id: detail.id,
            userName: detail.userName,
            fullName: detail.fullName,
            role: detail.role,
            verificationStatus: detail.verificationStatus,
            avatarUrl: detail.avatarUrl,
            createdAt: detail.createdAt,
          });
          return;
        }

        const response = await authApi.getBasicProfile(userId);
        if (cancelled) return;
        setBasicProfile(response.data as BasicUserProfile);
      } catch {
        if (!cancelled) {
          setLoadError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, isOpen, userId]);

  if (!isOpen || !userId || typeof document === 'undefined') {
    return null;
  }

  const profile = basicProfile;
  const displayName = profile?.fullName || fallbackName;
  const displayUserName = profile?.userName || '';
  const displayAvatar = profile?.avatarUrl || fallbackAvatar;
  const showContactAction = currentUser?.id !== userId;
  const canUseMessages = currentUser?.role === 'Admin' || currentUser?.verificationStatus === 'Approved';

  const handleContact = async () => {
    if (!showContactAction) return;

    if (!currentUser) {
      setAuthModal('login');
      onClose();
      return;
    }

    if (!canUseMessages) {
      useMapStore.setState({ activePanel: 'messages' });
      toast.error(t('messaging.onlyVerified'));
      onClose();
      return;
    }

    setContacting(true);
    try {
      const conversationId = await startConversation(userId);
      setActiveConversation(conversationId);
      await fetchMessages(conversationId);
      useMapStore.setState({ activePanel: 'messages' });
      onClose();
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: { message?: string } } };
      const message = axiosError.response?.data?.message;

      if (axiosError.response?.status === 403) {
        toast.error(message || t('messaging.onlyVerified'));
      } else {
        toast.error(message || t('messaging.blocked'));
      }
    } finally {
      setContacting(false);
    }
  };

  return createPortal(
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="user-preview-modal glass-card animate-fade-in" onClick={(event) => event.stopPropagation()}>
        <div className="user-preview-modal__header">
          <div className="user-preview-modal__identity">
            <div className="user-preview-modal__avatar">
              {displayAvatar ? (
                <img src={getImageUrl(displayAvatar)} alt="" />
              ) : (
                <span>{getInitials(displayName)}</span>
              )}
            </div>
            <div>
              <h4>{displayName}</h4>
              <p>{displayUserName ? `@${displayUserName}` : ''}</p>
            </div>
          </div>

          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="admin-loading"><span className="spinner" /></div>
        ) : (
          <div className="user-preview-modal__body">
            {loadError && !profile ? (
              <div className="admin-empty admin-empty--inline">{t('common.error')}</div>
            ) : (
              <>
                {showContactAction && (
                  <div className="user-preview-modal__actions admin-user-profile-actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleContact()} disabled={contacting}>
                      <MessageSquare size={15} />
                      {contacting ? t('common.loading') : t('admin.contactThisUser')}
                    </button>
                  </div>
                )}

                <div className="admin-user-summary-grid">
                  <div className="admin-verification-card">
                    <span className="admin-verification-card__label">{t('profile.role')}</span>
                    <strong>{profile ? translateRole(t, profile.role) : '-'}</strong>
                  </div>
                  <div className="admin-verification-card">
                    <span className="admin-verification-card__label">{t('profile.status')}</span>
                    <strong>{profile?.verificationStatus || '-'}</strong>
                  </div>
                  <div className="admin-verification-card">
                    <span className="admin-verification-card__label">{t('profile.joinDate')}</span>
                    <strong>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '-'}</strong>
                  </div>
                  {isAdmin && adminDetail?.address && (
                    <div className="admin-verification-card admin-verification-card--wide">
                      <span className="admin-verification-card__label">{t('admin.addressLabel')}</span>
                      <strong>{adminDetail.address}</strong>
                    </div>
                  )}
                </div>

                {isAdmin && adminDetail && (
                  <>
                    <div className="admin-user-history">
                      <div className="admin-user-history__header">
                        <div>
                          <h5>{t('admin.contactInfo')}</h5>
                          <p>{adminDetail.email}</p>
                        </div>
                      </div>

                      <div className="admin-user-summary-grid">
                        <div className="admin-verification-card">
                          <span className="admin-verification-card__label">{t('profile.email')}</span>
                          <strong>
                            <a className="user-preview-link" href={`mailto:${adminDetail.email}`}>
                              {adminDetail.email}
                            </a>
                          </strong>
                        </div>
                        <div className="admin-verification-card">
                          <span className="admin-verification-card__label">{t('admin.phoneNumber')}</span>
                          <strong>
                            {adminDetail.phoneNumber ? (
                              <a className="user-preview-link" href={`tel:${adminDetail.phoneNumber}`}>
                                {adminDetail.phoneNumber}
                              </a>
                            ) : '-'}
                          </strong>
                        </div>
                        <div className="admin-verification-card">
                          <span className="admin-verification-card__label">{t('profile.facebookUrl')}</span>
                          <strong>
                            {adminDetail.facebookUrl ? (
                              <a className="user-preview-link" href={toExternalHref(adminDetail.facebookUrl)} target="_blank" rel="noreferrer">
                                {adminDetail.facebookUrl}
                              </a>
                            ) : '-'}
                          </strong>
                        </div>
                        <div className="admin-verification-card">
                          <span className="admin-verification-card__label">{t('profile.telegramUrl')}</span>
                          <strong>
                            {adminDetail.telegramUrl ? (
                              <a className="user-preview-link" href={toTelegramHref(adminDetail.telegramUrl)} target="_blank" rel="noreferrer">
                                {adminDetail.telegramUrl}
                              </a>
                            ) : '-'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="admin-user-stats-row">
                      <div className="admin-user-stat-pill">
                        <span>{t('admin.posts')}</span>
                        <strong>{adminDetail.postCount}</strong>
                      </div>
                      <div className="admin-user-stat-pill">
                        <span>{t('admin.commentsCount')}</span>
                        <strong>{adminDetail.commentCount}</strong>
                      </div>
                      <div className="admin-user-stat-pill">
                        <span>{t('admin.pingsCount')}</span>
                        <strong>{adminDetail.pingCount}</strong>
                      </div>
                    </div>

                    <div className="admin-user-history">
                      <div className="admin-user-history__header">
                        <div>
                          <h5>{t('admin.verificationHistory')}</h5>
                          <p>{adminDetail.verificationHistory.length} {t('admin.historyEntries')}</p>
                        </div>
                      </div>

                      {adminDetail.verificationHistory.length === 0 ? (
                        <div className="admin-empty admin-empty--inline">{t('admin.noVerificationHistory')}</div>
                      ) : (
                        <div className="admin-history-list">
                          {adminDetail.verificationHistory.map((entry) => (
                            <div key={entry.id} className="admin-history-item">
                              <div className="admin-history-item__head">
                                <div>
                                  <span className={`admin-badge admin-badge--${entry.status.toLowerCase()}`}>{entry.status}</span>
                                  <strong>{entry.requestedRole}</strong>
                                </div>
                                <span>{new Date(entry.submittedAt).toLocaleString()}</span>
                              </div>

                              <div className="admin-history-item__meta">
                                <span>{t('admin.submittedAt')}: {new Date(entry.submittedAt).toLocaleString()}</span>
                                <span>{t('admin.reviewedAt')}: {entry.reviewedAt ? new Date(entry.reviewedAt).toLocaleString() : '-'}</span>
                                <span>{t('admin.reviewedBy')}: {entry.reviewedByAdminName || '-'}</span>
                              </div>

                              <div className="admin-history-item__body">
                                <div className="admin-verification-detail__grid admin-verification-detail__grid--history">
                                  <div className="admin-verification-card">
                                    <span className="admin-verification-card__label">{t('admin.phoneNumber')}</span>
                                    <strong>{entry.phoneNumber || '-'}</strong>
                                  </div>
                                  <div className="admin-verification-card admin-verification-card--wide">
                                    <span className="admin-verification-card__label">{t('admin.addressLabel')}</span>
                                    <strong>{entry.address || '-'}</strong>
                                  </div>
                                  <div className="admin-verification-card admin-verification-card--wide">
                                    <span className="admin-verification-card__label">{t('admin.reason')}</span>
                                    <p>{entry.verificationReason || '-'}</p>
                                  </div>
                                </div>

                                <VerificationImageGallery
                                  imageUrls={entry.verificationImageUrls}
                                  emptyLabel={t('admin.noVerificationImages')}
                                  altPrefix={adminDetail.fullName}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}