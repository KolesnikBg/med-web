import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import '../styles/register.css';

const VerifyEmail = ({ onLogin }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialEmail = location.state?.email || '';

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.verifyEmail(email, code);
      if (data.success) {
        onLogin(data.user, data.access_token);
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    try {
      const data = await api.resendVerification(email);
      setInfo(
        data.message + (data.dev_code ? ` (код: ${data.dev_code})` : '')
      );
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Подтверждение email</h2>
        <p>Введите код из письма. В режиме разработки код также в консоли сервера.</p>
        {error && <div className="error-message">{error}</div>}
        {info && <p className="dashboard-subtitle">{info}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <h3>Email</h3>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <h3>Код</h3>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6 цифр"
              required
              maxLength={6}
            />
          </div>
          <button type="submit" className="register-btn" disabled={loading}>
            {loading ? 'Проверка...' : 'Подтвердить'}
          </button>
        </form>
        <button type="button" className="btn-link" onClick={handleResend}>
          Отправить код повторно
        </button>
        <div className="auth-links">
          <Link to="/login">К входу</Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
