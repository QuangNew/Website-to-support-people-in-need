import { useState } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Send,
  UserCheck,
  Heart,
  HandHeart,
  Users,
  LogIn,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useMapStore } from '../../stores/mapStore';
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

export default function VerificationPanel() {
  const { user, setUser, isAuthenticated } = useAuthStore();
  const { setAuthModal } = useMapStore();
  const { locale } = useLanguage();
  const isVi = locale === 'vi';

  const [selectedRole, setSelectedRole] = useState('');
  const [verifyReason, setVerifyReason] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="panel-content verification-panel">
        <div className="panel-header">
          <h2 className="panel-title">{isVi ? 'Xác minh vai trò' : 'Role Verification'}</h2>
        </div>
        <div style={{ padding: 'var(--sp-5)', textAlign: 'center' }}>
          <UserCheck size={48} style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-3)' }} />
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)' }}>
            {isVi ? 'Vui lòng đăng nhập để xác minh vai trò.' : 'Please login to verify your role.'}
          </p>
          <button className="btn btn-primary btn-full" onClick={() => setAuthModal('login')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <LogIn size={16} />
            {isVi ? 'Đăng nhập' : 'Login'}
          </button>
        </div>
      </div>
    );
  }

  const verification = VERIFICATION_CONFIG[user.verificationStatus] || VERIFICATION_CONFIG.None;
  const VerifIcon = verification.icon;
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
    <div className="panel-content verification-panel">
      <div className="panel-header">
        <h2 className="panel-title">{isVi ? 'Xác minh vai trò' : 'Role Verification'}</h2>
      </div>

      <div style={{ padding: 'var(--sp-4)', overflowY: 'auto', flex: 1 }}>
        {/* Current status */}
        <div className="glass-card" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
            <VerifIcon size={20} style={{ color: verification.color }} />
            <div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                {isVi ? 'Trạng thái hiện tại' : 'Current status'}
              </span>
              <div style={{ fontWeight: 600, color: verification.color }}>
                {isVi ? verification.labelVi : verification.labelEn}
              </div>
            </div>
          </div>
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
