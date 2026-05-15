import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Heart, ArrowLeft, X, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import api, { getImageUrl } from '../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DonationHistoryItem {
  id: number;
  displayName: string;
  maskedPhone: string | null;
  avatarUrl: string | null;
  amount: number;
  message: string | null;
  paidAt: string;
}

interface CreateDonationResponse {
  orderCode: number;
  qrCode: string;
  checkoutUrl: string;
  paymentLinkId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + 'đ';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} ngày trước`;
  const months = Math.floor(days / 30);
  return `${months} tháng trước`;
}

function getInitials(displayName: string): string {
  return displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

// ─── Preset amounts ───────────────────────────────────────────────────────────

const PRESETS = [
  { label: '50.000đ', value: 50000 },
  { label: '100.000đ', value: 100000 },
  { label: '200.000đ', value: 200000 },
  { label: '500.000đ', value: 500000 },
];

// ─── DonatePage ───────────────────────────────────────────────────────────────

export default function DonatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuthStore();

  // History state
  const [history, setHistory] = useState<DonationHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Form state
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // QR modal state
  const [qrData, setQrData] = useState<CreateDonationResponse | null>(null);
  const [pollStatus, setPollStatus] = useState<'pending' | 'paid' | 'cancelled'>('pending');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollInFlightRef = useRef(false);
  const historyRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle PayOS redirect back
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success' || status === 'cancelled') {
      // PayOS returned — just reload history; QR modal state is handled by poll
      void fetchHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const { data } = await api.get<DonationHistoryItem[]>('/donation/history');
      setHistory(data);
    } catch {
      // non-critical
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void fetchHistory(); }, [fetchHistory]);

  // Polling after QR shown
  useEffect(() => {
    if (!qrData) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      pollInFlightRef.current = false;
      return;
    }
    setPollStatus('pending');
    pollInFlightRef.current = false;
    pollRef.current = setInterval(async () => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const { data } = await api.get<{ status: string }>(`/donation/status/${qrData.orderCode}`);
        if (data.status === 'Paid') {
          setPollStatus('paid');
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          // Refresh history after short delay
          if (historyRefreshTimeoutRef.current) clearTimeout(historyRefreshTimeoutRef.current);
          historyRefreshTimeoutRef.current = setTimeout(() => { void fetchHistory(); }, 1000);
        } else if (data.status === 'Cancelled') {
          setPollStatus('cancelled');
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch { /* ignore */ }
      finally {
        pollInFlightRef.current = false;
      }
    }, 3000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (historyRefreshTimeoutRef.current) {
        clearTimeout(historyRefreshTimeoutRef.current);
        historyRefreshTimeoutRef.current = null;
      }
      pollInFlightRef.current = false;
    };
  }, [qrData, fetchHistory]);

  const effectiveAmount = selectedAmount ?? (customAmount ? parseInt(customAmount.replace(/\D/g, ''), 10) : 0);

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      setFormError('Bạn cần đăng nhập để ủng hộ.');
      return;
    }
    if (!effectiveAmount || effectiveAmount < 2000) {
      setFormError('Số tiền tối thiểu là 2.000đ.');
      return;
    }
    if (effectiveAmount > 50_000_000) {
      setFormError('Số tiền tối đa là 50.000.000đ.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const { data } = await api.post<CreateDonationResponse>('/donation/create', {
        amount: effectiveAmount,
        message: message.trim() || null,
      });
      setQrData(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'Không thể tạo mã thanh toán. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setQrData(null);
    setPollStatus('pending');
    setSelectedAmount(null);
    setCustomAmount('');
    setMessage('');
  };

  return (
    <div className="donate-page">
      {/* ─── Header ─── */}
      <div className="donate-header">
        <button type="button" className="donate-back-btn" onClick={() => navigate(-1)} aria-label="Quay lại">
          <ArrowLeft size={18} />
        </button>
        <div className="donate-header-title">
          <Heart size={18} className="donate-heart-icon" />
          <h1>Ủng hộ ReliefConnect</h1>
        </div>
        <p className="donate-header-subtitle">
          Mỗi đóng góp giúp duy trì nền tảng cứu trợ miễn phí.
        </p>
      </div>

      <div className="donate-body">
        {/* ═══ SECTION 1: Cảm ơn ═══ */}
        <section className="donate-section donate-thanks">
          <h2 className="donate-section-title">
            <Heart size={16} />
            Cảm ơn những người đã ủng hộ
          </h2>

          {historyLoading ? (
            <div className="donate-loading">
              <div className="spinner spinner-sm" />
              <span>Đang tải lịch sử...</span>
            </div>
          ) : history.length === 0 ? (
            <p className="donate-empty">Hãy là người đầu tiên ủng hộ!</p>
          ) : (
            <ul className="donate-history-list">
              {history.map((item) => (
                <li key={item.id} className="donate-history-item">
                  <div className="donate-history-left">
                    <div className="donate-history-avatar">
                      {item.avatarUrl ? (
                        <img src={getImageUrl(item.avatarUrl)} alt={item.displayName} className="donate-history-avatar-img" />
                      ) : (
                        <span>{getInitials(item.displayName)}</span>
                      )}
                    </div>
                    <div className="donate-history-meta">
                      <span className="donate-history-name">{item.displayName}</span>
                      {item.maskedPhone && (
                        <span className="donate-history-phone">{item.maskedPhone}</span>
                      )}
                      {item.message && (
                        <span className="donate-history-msg">"{item.message}"</span>
                      )}
                    </div>
                  </div>
                  <div className="donate-history-right">
                    <span className="donate-history-amount">{formatVnd(item.amount)}</span>
                    <span className="donate-history-time">{timeAgo(item.paidAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ═══ SECTION 2: Form ũng hộ ═══ */}
        <section className="donate-section donate-form-section">
          <h2 className="donate-section-title">
            <Heart size={16} />
            Ủng hộ ngay
          </h2>

          {!isAuthenticated && (
            <div className="donate-auth-notice">
              <AlertCircle size={16} />
              <span>Vui lòng <button type="button" className="donate-login-link" onClick={() => navigate('/?login=1')}>đăng nhập</button> để ủng hộ.</span>
            </div>
          )}

          {isAuthenticated && (
            <p className="donate-user-hint">Ủng hộ với tư cách: <strong>{user?.fullName ?? user?.email}</strong></p>
          )}

          {/* Amount presets */}
          <div className="donate-presets">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`donate-preset-btn${selectedAmount === p.value ? ' active' : ''}`}
                onClick={() => { setSelectedAmount(p.value); setCustomAmount(''); setFormError(null); }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="donate-custom-wrap">
            <label htmlFor="donate-custom" className="donate-label">Hoặc nhập số tiền khác (VND)</label>
            <input
              id="donate-custom"
              type="text"
              inputMode="numeric"
              className="donate-input"
              placeholder="Ví dụ: 150000"
              value={customAmount}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '');
                setCustomAmount(raw);
                setSelectedAmount(null);
                setFormError(null);
              }}
            />
            {customAmount && parseInt(customAmount, 10) >= 2000 && (
              <span className="donate-amount-preview">{formatVnd(parseInt(customAmount, 10))}</span>
            )}
          </div>

          {/* Message */}
          <div className="donate-message-wrap">
            <label htmlFor="donate-msg" className="donate-label">Lời nhắn (tuỳ chọn)</label>
            <textarea
              id="donate-msg"
              className="donate-textarea"
              rows={2}
              maxLength={200}
              placeholder="Nhập lời nhắn của bạn..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <span className="donate-char-count">{message.length}/200</span>
          </div>

          {formError && (
            <div className="donate-error">
              <AlertCircle size={14} />
              {formError}
            </div>
          )}

          <button
            type="button"
            className="donate-submit-btn"
            disabled={submitting || !isAuthenticated || !effectiveAmount || effectiveAmount < 2000}
            onClick={() => void handleSubmit()}
          >
            {submitting ? (
              <><div className="spinner spinner-sm" /> Đang xử lý...</>
            ) : (
              <><Heart size={16} /> Xác nhận ủng hộ</>
            )}
          </button>
        </section>
      </div>

      {/* ═══ QR Modal ═══ */}
      {qrData && (
        <div className="donate-modal-overlay" role="dialog" aria-modal="true" aria-label="Thanh toán QR">
          <div className="donate-modal">
            <button type="button" className="donate-modal-close" onClick={closeModal} aria-label="Đóng">
              <X size={20} />
            </button>

            {pollStatus === 'paid' ? (
              <div className="donate-modal-success">
                <CheckCircle size={52} className="donate-success-icon" />
                <h3>Cảm ơn bạn đã ủng hộ!</h3>
                <p className="donate-success-amount">{formatVnd(effectiveAmount)}</p>
                <p>Đóng góp của bạn đã được ghi nhận.</p>
                <button type="button" className="donate-submit-btn" onClick={closeModal}>Đóng</button>
              </div>
            ) : pollStatus === 'cancelled' ? (
              <div className="donate-modal-cancelled">
                <X size={52} className="donate-cancelled-icon" />
                <h3>Giao dịch đã bị huỷ</h3>
                <button type="button" className="donate-submit-btn" onClick={closeModal}>Thử lại</button>
              </div>
            ) : (
              <>
                <h3 className="donate-modal-title">Quét mã để thanh toán</h3>
                <p className="donate-modal-amount">{formatVnd(effectiveAmount)}</p>

                <div className="donate-qr-wrap">
                  <QRCodeSVG
                    value={qrData.qrCode}
                    size={220}
                    level="M"
                    includeMargin
                  />
                </div>

                <div className="donate-modal-pending">
                  <Clock size={14} />
                  <span>Đang chờ thanh toán...</span>
                </div>

                <a
                  href={qrData.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="donate-checkout-link"
                >
                  Hoặc thanh toán qua PayOS →
                </a>

                <button type="button" className="donate-cancel-btn" onClick={closeModal}>
                  Huỷ
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
