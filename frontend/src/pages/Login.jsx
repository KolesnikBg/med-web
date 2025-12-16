import React, { useState } from 'react';
import api from '../services/api';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Используем наш упрощенный API
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Ошибка входа');
      }

      if (data.success) {
        // Сохраняем пользователя
        localStorage.setItem('med_user', JSON.stringify(data.user));
        localStorage.setItem('med_token', 'demo-token'); // Временный токен
        
        // Вызываем callback
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
              placeholder="••••••••"
              className="form-input"
              required
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button 
            type="submit" 
            className="login-btn"
            disabled={loading}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
        
        <div className="demo-credentials">
          <p><strong>Демо доступ:</strong></p>
          <p>Email: demo@example.com</p>
          <p>Пароль: demo123</p>
        </div>
      </div>
    </div>
  );
};

export default Login;