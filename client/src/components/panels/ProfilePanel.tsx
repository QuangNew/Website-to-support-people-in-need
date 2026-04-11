import { useState, useRef } from 'react';
import {
  Mail,
  Shield,
  Calendar,
  Edit3,
  User,
  Save,
  X,
  Camera,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useLanguage } from '../../contexts/LanguageContext';
import { authApi } from '../../services/api';

const VERIFICATION_CONFIG: Record<string, { color: string; labelVi: string; labelEn: string }> = {
  Verified: { color: 'var(--success-500)', labelVi: 'Đã xác minh', labelEn: 'Verified' },
  Pending: { color: 'var(--warning-500)', labelVi: 'Đang chờ duyệt', labelEn: 'Pending' },
  Rejected: { color: 'var(--danger-500)', labelVi: 'Bị từ chối', labelEn: 'Rejected' },
  None: { color: 'var(--text-muted)', labelVi: 'Chưa xác minh', labelEn: 'Not verified' },
};

export default function ProfilePanel() {
  const { user, setUser } = useAuthStore();
  const { t, locale } = useLanguage();

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const verification = VERIFICATION_CONFIG[user.verificationStatus] || VERIFICATION_CONFIG.None;
  const isVi = locale === 'vi';

  // ─── Edit Profile ───
  const startEdit = () => {
    setEditName(user.fullName);
    setIsEditing(true);
    setEditError('');
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditError('');
  };

  const saveProfile = async () => {
    if (!editName.trim()) return;
    setEditLoading(true);
    setEditError('');
    try {
      const res = await authApi.updateProfile({ fullName: editName.trim() });
      setUser(res.data);
      setIsEditing(false);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setEditError(axiosErr?.response?.data?.message || (isVi ? 'Cập nhật thất bại' : 'Update failed'));
    } finally {
      setEditLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) return;
    if (file.size > 1024 * 1024) return; // 1MB limit for avatars

    try {
      const url = await authApi.uploadAvatar(file);
      if (url) {
        const res = await authApi.updateProfile({ avatarUrl: url });
        setUser(res.data);
      }
    } catch {
      // ignore
    } finally {
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  return (
    <div className="panel-content profile-panel">
      <div className="panel-header">
        <h2 className="panel-title">{t('panel.profile')}</h2>
      </div>

      {/* Profile card */}
      <div className="profile-card glass-card">
        <div className="profile-avatar-section">
          <div className="avatar avatar-lg profile-avatar-clickable" onClick={() => avatarInputRef.current?.click()}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.fullName} />
            ) : (
              <User size={32} />
            )}
            <div className="profile-avatar-overlay">
              <Camera size={16} color="white" />
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
          </div>
          <div className="profile-name-section">
            {isEditing ? (
              <div className="profile-edit-name">
                <input
                  className="input input-sm"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={isVi ? 'Họ và tên' : 'Full name'}
                  autoFocus
                />
                <div className="profile-edit-actions">
                  <button className="btn btn-primary btn-sm" onClick={saveProfile} disabled={editLoading}>
                    <Save size={14} />
                    {editLoading ? '...' : (isVi ? 'Lưu' : 'Save')}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>
                    <X size={14} />
                  </button>
                </div>
                {editError && <span className="text-error text-xs">{editError}</span>}
              </div>
            ) : (
              <>
                <h3 className="profile-name">{user.fullName}</h3>
                <span className="profile-username">@{user.userName}</span>
              </>
            )}
          </div>
        </div>

        {/* Info items */}
        <div className="profile-info">
          <div className="profile-info-item">
            <Mail size={16} />
            <div>
              <span className="profile-info-label">{t('profile.email')}</span>
              <span className="profile-info-value">{user.email}</span>
            </div>
          </div>

          <div className="profile-info-item">
            <Shield size={16} />
            <div>
              <span className="profile-info-label">{t('profile.role')}</span>
              <span className="profile-info-value badge badge-primary">{t(`profile.roles.${user.role}`) || user.role}</span>
            </div>
          </div>

          <div className="profile-info-item">
            <Shield size={16} style={{ color: verification.color }} />
            <div>
              <span className="profile-info-label">{t('profile.status')}</span>
              <span className="profile-info-value" style={{ color: verification.color }}>
                {isVi ? verification.labelVi : verification.labelEn}
              </span>
            </div>
          </div>

          {user.createdAt && (
            <div className="profile-info-item">
              <Calendar size={16} />
              <div>
                <span className="profile-info-label">{t('profile.joinDate')}</span>
                <span className="profile-info-value">
                  {new Date(user.createdAt).toLocaleDateString(isVi ? 'vi-VN' : 'en-US')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Edit Profile Button */}
        {!isEditing && (
          <div className="profile-actions">
            <button className="btn btn-secondary btn-full" onClick={startEdit}>
              <Edit3 size={16} />
              {t('profile.editProfile')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
