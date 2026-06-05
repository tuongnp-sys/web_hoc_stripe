import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const [paid, setPaid] = useState(false);
  const [premium, setPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  const checkStatus = useCallback(async () => {
    try {
      const res = await client.get('/api/entitlements');
      setPaid(res.data.gameUnlock);
      setPremium(res.data.premium);
    } catch {
      setError('Không kết nối được API. Chạy backend: cd backend && npm start');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handlePay = async () => {
    setPaying(true);
    setError('');
    try {
      const res = await client.post('/api/checkout/one-time');
      if (res.data.url) {
        window.location.href = res.data.url;
        return;
      }
      setError('Không nhận được link thanh toán');
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi tạo phiên thanh toán');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="container">
      <h1>Demo game — thanh toán quốc tế</h1>
      <div className="card">
        <p>
          Tài khoản: <code>{user?.email}</code>
        </p>
        {loading ? (
          <p className="warn-text">Đang kiểm tra trạng thái…</p>
        ) : paid ? (
          <p className="success-text">Đã mở khóa — cảm ơn bạn đã thanh toán!</p>
        ) : (
          <p className="warn-text">Game đang khóa — nạp $4.99 để chơi tiếp.</p>
        )}
        {premium && <p className="success-text">Premium đang active.</p>}
        {error && <p className="error">{error}</p>}
        <button type="button" className="btn" onClick={handlePay} disabled={loading || paid || paying}>
          {paying ? 'Đang tạo phiên thanh toán…' : paid ? 'Đã thanh toán' : 'Nạp $4.99 để chơi tiếp'}
        </button>
        <p className="hint">
          Hoặc xem thêm gói tại <Link to="/shop">Cửa hàng</Link> · <Link to="/account">Tài khoản</Link>
        </p>
        <p className="hint">
          Thẻ test: <code>4242 4242 4242 4242</code>
        </p>
      </div>
    </div>
  );
}
