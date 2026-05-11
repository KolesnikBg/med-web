// src/pages/Login.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/register.css';  // стили

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.login(email, password);
      if (data.success) {
        onLogin(data.user, data.access_token);
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Вход в МедДневник</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className='block'>
            <div className="form-group">
              <h3>Эл. почта</h3>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className='block'>
            <div className="form-group">
              <h3>Пароль</h3>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <div className='block'>
            <div className='form-row'>
              <button type="submit" disabled={loading} className='register-btn'>
                {loading ? 'Вход...' : 'Войти'}
              </button>
            </div>
          </div>
        </form>
        <div className="auth-links">
          <span>Нет аккаунта? </span>
          <Link to="/register">Регистрация</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;