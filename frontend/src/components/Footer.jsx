import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p className="footer-copy">&copy; {new Date().getFullYear()} Gold Rush Mini Game</p>
        <nav className="footer-links" aria-label="Legal">
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/refund-policy">Refund Policy</Link>
        </nav>
        <p className="footer-contact">
          Support: <a href="mailto:support@goldrushgame.example.com">support@goldrushgame.example.com</a>
        </p>
      </div>
    </footer>
  );
}
