import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/register.css';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo123');
  const [code2fa, setCode2fa] = useState('');
  const [tempToken, setTempToken] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (tempToken) {
        const data = await api.verify2faLogin(tempToken, code2fa);
        if (data.success) {
          onLogin(data.user, data.access_token);
          navigate('/');
        }
        return;
      }

      const data = await api.login(email, password);
      if (data.needs_verification) {
        navigate('/verify-email', { state: { email } });
        return;
      }
      if (data.requires_2fa) {
        setTempToken(data.temp_token);
        setPendingUser(data.user);
        return;
      }
      if (data.success) {
        api.setToken(data.access_token);
        onLogin(data.user, data.access_token);
        navigate('/');
      }
    } catch (err) {
      if (err.payload?.needs_verification) {
        navigate('/verify-email', { state: { email } });
        return;
      }
      if (err.payload?.error_code === 'email_not_found') {
        setError('Пользователь с такой почтой не найден');
      } else if (err.payload?.error_code === 'wrong_password') {
        setError('Неверный пароль');
      } else {
        setError(err.message || 'Ошибка входа');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{tempToken ? 'Код с почты' : 'Вход в МедДневник'}</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          {!tempToken ? (
            <>
              <div className="form-group">
                <h3>Эл. почта</h3>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <h3>Пароль</h3>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <h3>Код из письма</h3>
              <p className="dashboard-subtitle">
                Код отправлен на {pendingUser?.email}
              </p>
              <input
                value={code2fa}
                onChange={(e) => setCode2fa(e.target.value)}
                placeholder="000000"
                required
              />
            </div>
          )}
          <button type="submit" disabled={loading} className="register-btn">
            {loading ? '...' : tempToken ? 'Подтвердить' : 'Войти'}
          </button>
        </form>
        {!tempToken && (
          <div className="auth-links">
            <Link to="/forgot-password">Забыли пароль?</Link>
            <span> · </span>
            <Link to="/register">Регистрация</Link>
          </div>
        )}
        {tempToken && (
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setTempToken(null);
              setCode2fa('');
            }}
          >
            Назад
          </button>
        )}
      </div>
    </div>
  );
};

export default Login;
