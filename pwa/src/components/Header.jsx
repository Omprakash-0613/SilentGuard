import './Header.css';

/**
 * Header — app title, model loading status, and connection indicator.
 */
export default function Header({ modelLoaded, status }) {
  const getConnectionDot = () => {
    if (status === 'listening') return 'dot--green';
    if (status === 'crisis') return 'dot--red';
    if (status === 'loading') return 'dot--amber';
    return 'dot--gray';
  };

  return (
    <header className="header">
      <div className="header__brand">
        <div className="header__logo">🛡️</div>
        <div>
          <h1 className="header__title">SilentGuard</h1>
          <p className="header__subtitle">Passive Audio Crisis Detection</p>
        </div>
      </div>
      <div className="header__status">
        <div className={`header__dot ${getConnectionDot()}`} />
        <span className="header__status-text">
          {modelLoaded ? (status === 'listening' ? 'Active' : 'Ready') : 'Loading…'}
        </span>
      </div>
    </header>
  );
}
