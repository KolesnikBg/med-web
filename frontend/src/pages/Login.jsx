import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
// пропс на вход 
const Login = ({ onLogin }) => {
  
  // состояния 
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);  // блок повторки отправки формы

  // функ отправки формы 
  const handleSubmit = async (e) => {
    e.preventDefault();  // какая-то нужна фигня 
    setError(''); 
    setLoading(true);

    try {
      // упрощенный API
      // через json отправляет почту и пароль (НУЖНО ДОБАВИТЬ ЕЩЕ ДАННЫЕ НА ОТПРАВКУ!)
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      // проверочка отправки 
      const data = await response.json();

      // если ответ не 2хх - это сломались 
      if (!response.ok) {
        throw new Error(data.message || 'Ошибка входа');
      }

      if (data.success) {
        // cсохранение пользователя
        localStorage.setItem('med_user', JSON.stringify(data.user));
        localStorage.setItem('med_token', 'demo-token'); // временный токен
        
        // вызов callback
        onLogin(data.user, 'demo-token');
      } else {
        setError(data.message || 'Ошибка входа');
      }
    } catch (err) {
      setError(err.message || 'Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Вход в МедКнижку</h2>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ваш@email.com"
              className="form-input"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=""
              className="form-input"
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="login-btn"
            disabled={loading}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
        
        <div className="login-links">
          <span>Нет аккаунта?</span>
          <Link to="/register" className="register-link">Зарегистрироваться</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;