import '../styles/components.css';

// для небольших буду использовать константы (аноним ф.)
const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h4>МедКнижка</h4>
          <p>Ваш личный медицинский помощник</p>
        </div>
        
        <div className="footer-section">
          <h4>Контакты</h4>
          <p>Email: medbook@gmail.ru</p>
          <p>Телефон: 8-800-333-35-35</p>
        </div>
        
        <div className="footer-section">
          <h4>Безопасность</h4>
          <p>Все данные защищены</p>
          <p>Используется безопасное соединение</p>
          <p>Используется безопасное соединение</p>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p> 2025 МедКнижка. Все права защищены.</p>
      </div>
    </footer>
  );
};

export default Footer;