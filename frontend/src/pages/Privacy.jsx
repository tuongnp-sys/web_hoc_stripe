import LegalPage from '../components/LegalPage';
import { privacyContent } from '../content/legal/privacy.en';

export default function Privacy() {
  return <LegalPage content={privacyContent} />;
}
