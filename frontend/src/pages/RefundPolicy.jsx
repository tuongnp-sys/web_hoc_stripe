import { useEffect, useState } from 'react';
import LegalPage from '../components/LegalPage';
import client from '../api/client';
import { refundPolicyContent } from '../content/legal/refundPolicy.en';

export default function RefundPolicy() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get('/api/policy/refund')
      .then((res) => setContent(res.data.policy))
      .catch(() => setContent(refundPolicyContent))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="container container-wide">Loading…</div>;
  }

  return <LegalPage content={content || refundPolicyContent} />;
}
