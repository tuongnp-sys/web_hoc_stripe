import axios from 'axios';

// Dev: dùng proxy Vite (baseURL rỗng → cùng origin localhost:5173)
// Prod: bắt buộc VITE_API_URL trỏ tới Render API
function resolveApiUrl() {
  // Dev: proxy Vite (/api → backend), tránh lỗi CORS
  if (import.meta.env.DEV) return '';

  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  console.error('Thiếu VITE_API_URL — cấu hình trên Vercel trỏ tới Render API');
  return '';
}

export const API_URL = resolveApiUrl();

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const stripeMode = localStorage.getItem('stripe_mode') || 'test';
  config.headers['X-Stripe-Mode'] = stripeMode;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!error.response) {
      const hint = import.meta.env.DEV
        ? 'Không kết nối được API. Chạy: cd backend && npm start'
        : 'Không kết nối được API. Kiểm tra VITE_API_URL trên Vercel.';
      error.message = hint;
    }
    return Promise.reject(error);
  }
);

export default client;
