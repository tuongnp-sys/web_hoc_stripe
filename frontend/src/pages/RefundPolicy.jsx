import LegalPage from '../components/LegalPage';
import { refundPolicyContent } from '../content/legal/refundPolicy.en';

export default function RefundPolicy() {
  return <LegalPage content={refundPolicyContent} />;
}
