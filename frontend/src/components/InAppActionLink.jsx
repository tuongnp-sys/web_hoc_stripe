export default function InAppActionLink({ title, url, onNavigate }) {
  if (!url) return null;

  return (
    <div className="banner in-app-link-banner">
      <p style={{ margin: '0 0 0.5rem' }}>
        <strong>{title}</strong>
      </p>
      <a href={url} className="in-app-link" onClick={onNavigate}>
        Open link
      </a>
      <p className="hint" style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', wordBreak: 'break-all' }}>
        {url}
      </p>
    </div>
  );
}
