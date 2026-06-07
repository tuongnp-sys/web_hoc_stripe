import { Link } from 'react-router-dom';

export default function LegalPage({ content }) {
  return (
    <div className="container container-wide">
      <h1>{content.title}</h1>
      <p className="hint">Last updated: {content.lastUpdated}</p>
      <div className="card legal-content">
        {content.sections.map((section) => (
          <section key={section.heading} className="legal-section">
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
      <p className="hint">
        <Link to="/">Back to Game</Link>
      </p>
    </div>
  );
}
