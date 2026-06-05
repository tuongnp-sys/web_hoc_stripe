import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';

export default function Success() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [message, setMessage] = useState('Đang xác minh với Stripe…');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setMessage('Thiếu session_id. Quay lại cửa hàng và thử lại.');
      return;
    }

    let attempts = 0;
    const maxAttempts = 5;

    const verify = () => {
      client
        .get(`/api/checkout/verify-session/${sessionId}`)
        .then((res) => {
          if (res.data.paid) {
            setOk(true);
            setMessage('Thanh toán thành công! Quyền truy cập đã được cập nhật.');
          } else if (attempts < maxAttempts) {
            attempts += 1;
            setMessage(`Đang chờ xác nhận… (${attempts}/${maxAttempts})`);
            setTimeout(verify, 2000);
          } else {
            setMessage('Chưa nhận xác nhận. Webhook có thể chậm — kiểm tra /account sau vài phút.');
          }
        })
        .catch((err) => {
          setMessage(err.response?.data?.error || 'Lỗi kết nối server.');
        });
    };

    verify();
  }, [sessionId]);

  return (
    <div className="container">
      <div className="card">
        <h1>Xác nhận thanh toán</h1>
        <p className={ok ? 'success-text' : 'warn-text'}>{message}</p>
        <p>
          <Link to="/">← Game</Link> · <Link to="/account">Tài khoản</Link>
        </p>
      </div>
    </div>
  );
}
