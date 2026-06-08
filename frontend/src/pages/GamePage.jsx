import { useMemo, useRef, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { API_URL } from '../api/client';

function buildGameSrc() {
  const base = '/game/shell.html';
  if (!API_URL) return base;
  const params = new URLSearchParams({ apiBase: API_URL });
  return `${base}?${params.toString()}`;
}

export default function GamePage() {
  const iframeRef = useRef(null);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const gameSrc = useMemo(() => buildGameSrc(), []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const notifyRefresh = () => {
      iframe.contentWindow?.postMessage({ type: 'joymed:refresh-profile' }, '*');
    };

    if (searchParams.get('purchase') === 'success') {
      notifyRefresh();
      const next = new URLSearchParams(searchParams);
      next.delete('purchase');
      setSearchParams(next, { replace: true });
      return;
    }

    notifyRefresh();
  }, [location.key, searchParams, setSearchParams]);

  return (
    <div className="game-page">
      <iframe
        ref={iframeRef}
        src={gameSrc}
        className="game-frame"
        title="Joymed — 7 Layers of Ascent"
        allow="autoplay"
      />
    </div>
  );
}
