import { useState, useRef } from 'react';
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
  ImagePlus,
  X,
  Loader2,
  Phone,
  MapPin,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useMapStore } from '../../stores/mapStore';
import { useLanguage } from '../../contexts/LanguageContext';
import { authApi, socialApi } from '../../services/api';

const VERIFICATION_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; labelVi: string; labelEn: string }> = {
  Approved: { icon: CheckCircle, color: 'var(--success-500)', labelVi: 'Đã xác minh', labelEn: 'Verified' },
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
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Image upload state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_FILES = 5;
  const MAX_SIZE = 2 * 1024 * 1024; // 2MB

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = MAX_FILES - imageFiles.length;
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files.slice(0, remaining)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(isVi ? `${file.name}: chỉ chấp nhận JPG, PNG, WEBP` : `${file.name}: only JPG, PNG, WEBP allowed`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        errors.push(isVi ? `${file.name}: vượt quá 2MB` : `${file.name}: exceeds 2MB`);
        continue;
      }
      validFiles.push(file);
    }

    if (errors.length) {
      setVerifyMessage({ type: 'error', text: errors.join('. ') });
    }

    if (validFiles.length) {
      setImageFiles(prev => [...prev, ...validFiles]);
      validFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = () => setImagePreviews(prev => [...prev, reader.result as string]);
        reader.readAsDataURL(file);
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

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
  const canVerify = true;

  const submitVerification = async () => {
    if (!selectedRole) return;
    setVerifyLoading(true);
    setVerifyMessage(null);
    try {
      // Upload images first (reuse social upload endpoint)
      let imageUrls: string[] | undefined;
      if (imageFiles.length > 0) {
        const uploadPromises = imageFiles.map(file => socialApi.uploadImage(file));
        const results = await Promise.all(uploadPromises);
        imageUrls = results.map(r => r.data.imageUrl);
      }

      await authApi.submitVerification({
        requestedRole: selectedRole,
        reason: verifyReason || undefined,
        phoneNumber,
        address: address || undefined,
        imageUrls,
      });
      setVerifyMessage({
        type: 'success',
        text: isVi ? 'Yêu cầu xác minh đã được gửi! Admin sẽ duyệt sớm nhất.' : 'Verification request submitted! Admin will review shortly.',
      });
      setUser({ ...user, verificationStatus: 'Pending' });
      setSelectedRole('');
      setVerifyReason('');
      setPhoneNumber('');
      setAddress('');
      setImageFiles([]);
      setImagePreviews([]);
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

        {user.verificationStatus === 'Approved' && (
          <div className="verification-status verification-success">
            <CheckCircle size={18} />
            <span>{isVi ? 'Tài khoản đã được xác minh! Bạn có thể gửi yêu cầu đổi vai trò.' : 'Account verified! You can submit a request to change your role.'}</span>
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

            {/* Phone number (required) */}
            <div style={{ marginBottom: 'var(--sp-3)' }}>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: 'var(--sp-1)' }}>
                <Phone size={14} />
                {isVi ? 'Số điện thoại *' : 'Phone number *'}
              </label>
              <input
                type="tel"
                className="form-input"
                placeholder={isVi ? 'VD: 0901234567' : 'e.g. 0901234567'}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {/* Address (optional) */}
            <div style={{ marginBottom: 'var(--sp-3)' }}>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: 'var(--sp-1)' }}>
                <MapPin size={14} />
                {isVi ? 'Địa chỉ (tuỳ chọn)' : 'Address (optional)'}
              </label>
              <input
                type="text"
                className="form-input"
                placeholder={isVi ? 'VD: 123 Nguyễn Huệ, Q.1, TP.HCM' : 'e.g. 123 Main St, City'}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <textarea
              className="verification-reason"
              placeholder={isVi ? 'Lý do xác minh (tuỳ chọn)...' : 'Reason for verification (optional)...'}
              value={verifyReason}
              onChange={(e) => setVerifyReason(e.target.value)}
              rows={2}
            />

            {/* Image upload */}
            <div className="verification-images">
              <div className="verification-images-header">
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  {isVi ? `Ảnh xác minh (${imageFiles.length}/${MAX_FILES})` : `Verification photos (${imageFiles.length}/${MAX_FILES})`}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageSelect}
                  hidden
                />
                {imageFiles.length < MAX_FILES && (
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: 'var(--text-xs)' }}
                  >
                    <ImagePlus size={14} />
                    {isVi ? 'Thêm ảnh' : 'Add photo'}
                  </button>
                )}
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 var(--sp-2)' }}>
                {isVi ? 'Tối đa 5 ảnh, mỗi ảnh < 2MB. Định dạng: JPG, PNG, WEBP' : 'Max 5 images, each < 2MB. Formats: JPG, PNG, WEBP'}
              </p>
              {imagePreviews.length > 0 && (
                <div className="verification-images-grid">
                  {imagePreviews.map((preview, i) => (
                    <div key={i} className="verification-image-thumb">
                      <img src={preview} alt={`Preview ${i + 1}`} />
                      <button
                        className="verification-image-remove"
                        onClick={() => removeImage(i)}
                        type="button"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {imageFiles.length === 0 && (
                <button
                  type="button"
                  className="verification-upload-area"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={24} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {isVi ? 'Nhấn để tải ảnh CMND/CCCD hoặc minh chứng' : 'Click to upload ID card or proof documents'}
                  </span>
                </button>
              )}
            </div>

            {verifyMessage && (
              <div className={`verification-status verification-${verifyMessage.type === 'success' ? 'success' : 'rejected'}`}>
                {verifyMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                <span>{verifyMessage.text}</span>
              </div>
            )}

            <button
              className="btn btn-primary btn-full"
              onClick={submitVerification}
              disabled={!selectedRole || !phoneNumber.trim() || verifyLoading}
            >
              {verifyLoading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
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
