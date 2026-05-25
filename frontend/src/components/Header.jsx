import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './Header.css';
import '../styles/global.css';

const NAV_LINKS = [
  { to: '/', label: 'Главная' },
  { to: '/analysis', label: 'Анализы', ghost: true },
  { to: '/appointments', label: 'Приёмы', ghost: true },
  { to: '/vaccinations', label: 'Прививки', ghost: true },
  { to: '/profile', label: 'Профиль' },
];

const Header = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    onLogout();
    navigate('/login');
  };

  const renderLinks = (mobile = false) =>
    NAV_LINKS.map((item) => (
      <Link
        key={item.to}
        to={item.to}
        className={`nav-link${item.ghost ? ' nav-link--ghost' : ''}${mobile ? ' nav-link--mobile' : ''}`}
        onClick={() => setMenuOpen(false)}
      >
        {item.label}
      </Link>
    ));

  return (
    <header className="header">
      <div className="header-container">
        <button
          type="button"
          className="nav-burger"
          aria-label="Меню"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          ☰
        </button>

        <nav className="nav nav--desktop">
          {renderLinks()}
          {user?.is_admin && (
            <Link to="/admin" className="nav-link nav-link--ghost" onClick={() => setMenuOpen(false)}>
              Админ
            </Link>
          )}
        </nav>

        <div className="user-info">
          <span className="user-info__name">{user?.name || 'Пользователь'}</span>
          <button onClick={handleLogout} className="logout-btn" type="button">
            Выйти
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="nav-overlay" role="dialog" aria-modal="true">
          <div className="nav-overlay__backdrop" onClick={() => setMenuOpen(false)} />
          <nav className="nav-mobile">
            <div className="nav-mobile__head">
              <span className="nav-mobile__user">{user?.name || 'Меню'}</span>
              <button type="button" className="nav-mobile__close" onClick={() => setMenuOpen(false)} aria-label="Закрыть">
                ×
              </button>
            </div>
            <div className="nav-mobile__links">
              {renderLinks(true)}
              {user?.is_admin && (
                <Link to="/admin" className="nav-link nav-link--mobile" onClick={() => setMenuOpen(false)}>
                  Админ
                </Link>
              )}
            </div>
            <button type="button" className="nav-mobile__logout" onClick={handleLogout}>
              Выйти
            </button>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
