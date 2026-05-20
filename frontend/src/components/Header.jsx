import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Header.css';
import '../styles/global.css'

const Header = ({ user, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header-container">
        

        

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
          <Link to="/vaccinations" className="nav-link nav-link--ghost">
            Прививки
          </Link>
          <Link to="/profile" className="nav-link">
            Профиль
          </Link>
          {user?.is_admin && (
            <Link to="/admin" className="nav-link nav-link--ghost">
              Админ
            </Link>
          )}
        </nav>
        <div className="user-info">
          <span>{user?.full_name || user?.name || user?.lastname}</span>
          <button onClick={handleLogout} className="logout-btn" type="button">
            Выйти
        </button>
        </div>
        
          {/* <div className="logo" onClick={() => navigate('/')}>
          <span className="logo-icon">🏥</span>
          <span className="logo-text">{user.name}</span>
        </div> */}
      </div>
    </header>
  );
};

export default Header;