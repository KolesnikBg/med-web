import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { computeResetPasswordErrors } from '../hooks/useValidation';
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
  const [touched, setTouched] = useState({});

  const form = { code, newPassword, confirmPassword };
  const clientErrors = useMemo(() => computeResetPasswordErrors(form), [form]);
  const formValid = Object.keys(clientErrors).length === 0;
  const canSubmit = formValid && Boolean(emailFromState) && !loading;

  const markTouched = (name) => setTouched((prev) => ({ ...prev, [name]: true }));

  const getFieldClass = (name) => {
    if (!touched[name]) return '';
    return clientErrors[name] ? 'field-input-invalid' : 'field-input-valid';
  };

  const renderFieldError = (name) => {
    if (!touched[name]) {
      return <span className="field-error field-error--placeholder" aria-hidden="true" />;
    }
    const msg = clientErrors[name];
    return msg ? (
      <span className="field-error">{msg}</span>
    ) : (
      <span className="field-error field-error--placeholder" aria-hidden="true" />
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ code: true, newPassword: true, confirmPassword: true });
    if (!formValid || !emailFromState) return;
    setError('');
    setLoading(true);
    try {
      await api.resetPassword(emailFromState, code.trim(), newPassword);
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
      <div className="auth-card auth-card--register">
        <h2>Новый пароль</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} noValidate className="register-form">
        <div className="block">
          <div className="form-group">
            <h3>Email</h3>
            <input type="email" value={emailFromState} readOnly disabled className="input-readonly" />
          </div>
          </div>
          <div className="block">
          <div className="form-group">
            <h3>Код из письма</h3>
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value); markTouched('code'); setError(''); }}
              onBlur={() => markTouched('code')}
              placeholder="000000"
              maxLength={6}
              className={getFieldClass('code')}
              required
            />
            {renderFieldError('code')}
            </div>
          </div>
          <div className="block">
          <div className="form-group">
            <h3>Новый пароль</h3>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); markTouched('newPassword'); setError(''); }}
              onBlur={() => markTouched('newPassword')}
              className={getFieldClass('newPassword')}
              required
            />
            {renderFieldError('newPassword')}
          </div>
          </div>
          <div className="block">
          <div className="form-group">
            <h3>Подтверждение</h3>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); markTouched('confirmPassword'); setError(''); }}
              onBlur={() => markTouched('confirmPassword')}
              className={getFieldClass('confirmPassword')}
              required
            />
            {renderFieldError('confirmPassword')}
          </div>
          </div>
          <button type="submit" className="register-btn" disabled={!canSubmit}>
            {loading ? 'Сохранение...' : 'Сохранить'}
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
