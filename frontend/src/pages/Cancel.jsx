import { Link } from 'react-router-dom';

export default function Cancel() {
  return (
    <div className="container">
      <div className="banner">Bạn đã hủy thanh toán. Có thể thử lại bất cứ lúc nào.</div>
      <div className="card">
        <h1>Thanh toán bị hủy</h1>
        <Link to="/shop">← Quay lại cửa hàng</Link>
      </div>
    </div>
  );
}
