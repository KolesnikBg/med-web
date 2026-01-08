import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Header.css';

const Header = ({ user, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="logo" onClick={() => navigate('/')}>
          <span className="logo-icon">🏥</span>
          <span className="logo-text">МедДневник</span>
        </div>

        <div className="user-info">
          <span>Привет, {user?.name || 'Пользователь'}!</span>
        </div>

        <nav className="nav">
          <Link to="/" className="nav-link">
            Главная
          </Link>
          <Link to="/analysis" className="nav-link nav-link--ghost">
            Анализы
          </Link>
          <Link to="/appointments" className="nav-link nav-link--ghost">
            Приёмы
          </Link>
          <Link to="/profile" className="nav-link">
            Профиль
          </Link>
          <button onClick={handleLogout} className="logout-btn" type="button">
            Выйти
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;