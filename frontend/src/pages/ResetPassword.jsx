import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { validatePassword } from '../hooks/useValidation';
import '../styles/register.css';

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const emailFromState = location.state?.email || '';
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const pwdErr = validatePassword(newPassword);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    if (!emailFromState) {
      setError('Сначала запросите код на странице сброса пароля');
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(emailFromState, code, newPassword);
      navigate('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!emailFromState) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Новый пароль</h2>
          <p>Сначала укажите email на странице <Link to="/forgot-password">сброса пароля</Link>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Новый пароль</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <h3>Email</h3>
            <input type="email" value={emailFromState} readOnly disabled className="input-readonly" />
          </div>
          <div className="form-group">
            <h3>Код из письма</h3>
            <input value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <div className="form-group">
            <h3>Новый пароль</h3>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <small className="field-hint">Минимум 6 символов, буквы и цифры</small>
          </div>
          <div className="form-group">
            <h3>Подтверждение</h3>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="register-btn" disabled={loading}>
            Сохранить
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">К входу</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
