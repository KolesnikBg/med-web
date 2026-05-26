import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h4>МедДневник</h4>
          <p>Ваш личный медицинский помощник</p>
        </div>

        <div className="footer-section">
          <h4>Контакты</h4>
          <p>Email: bogdan20031124@gmail.com</p>
        </div>

        <div className="footer-section">
          <h4>Безопасность</h4>
          <a href="/agreement" className="link-agreement">Политика обработки персональных данных↗️</a>
          <p>Используется безопасное соединение</p>
        </div>
      </div>

      <div className="footer-bottom">
        <p>2026 МедДневник</p>
      </div>
    </footer>
  );
};

export default Footer;