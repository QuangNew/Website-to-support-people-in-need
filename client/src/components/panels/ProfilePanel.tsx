import { useState } from 'react';
import {
  Mail,
  Shield,
  Calendar,
  Edit3,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  Save,
  X,
  Send,
  UserCheck,
  Heart,
  HandHeart,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useLanguage } from '../../contexts/LanguageContext';
import { authApi } from '../../services/api';

const VERIFICATION_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; labelVi: string; labelEn: string }> = {
  Verified: { icon: CheckCircle, color: 'var(--success-500)', labelVi: 'Đã xác minh', labelEn: 'Verified' },
  Pending: { icon: Clock, color: 'var(--warning-500)', labelVi: 'Đang chờ duyệt', labelEn: 'Pending' },
  Rejected: { icon: AlertCircle, color: 'var(--danger-500)', labelVi: 'Bị từ chối', labelEn: 'Rejected' },
  None: { icon: AlertCircle, color: 'var(--text-muted)', labelVi: 'Chưa xác minh', labelEn: 'Not verified' },
};

const ROLE_OPTIONS = [
  { value: 'PersonInNeed', labelVi: 'Người cần hỗ trợ', labelEn: 'Person in Need', icon: Heart, desc_vi: 'Bạn đang cần được hỗ trợ', desc_en: 'You need assistance' },
  { value: 'Sponsor', labelVi: 'Nhà tài trợ', labelEn: 'Sponsor', icon: HandHeart, desc_vi: 'Bạn muốn đóng góp, tài trợ', desc_en: 'You want to donate/sponsor' },
  { value: 'Volunteer', labelVi: 'Tình nguyện viên', labelEn: 'Volunteer', icon: Users, desc_vi: 'Bạn muốn tham gia hỗ trợ cộng đồng', desc_en: 'You want to volunteer' },
];

export default function ProfilePanel() {
  const { user, setUser } = useAuthStore();
  const { t, locale } = useLanguage();

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Verification state
  const [selectedRole, setSelectedRole] = useState('');
  const [verifyReason, setVerifyReason] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!user) return null;

  const verification = VERIFICATION_CONFIG[user.verificationStatus] || VERIFICATION_CONFIG.None;
  const VerifIcon = verification.icon;
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

  // ─── Verification ───
  const canVerify = user.verificationStatus === 'None' || user.verificationStatus === 'Rejected';

  const submitVerification = async () => {
    if (!selectedRole) return;
    setVerifyLoading(true);
    setVerifyMessage(null);
    try {
      await authApi.submitVerification({ requestedRole: selectedRole, reason: verifyReason || undefined });
      setVerifyMessage({
        type: 'success',
        text: isVi ? 'Yêu cầu xác minh đã được gửi! Admin sẽ duyệt sớm nhất.' : 'Verification request submitted! Admin will review shortly.',
      });
      // Update local user state
      setUser({ ...user, verificationStatus: 'Pending' });
      setSelectedRole('');
      setVerifyReason('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setVerifyMessage({
        type: 'error',
        text: axiosErr?.response?.data?.message || (isVi ? 'Gửi yêu cầu thất bại. Vui lòng thử lại.' : 'Submission failed. Please try again.'),
      });
    } finally {
      setVerifyLoading(false);
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
          <div className="avatar avatar-lg">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.fullName} />
            ) : (
              <User size={32} />
            )}
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
            <VerifIcon size={16} style={{ color: verification.color }} />
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

      {/* ═══ Verification Section ═══ */}
      <div className="verification-section glass-card">
        <div className="verification-header">
          <UserCheck size={20} />
          <h3>{isVi ? 'Xác minh vai trò' : 'Role Verification'}</h3>
        </div>

        {user.verificationStatus === 'Verified' && (
          <div className="verification-status verification-success">
            <CheckCircle size={18} />
            <span>{isVi ? 'Tài khoản đã được xác minh!' : 'Account verified!'}</span>
          </div>
        )}

        {user.verificationStatus === 'Pending' && (
          <div className="verification-status verification-pending">
            <Clock size={18} />
            <span>{isVi ? 'Yêu cầu xác minh đang chờ Admin duyệt.' : 'Verification request pending admin review.'}</span>
          </div>
        )}

        {user.verificationStatus === 'Rejected' && (
          <div className="verification-status verification-rejected">
            <AlertCircle size={18} />
            <span>{isVi ? 'Yêu cầu trước đã bị từ chối. Bạn có thể gửi lại.' : 'Previous request was rejected. You may resubmit.'}</span>
          </div>
        )}

        {canVerify && (
          <div className="verification-form">
            <p className="verification-desc">
              {isVi
                ? 'Chọn vai trò phù hợp với bạn để mở khóa các tính năng:'
                : 'Select the role that fits you to unlock features:'}
            </p>

            <div className="verification-roles">
              {ROLE_OPTIONS.map((role) => {
                const RIcon = role.icon;
                return (
                  <button
                    key={role.value}
                    className={`verification-role-card ${selectedRole === role.value ? 'verification-role-selected' : ''}`}
                    onClick={() => setSelectedRole(role.value)}
                  >
                    <RIcon size={20} />
                    <span className="verification-role-name">{isVi ? role.labelVi : role.labelEn}</span>
                    <span className="verification-role-desc">{isVi ? role.desc_vi : role.desc_en}</span>
                  </button>
                );
              })}
            </div>

            <textarea
              className="verification-reason"
              placeholder={isVi ? 'Lý do xác minh (tuỳ chọn)...' : 'Reason for verification (optional)...'}
              value={verifyReason}
              onChange={(e) => setVerifyReason(e.target.value)}
              rows={2}
            />

            {verifyMessage && (
              <div className={`verification-status verification-${verifyMessage.type === 'success' ? 'success' : 'rejected'}`}>
                {verifyMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                <span>{verifyMessage.text}</span>
              </div>
            )}

            <button
              className="btn btn-primary btn-full"
              onClick={submitVerification}
              disabled={!selectedRole || verifyLoading}
            >
              <Send size={16} />
              {verifyLoading
                ? (isVi ? 'Đang gửi...' : 'Submitting...')
                : (isVi ? 'Gửi yêu cầu xác minh' : 'Submit Verification')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
